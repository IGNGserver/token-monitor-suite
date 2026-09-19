'use strict';

/**
 * Droid (Factory) subscription-usage adapter.
 *
 * The provider id is `droid` to match the tracked client id, the README row and
 * the icon; "Factory" is the vendor's own name and is what the API host uses.
 *
 * Factory's quota arrives as a billing-period token allowance, not a rolling
 * time window: the API reports how many tokens the org has used against the
 * period's allowance, plus a separate premium pool on higher plans.
 *
 * Auth is a WorkOS access token (a JWT, ~7 day lifetime) sent as a bearer token.
 * The token can be refreshed from the WorkOS endpoint with the paired refresh
 * token, so an account configured that way keeps working; a bare pasted token
 * works too and simply expires.
 *
 * Two shapes are read, in preference order:
 *   1. `POST /api/organization/subscription/usage` — period allowance + ratio.
 *   2. `GET  /api/billing/limits` — rolling 5h/weekly/monthly limits. Some
 *      accounts (token-rate-limit plans) only expose this one.
 *
 * Both are undocumented internal APIs, so the parser is defensive: it accepts
 * snake_case and camelCase, derives percentages from `usedRatio` when present
 * and from used/allowance otherwise, and reports `unavailable` (not an empty
 * success) when neither shape yields a number.
 */

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const FACTORY_FETCH_TIMEOUT_MS = 12_000;
const FACTORY_API_BASE = 'https://api.factory.ai';
const FACTORY_LIMITS_URL = `${FACTORY_API_BASE}/api/billing/limits`;
const FACTORY_USAGE_URL = `${FACTORY_API_BASE}/api/organization/subscription/usage`;
const FACTORY_WEB_ORIGIN = 'https://app.factory.ai';
// WorkOS client id used by the droid CLI; needed only to refresh a token.
const FACTORY_WORKOS_CLIENT_ID = 'client_01HNM792M5G5G1A2THWPXKFMXB';
const FACTORY_WORKOS_TOKEN_URL = 'https://api.workos.com/user_management/authenticate';

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
 * Resolve the Factory credential. An API key (`fk-...`) may be pasted directly;
 * a WorkOS JWT is also accepted and can be refreshed when a refresh token is
 * supplied alongside it.
 */
function factoryCredential(options = {}) {
  const token = cleanSecret(options.factoryApiKey || options.factoryAccessToken);
  if (!token || hasControlCharacters(token)) return null;
  return {
    token,
    refreshToken: cleanSecret(options.factoryRefreshToken) || null
  };
}

