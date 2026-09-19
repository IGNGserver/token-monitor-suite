'use strict';

/**
 * Google Gemini Code Assist subscription-usage adapter.
 *
 * Quota comes from Google's Code Assist backend, which is the same service the
 * Gemini CLI talks to. Two calls, in order:
 *
 *   1. `v1internal:loadCodeAssist` — resolves the tier and the Cloud project id.
 *   2. `v1internal:retrieveUserQuota` — the actual per-model remaining quota.
 *
 * Auth is an OAuth access token plus its refresh token (the pair the Gemini CLI
 * stores in `~/.gemini/oauth_creds.json`). The refresh flow uses Google's token
 * endpoint, so a Hub account keeps working without the user re-pasting.
 *
 * ⚠️ IMPORTANT SCOPE LIMIT — Google retired the *consumer* tiers on 2026-06-18:
 * "Gemini Code Assist for individuals", Google AI Pro and Google AI Ultra —
 * explicitly including Gemini CLI — stopped being served. Only Code Assist
 * Standard / Enterprise and Workspace/education accounts still have quota. A
 * retired account answers `loadCodeAssist` with HTTP 200 but **no `currentTier`**
 * and an `ineligibleTiers[]` entry whose `reasonCode` is `UNSUPPORTED_CLIENT`,
 * and `retrieveUserQuota` then fails with 403 `SUBSCRIPTION_REQUIRED`.
 *
 * That case is surfaced as its own `unsupported` status rather than a generic
 * error, so the UI can tell the user to move to Antigravity (which replaced the
 * consumer tiers) instead of showing an unexplained failure.
 */

const { normalizeLimitProvider } = require('./limits');
const { hashKey } = require('./hashKey');
const { runWithProbeDeadline } = require('./probeDeadline');

const GEMINI_FETCH_TIMEOUT_MS = 15_000;
const GEMINI_CODE_ASSIST_BASE = 'https://cloudcode-pa.googleapis.com/v1internal';
const GEMINI_LOAD_CODE_ASSIST_URL = `${GEMINI_CODE_ASSIST_BASE}:loadCodeAssist`;
const GEMINI_RETRIEVE_QUOTA_URL = `${GEMINI_CODE_ASSIST_BASE}:retrieveUserQuota`;
const GEMINI_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Google's token endpoint requires an OAuth client id AND secret to redeem a
// refresh token: a client-id-only (PKCE public client) request is rejected with
// `client_secret is missing`, verified against the live endpoint. Renewal
// therefore cannot work without one, and this adapter deliberately does NOT ship
// Google's own client credentials to supply it — those belong to Google's
// `gemini-cli` project, and bundling them would make every install authenticate
// as someone else's OAuth client. (GitHub's push protection flags them for the
// same reason.)
//
// The operator registers their own client instead. These are read from the
// process environment rather than the per-probe `deps.env`, because the Hub
// blanks that when probing to stop ACCOUNT credentials being auto-detected from
// its environment. This is not an account credential: it is provider-wide
// application configuration, the same category as the proxy settings
// outboundFetch() reads from process.env. .env.example and docs/hub-compose.md
// document how to register and set it.
const GEMINI_OAUTH_CLIENT_ID_ENV = 'GEMINI_OAUTH_CLIENT_ID';
const GEMINI_OAUTH_CLIENT_SECRET_ENV = 'GEMINI_OAUTH_CLIENT_SECRET';

