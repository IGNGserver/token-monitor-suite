'use strict';

/**
 * Warp / Oz subscription-usage adapter.
 *
 * Warp exposes plan quota through a GraphQL endpoint. Unlike most providers here
 * it needs a single bearer API key (`wk-...`, from Warp Settings → Platform → API
 * keys); a raw Cookie header is also accepted as a fallback, matching upstream.
 *
 * Design notes:
 *
 *  - Upstream tokscale does NOT call this endpoint from its `usage` provider: it
 *    only reads a cache that `tokscale warp sync` wrote. A Hub container cannot run
 *    that CLI, so this adapter calls GraphQL directly — the source of the data
 *    rather than a cache of it.
 *  - Warp names the fields "requests" but they are billed as credits, and the
 *    add-on pool is separate rather than additive. Both facts only affect the
 *    labels, not the arithmetic.
 *  - `requestsUsedSinceLastRefresh` with no `requestLimit` is an informational
 *    counter, not a capped quota: it must render as a full bar, never as an
 *    exhausted one. This mirrors upstream's explicit handling.
 *  - A missing cache is not an error here (that is a tokscale-CLI concern), so the
 *    only "not configured" case is a missing credential.
 */

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const WARP_FETCH_TIMEOUT_MS = 12_000;
const WARP_GRAPHQL_ENDPOINT = 'https://app.warp.dev/graphql/v2';
const WARP_WEB_ORIGIN = 'https://app.warp.dev';

const WARP_REQUEST_LIMIT_QUERY = 'query GetRequestLimitInfo { requestLimitInfo { requestLimit requestsUsedSinceLastRefresh nextRefreshTime bonusGrantsInfo { spendingInfo { currentMonthSpendCents currentMonthCreditsPurchased } } } }';
const WARP_WORKSPACES_QUERY = 'query GetWorkspacesMetadataForUser { workspacesMetadataForUser { id name totalRequestsUsedSinceLastRefresh aiOverages { currentMonthlyRequestCostCents currentMonthlyRequestsUsed } usageInfo { requestsUsedSinceLastRefresh } } }';