function hasFactoryCredentials(options = {}) {
  return Boolean(factoryCredential(options));
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
  const numeric = numberOrNull(value);
  if (numeric !== null) {
    // Unix milliseconds (the API's own unit); seconds are tolerated for safety.
    const ms = numeric > 0 && numeric < 1e12 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return null;
}

/** Plan tier is inferred from the standard allowance, since the API omits a name. */
function factoryPlanFor(allowance) {
  if (allowance === null) return null;
  if (allowance >= 200_000_000) return 'Max';
  if (allowance >= 20_000_000) return 'Pro';
  if (allowance > 0) return 'Basic';
  return null;
}

function poolWindow(label, pool, resetsAt) {
  if (!pool || typeof pool !== 'object') return null;
  const allowance = numberOrNull(pool.totalAllowance ?? pool.total_allowance)
    ?? numberOrNull(pool.basicAllowance ?? pool.basic_allowance);
  const used = numberOrNull(pool.orgTotalTokensUsed ?? pool.org_total_tokens_used)
    ?? numberOrNull(pool.userTokens ?? pool.user_tokens);
  const ratio = numberOrNull(pool.usedRatio ?? pool.used_ratio);
  if (allowance === null && used === null && ratio === null) return null;
  // A pool the plan does not include comes back fully zeroed (premium on
  // Pro/Basic). Treating that as a window would render a permanently exhausted
  // card for an allowance the account simply does not have.
  const isZeroedPool = (allowance === null || allowance === 0)
    && (used === null || used === 0)
    && (ratio === null || ratio === 0);
  if (isZeroedPool) return null;

  // The API's own ratio is authoritative when present; otherwise derive it.
  const usedPercent = ratio !== null
    ? clampPercent(ratio <= 1 ? ratio * 100 : ratio)
    : (allowance !== null && allowance > 0 && used !== null
      ? clampPercent((used / allowance) * 100)
      : null);

  return {
    kind: 'billing',
    label,
    ...(used !== null ? { used } : {}),
    ...(allowance !== null ? { limit: allowance } : {}),
    ...(usedPercent !== null ? { usedPercent } : {}),
    // Without a positive denominator there is no meter to draw; showing an
    // empty bar would read as an exhausted allowance.
    showMeter: usedPercent !== null && allowance !== null && allowance > 0,
    ...(resetsAt ? { resetsAt } : {}),
    ...(() => {
      const overage = numberOrNull(pool.orgOverageUsed ?? pool.org_overage_used);
      return overage && overage > 0 ? { detail: `${overage} overage tokens used` } : {};
    })()
  };
}

/** Parse the subscription-usage shape into windows (one per token pool). */
function parseFactoryUsage(body) {
  const usage = body && typeof body === 'object' ? (body.usage || body.data || body) : null;
  if (!usage || typeof usage !== 'object') return { windows: [], plan: null, resetsAt: null };
  const resetsAt = toIso(usage.endDate ?? usage.end_date);
  const windows = [
    poolWindow('Standard', usage.standard, resetsAt),
    poolWindow('Premium', usage.premium, resetsAt)
  ].filter(Boolean);
  const standard = usage.standard || {};
  const plan = factoryPlanFor(numberOrNull(standard.totalAllowance ?? standard.total_allowance));
  return { windows, plan, resetsAt };
}

/**
 * Parse the rolling-limits shape (`/api/billing/limits`). Only the windows the
 * payload actually names are emitted, so an unknown future label cannot produce
 * a phantom row.
 */
function parseFactoryLimits(body) {
  const root = body && typeof body === 'object' ? body : null;
  if (!root) return [];
  const candidates = [
    ['5-hour', ['fiveHour', 'five_hour', 'session', 'fiveHourLimit']],
    ['Weekly', ['weekly', 'week', 'weeklyLimit']],
    ['Monthly', ['monthly', 'month', 'monthlyLimit']]
  ];
  const windows = [];
  for (const [label, keys] of candidates) {
    let bucket = null;
    for (const key of keys) {
      if (root[key] && typeof root[key] === 'object') { bucket = root[key]; break; }
    }
    if (!bucket) continue;
    const window = poolWindow(label, bucket, toIso(bucket.resetAt ?? bucket.reset_at ?? bucket.resetsAt));
    if (!window) continue;
    // Rolling limits are cadence windows, not billing allowances.
    windows.push({ ...window, kind: label === 'Weekly' ? 'weekly' : label === 'Monthly' ? 'billing' : 'session' });
  }
  return windows;
}

/**
 * Refresh a WorkOS access token. Only used when a refresh token is configured;
 * the refreshed pair is returned so the caller can reuse the new token for this
 * probe (the Hub re-reads its stored credential on the next tick).
 */
async function refreshFactoryToken(refreshToken, deps = {}) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: FACTORY_WORKOS_CLIENT_ID
  }).toString();
  const response = await (deps.fetch || fetch)(FACTORY_WORKOS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: deps.signal
  });
  if (!response.ok) {
    const error = new Error(`Factory token refresh failed with ${response.status}`);
    error.status = response.status === 401 || response.status === 403 ? 'unauthorized' : 'unavailable';
    throw error;
  }
  const json = await response.json();
  const accessToken = cleanSecret(json?.access_token);
  if (!accessToken) {
    throw Object.assign(new Error('Factory token refresh returned no access token'), { status: 'unavailable' });
  }
  return { accessToken, refreshToken: cleanSecret(json?.refresh_token) || refreshToken };
}

function mapFactoryErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function fetchFactoryLimits(options = {}, deps = {}) {
  const nowMs = (deps.now || Date.now)();
  const updatedAt = new Date(nowMs).toISOString();
  const credential = factoryCredential(options);
  if (!credential) {
    return normalizeLimitProvider({
      provider: 'droid',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  const requestJson = async (url, token, init = {}, signal) => {
    const response = await (deps.fetch || fetch)(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: FACTORY_WEB_ORIGIN,
        Referer: `${FACTORY_WEB_ORIGIN}/`,
        ...(init.headers || {})
      },
      signal
    });
    if (response.status === 401 || response.status === 403) {
      const error = new Error(`Factory returned ${response.status}`);
      error.status = 'unauthorized';
      throw error;
    }
    if (response.status === 429) {
      const error = new Error('Factory returned 429');
      error.status = 'sourceRateLimited';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Factory returned ${response.status}`);
      error.status = 'unavailable';
      throw error;
    }
    return response.json();
  };

  try {
    const outcome = await runWithProbeDeadline(async ({ signal }) => {
      let token = credential.token;
      // Refresh proactively only when a refresh token exists; a bare API key
      // has nothing to refresh.
      if (credential.refreshToken) {
        try {
          const refreshed = await refreshFactoryToken(credential.refreshToken, { ...deps, signal });
          token = refreshed.accessToken;
        } catch (_) {
          // A failed refresh must not lose a still-valid pasted token; the
          // request below may yet succeed, and a 401 surfaces as unauthorized.
        }
      }

      // The subscription-usage shape carries the plan allowance; the rolling
      // limits shape covers token-rate-limit plans. Query usage first and fall
      // back so one failing endpoint cannot blank the whole provider — but an
      // Auth and rate-limit failures must propagate: retrying the other shape
      // with the same rejected credential (or inside the same rate limit) would
      // only turn a clear "re-authenticate"/"rate limited" into "unavailable".
      // Only a shape/parse failure is worth trying against the other endpoint.
      const fallbackable = (error) => error?.status !== 'unauthorized' && error?.status !== 'sourceRateLimited';
      const usage = await requestJson(FACTORY_USAGE_URL, token, {
        method: 'POST',
        body: JSON.stringify({ useCache: true })
      }, signal).catch((error) => {
        if (!fallbackable(error)) throw error;
        return null;
      });
      const parsedUsage = parseFactoryUsage(usage);
      if (parsedUsage.windows.length) return parsedUsage;

      const limits = await requestJson(FACTORY_LIMITS_URL, token, { method: 'GET' }, signal).catch((error) => {
        if (!fallbackable(error)) throw error;
        return null;
      });
      const windows = parseFactoryLimits(limits);
      return { windows, plan: null, resetsAt: null };
    }, { deadlineMs: Number(deps.fetchTimeoutMs || FACTORY_FETCH_TIMEOUT_MS) });

    if (!outcome.windows.length) {
      throw Object.assign(
        new Error('Factory returned no recognizable usage fields'),
        { status: 'unavailable' }
      );
    }
    return normalizeLimitProvider({
      provider: 'droid',
      accountKey: hashKey('droid', credential.token),
      accountLabel: String(options.factoryAccountLabel || '').trim().slice(0, 128) || 'Droid',
      source: 'api',
      status: 'ok',
      updatedAt,
      ...(outcome.plan ? { planLabel: outcome.plan } : {}),
      windows: outcome.windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'droid',
      source: 'api',
      status: mapFactoryErrorStatus(error),
      updatedAt,
      windows: []
    });
  }
}

module.exports = {
  FACTORY_API_BASE,
  FACTORY_FETCH_TIMEOUT_MS,
  FACTORY_LIMITS_URL,
  FACTORY_USAGE_URL,
  FACTORY_WORKOS_CLIENT_ID,
  fetchFactoryLimits,
  factoryCredential,
  hasFactoryCredentials,
  parseFactoryLimits,
  parseFactoryUsage,
  refreshFactoryToken
};