function cleanSecret(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

/**
 * Resolve the operator-supplied OAuth client, or null when it is not configured.
 * Missing and whitespace-only values are both treated as absent, so a placeholder
 * left in .env fails as "not configured" rather than as a confusing Google error.
 */
function geminiOAuthClient(env = process.env) {
  const clientId = cleanSecret(env?.[GEMINI_OAUTH_CLIENT_ID_ENV]);
  const clientSecret = cleanSecret(env?.[GEMINI_OAUTH_CLIENT_SECRET_ENV]);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function hasControlCharacters(text) {
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Resolve the OAuth pair; an explicit access token alone is also accepted. */
function geminiCredential(options = {}) {
  const accessToken = cleanSecret(options.geminiAccessToken);
  const refreshToken = cleanSecret(options.geminiRefreshToken);
  if (!accessToken && !refreshToken) return null;
  if (hasControlCharacters(accessToken) || hasControlCharacters(refreshToken)) return null;
  return { accessToken, refreshToken };
}

function hasGeminiCredentials(options = {}) {
  return Boolean(geminiCredential(options));
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
 * Detect the retired-consumer-tier signal. Google answers 200 with no
 * `currentTier` and marks the account ineligible, which is otherwise
 * indistinguishable from a malformed response.
 */
function geminiTierUnsupported(loadBody) {
  if (!loadBody || typeof loadBody !== 'object') return false;
  if (loadBody.currentTier) return false;
  const ineligible = Array.isArray(loadBody.ineligibleTiers) ? loadBody.ineligibleTiers : [];
  return ineligible.some((tier) => String(tier?.reasonCode || '').toUpperCase() === 'UNSUPPORTED_CLIENT');
}

function geminiPlanLabel(loadBody) {
  if (!loadBody || typeof loadBody !== 'object') return null;
  const tier = loadBody.currentTier;
  const paid = loadBody.paidTier;
  const name = (paid && typeof paid === 'object' ? paid.name : null)
    || (tier && typeof tier === 'object' ? (tier.name || tier.id) : null);
  return name ? String(name).trim().slice(0, 128) || null : null;
}

/**
 * Parse the quota buckets into windows. Each bucket is one model's remaining
 * fraction, so a bucket becomes a window labelled by its model.
 */
function parseGeminiQuota(body) {
  const buckets = body && typeof body === 'object' && Array.isArray(body.buckets) ? body.buckets : [];
  const windows = [];
  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== 'object') continue;
    const fraction = numberOrNull(bucket.remainingFraction);
    // `remainingAmount` is the fallback when no fraction is published.
    const remainingAmount = numberOrNull(bucket.remainingAmount);
    if (fraction === null && remainingAmount === null) continue;
    const label = String(bucket.modelId || bucket.model_id || 'Gemini').trim() || 'Gemini';
    const usedPercent = fraction !== null ? clampPercent((1 - fraction) * 100) : null;
    const resetsAt = toIso(bucket.resetTime ?? bucket.reset_time);
    windows.push({
      kind: 'billing',
      label,
      ...(usedPercent !== null ? { usedPercent } : {}),
      ...(remainingAmount !== null ? { remaining: remainingAmount } : {}),
      showMeter: usedPercent !== null,
      ...(resetsAt ? { resetsAt } : {}),
      ...(bucket.tokenType || bucket.token_type
        ? { detail: String(bucket.tokenType ?? bucket.token_type) }
        : {})
    });
  }
  return windows;
}

function mapGeminiErrorStatus(error) {
  const status = error && error.status;
  if (['disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error'].includes(status)) return status;
  return 'unavailable';
}

async function refreshGeminiToken(refreshToken, deps = {}) {
  // Always process.env: the Hub blanks deps.env while probing, which is correct
  // for account credentials but would hide this operator-level client config.
  const client = geminiOAuthClient(deps.processEnv || process.env);
  if (!client) {
    // `notConfigured` is the honest status: there is nothing wrong with the
    // account, and the fix is for the operator to set the two env vars.
    throw Object.assign(
      new Error(`Gemini token renewal needs ${GEMINI_OAUTH_CLIENT_ID_ENV} and ${GEMINI_OAUTH_CLIENT_SECRET_ENV}`),
      { status: 'notConfigured' }
    );
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret
  }).toString();
  const response = await (deps.fetch || fetch)(GEMINI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: deps.signal
  });
  if (!response.ok) {
    const error = new Error(`Gemini token refresh failed with ${response.status}`);
    error.status = response.status === 400 || response.status === 401 ? 'unauthorized' : 'unavailable';
    throw error;
  }
  const json = await response.json();
  const accessToken = cleanSecret(json?.access_token);
  if (!accessToken) {
    throw Object.assign(new Error('Gemini token refresh returned no access token'), { status: 'unavailable' });
  }
  return { accessToken, refreshToken: cleanSecret(json?.refresh_token) || refreshToken };
}