function cleanSecret(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function hasControlCharacters(text) {
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Resolve the Warp credential. A `wk-` API key is the stable path; a raw cookie
 * header is accepted when it carries `name=value` pairs. Anything else (a bare
 * word, a value with control characters) is treated as absent rather than sent.
 */
function warpCredential(options = {}) {
  const raw = cleanSecret(options.warpApiKey || options.warpBearerToken || options.warpCookie);
  if (!raw || hasControlCharacters(raw)) return null;
  // A cookie header is recognizable by its `name=value; name=value` shape and is
  // the only form that should be sent as a Cookie rather than a bearer token.
  const looksLikeCookie = raw.includes('=') && !raw.startsWith('wk-');
  return looksLikeCookie
    ? { kind: 'cookie', value: raw }
    : { kind: 'bearer', value: raw };
}

function hasWarpCredentials(options = {}) {
  return Boolean(warpCredential(options));
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function toIso(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Depth-first search for the first numeric value under any of `keys`. GraphQL
 * wraps payloads in `data`/operation-name envelopes whose exact nesting varies,
 * so keyed search is more durable than a fixed path.
 */
function findNumberByKeys(value, keys, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findNumberByKeys(entry, keys, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const direct = numberOrNull(value[key]);
      if (direct !== null) return direct;
    }
  }
  for (const entry of Object.values(value)) {
    const found = findNumberByKeys(entry, keys, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

function findStringByKey(value, key, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringByKey(entry, key, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    const raw = value[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  for (const entry of Object.values(value)) {
    const found = findStringByKey(entry, key, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Build the windows from one or more GraphQL responses. The request info and the
 * workspace rollup are queried separately, so both are folded in: the limit info
 * wins when present, and the workspace totals back it up.
 */
function buildWarpWindows(responses) {
  const list = (Array.isArray(responses) ? responses : [responses]).filter(Boolean);
  const requestsUsed = firstNumber(list, ['requestsUsedSinceLastRefresh', 'totalRequestsUsedSinceLastRefresh', 'currentMonthlyRequestsUsed']);
  const requestLimit = firstNumber(list, ['requestLimit']);
  const spendCents = firstNumber(list, ['currentMonthSpendCents', 'currentMonthlyRequestCostCents']);
  const nextRefresh = firstString(list, ['nextRefreshTime']);

  const windows = [];
  if (requestsUsed !== null) {
    const capped = requestLimit !== null && requestLimit > 0;
    windows.push({
      kind: 'session',
      label: 'Requests',
      // The raw count is always reported (it is real data the UI shows as text);
      // only the denominator and its meter are conditional on a cap existing.
      used: requestsUsed,
      ...(capped ? { limit: requestLimit } : {}),
      ...(capped ? { usedPercent: clampPercent((requestsUsed / requestLimit) * 100) } : {}),
      // No denominator means this is an informational counter, so keep the bar
      // full instead of rendering a false "exhausted" state.
      showMeter: capped,
      ...(nextRefresh ? { resetsAt: toIso(nextRefresh) } : {}),
      detail: capped ? `${Math.max(0, requestLimit - requestsUsed)} requests left` : `${requestsUsed} requests used`
    });
  }
  if (spendCents !== null) {
    windows.push({
      kind: 'billing',
      metric: 'spend',
      label: 'Spend',
      remaining: Math.round(spendCents) / 100,
      currency: 'USD',
      // Spend is a dollar figure, not a consumed quota.
      showMeter: false,
      ...(nextRefresh ? { resetsAt: toIso(nextRefresh) } : {})
    });
  }
  return windows;
}

function firstNumber(responses, keys) {
  for (const response of responses) {
    const found = findNumberByKeys(response, keys);
    if (found !== null) return found;
  }
  return null;
}

function firstString(responses, keys) {
  for (const response of responses) {
    for (const key of keys) {
      const found = findStringByKey(response, key);
      if (found !== null) return found;
    }
  }
  return null;
}

function mapWarpErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchWarpLimits(options = {}, deps = {}) {
  const nowMs = (deps.now || Date.now)();
  const updatedAt = new Date(nowMs).toISOString();
  const credential = warpCredential(options);
  if (!credential) {
    return normalizeLimitProvider({
      provider: 'warp',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: WARP_WEB_ORIGIN,
    Referer: `${WARP_WEB_ORIGIN}/`,
    ...(credential.kind === 'cookie'
      ? { Cookie: credential.value }
      : { Authorization: `Bearer ${credential.value}` })
  };

  const callGraphql = async (operationName, query, signal) => {
    const response = await (deps.fetch || fetch)(WARP_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ operationName, query, variables: {} }),
      signal
    });
    if (response.status === 401 || response.status === 403) {
      const error = new Error(`Warp returned ${response.status}`);
      error.status = 'unauthorized';
      throw error;
    }
    if (response.status === 429) {
      const error = new Error('Warp returned 429');
      error.status = 'sourceRateLimited';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Warp returned ${response.status}`);
      error.status = 'unavailable';
      throw error;
    }
    return response.json();
  };

  try {
    const responses = await runWithProbeDeadline(async ({ signal }) => {
      const limitInfo = await callGraphql('GetRequestLimitInfo', WARP_REQUEST_LIMIT_QUERY, signal);
      // The workspace rollup is supplementary: a failure there must not discard
      // the request-limit numbers that already arrived.
      const workspaces = await callGraphql('GetWorkspacesMetadataForUser', WARP_WORKSPACES_QUERY, signal)
        .catch(() => null);
      return [limitInfo, workspaces];
    }, { deadlineMs: Number(deps.fetchTimeoutMs || WARP_FETCH_TIMEOUT_MS) });

    const windows = buildWarpWindows(responses);
    if (!windows.length) {
      throw Object.assign(
        new Error('Warp GraphQL response did not contain aggregate usage fields'),
        { status: 'unavailable' }
      );
    }
    return normalizeLimitProvider({
      provider: 'warp',
      accountKey: hashKey('warp', credential.value),
      accountLabel: String(options.warpAccountLabel || '').trim().slice(0, 128) || 'Warp',
      source: 'api',
      status: 'ok',
      updatedAt,
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'warp',
      source: 'api',
      status: mapWarpErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  WARP_FETCH_TIMEOUT_MS,
  WARP_GRAPHQL_ENDPOINT,
  WARP_REQUEST_LIMIT_QUERY,
  WARP_WORKSPACES_QUERY,
  buildWarpWindows,
  fetchWarpLimits,
  hasWarpCredentials,
  warpCredential
};