async function fetchGeminiLimits(options = {}, deps = {}) {
  const nowMs = (deps.now || Date.now)();
  const updatedAt = new Date(nowMs).toISOString();
  const credential = geminiCredential(options);
  if (!credential) {
    return normalizeLimitProvider({
      provider: 'gemini',
      source: 'api',
      status: 'notConfigured',
      updatedAt,
      windows: []
    });
  }

  const postJson = async (url, token, body, signal) => {
    const response = await (deps.fetch || fetch)(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body || {}),
      signal
    });
    if (response.status === 401 || response.status === 403) {
      // 403 carries SUBSCRIPTION_REQUIRED for a retired tier; the body decides
      // whether that is "re-authenticate" or "this plan no longer exists".
      let payload = null;
      try { payload = await response.json(); } catch (_) { /* a body-less 401 is still unauthorized */ }
      const reason = String(payload?.error?.status || payload?.error?.details?.[0]?.reason || '').toUpperCase();
      const error = new Error(`Gemini returned ${response.status}`);
      error.status = 'unauthorized';
      if (reason === 'SUBSCRIPTION_REQUIRED') error.retired = true;
      throw error;
    }
    if (response.status === 429) {
      const error = new Error('Gemini returned 429');
      error.status = 'sourceRateLimited';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Gemini returned ${response.status}`);
      error.status = 'unavailable';
      throw error;
    }
    return response.json();
  };

  try {
    const outcome = await runWithProbeDeadline(async ({ signal }) => {
      let token = credential.accessToken;
      // Without an access token the only way in is the refresh flow.
      if (!token && credential.refreshToken) {
        const refreshed = await refreshGeminiToken(credential.refreshToken, { ...deps, signal });
        token = refreshed.accessToken;
      }

      const load = await postJson(GEMINI_LOAD_CODE_ASSIST_URL, token, {
        metadata: { ideType: 'GEMINI_CLI', pluginType: 'GEMINI' }
      }, signal);
      if (geminiTierUnsupported(load)) {
        throw Object.assign(
          new Error('This Gemini plan is no longer served; use Antigravity instead'),
          // The shared schema has no `unsupported` status, and a retired tier is
          // an action for the user (move to Antigravity), so it reuses the
          // actionable `unauthorized` rendering and carries `retired` in `region`
          // to stay machine-distinguishable from a merely stale token.
          { status: 'unauthorized', retired: true }
        );
      }

      const project = load?.cloudaicompanionProject
        || (typeof load?.cloudaicompanionProject === 'object' ? load.cloudaicompanionProject?.id : null);
      const quota = await postJson(
        GEMINI_RETRIEVE_QUOTA_URL,
        token,
        project ? { project: String(project) } : {},
        signal
      );
      return { quota, plan: geminiPlanLabel(load) };
    }, { deadlineMs: Number(deps.fetchTimeoutMs || GEMINI_FETCH_TIMEOUT_MS) });

    const windows = parseGeminiQuota(outcome.quota);
    if (!windows.length) {
      throw Object.assign(
        new Error('Gemini returned no quota buckets'),
        { status: 'unavailable' }
      );
    }
    return normalizeLimitProvider({
      provider: 'gemini',
      accountKey: hashKey('gemini', credential.refreshToken || credential.accessToken),
      accountLabel: String(options.geminiAccountLabel || '').trim().slice(0, 128) || 'Gemini',
      source: 'api',
      status: 'ok',
      updatedAt,
      ...(outcome.plan ? { planLabel: outcome.plan } : {}),
      windows
    });
  } catch (error) {
    return normalizeLimitProvider({
      provider: 'gemini',
      source: 'api',
      status: mapGeminiErrorStatus(error),
      updatedAt,
      ...(error?.retired ? { region: 'retired' } : {}),
      windows: []
    });
  }
}

module.exports = {
  GEMINI_CODE_ASSIST_BASE,
  GEMINI_FETCH_TIMEOUT_MS,
  GEMINI_LOAD_CODE_ASSIST_URL,
  GEMINI_RETRIEVE_QUOTA_URL,
  GEMINI_TOKEN_URL,
  fetchGeminiLimits,
  GEMINI_OAUTH_CLIENT_ID_ENV,
  GEMINI_OAUTH_CLIENT_SECRET_ENV,
  geminiCredential,
  geminiOAuthClient,
  geminiPlanLabel,
  geminiTierUnsupported,
  hasGeminiCredentials,
  parseGeminiQuota,
  refreshGeminiToken
};
