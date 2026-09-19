'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  GEMINI_LOAD_CODE_ASSIST_URL,
  GEMINI_RETRIEVE_QUOTA_URL,
  fetchGeminiLimits,
  geminiCredential,
  geminiPlanLabel,
  geminiTierUnsupported,
  hasGeminiCredentials,
  parseGeminiQuota,
  refreshGeminiToken,
  GEMINI_OAUTH_CLIENT_ID_ENV,
  GEMINI_OAUTH_CLIENT_SECRET_ENV,
  geminiOAuthClient
} = require('../../src/shared/geminiLimits');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const LOAD_OK = {
  currentTier: { id: 'standard', name: 'Code Assist Standard' },
  cloudaicompanionProject: 'my-project-123'
};

const QUOTA_OK = {
  buckets: [
    { modelId: 'gemini-3-pro', tokenType: 'input', remainingFraction: 0.75, resetTime: '2026-08-01T00:00:00Z' },
    { modelId: 'gemini-3-flash', tokenType: 'input', remainingFraction: 0.5 }
  ]
};

// Google answers a retired consumer account with 200 but no currentTier and an
// explicit ineligibility marker.
const LOAD_RETIRED = {
  ineligibleTiers: [{ reasonCode: 'UNSUPPORTED_CLIENT', reasonMessage: 'no longer served' }]
};

function routedFetch({ load = LOAD_OK, quota = QUOTA_OK, quotaStatus = 200 } = {}) {
  return async (url) => {
    if (String(url).includes('loadCodeAssist')) return jsonResponse(load);
    if (String(url).includes('retrieveUserQuota')) return jsonResponse(quota, quotaStatus);
    throw new Error(`unexpected url ${url}`);
  };
}

test('gemini is in the canonical provider list', () => {
  assert.ok(LIMIT_PROVIDER_IDS.includes('gemini'));
});

test('geminiCredential accepts an access token, a refresh token, or both', () => {
  assert.deepEqual(geminiCredential({ geminiAccessToken: 'at' }), { accessToken: 'at', refreshToken: '' });
  assert.deepEqual(geminiCredential({ geminiRefreshToken: 'rt' }), { accessToken: '', refreshToken: 'rt' });
  assert.deepEqual(geminiCredential({ geminiAccessToken: 'at', geminiRefreshToken: 'rt' }), { accessToken: 'at', refreshToken: 'rt' });
  assert.equal(hasGeminiCredentials({ geminiAccessToken: 'at' }), true);
});

test('geminiCredential rejects empty and control-character-bearing values', () => {
  assert.equal(geminiCredential({}), null);
  assert.equal(geminiCredential({ geminiAccessToken: '  ' }), null);
  assert.equal(geminiCredential({ geminiAccessToken: 'a\nb' }), null);
  assert.equal(hasGeminiCredentials({}), false);
});

// The retirement signal is the absence of currentTier plus an explicit
// UNSUPPORTED_CLIENT marker — not merely a missing tier.
test('geminiTierUnsupported detects the retired-consumer-tier signal', () => {
  assert.equal(geminiTierUnsupported(LOAD_RETIRED), true);
  assert.equal(geminiTierUnsupported({ ineligibleTiers: [{ reasonCode: 'SOMETHING_ELSE' }] }), false);
  // A tier-less but otherwise unmarked response is not a retirement.
  assert.equal(geminiTierUnsupported({}), false);
  assert.equal(geminiTierUnsupported(LOAD_OK), false);
  assert.equal(geminiTierUnsupported(null), false);
});

test('geminiPlanLabel prefers the paid tier name and falls back to the tier id', () => {
  assert.equal(geminiPlanLabel(LOAD_OK), 'Code Assist Standard');
  assert.equal(geminiPlanLabel({ paidTier: { name: 'Enterprise' }, currentTier: { id: 'x' } }), 'Enterprise');
  assert.equal(geminiPlanLabel({ currentTier: { id: 'legacy-id' } }), 'legacy-id');
  assert.equal(geminiPlanLabel(null), null);
});

test('parseGeminiQuota turns each bucket into a labelled window', () => {
  const windows = parseGeminiQuota(QUOTA_OK);
  assert.deepEqual(windows.map((window) => window.label), ['gemini-3-pro', 'gemini-3-flash']);
  assert.deepEqual(windows.map((window) => window.usedPercent), [25, 50]);
  assert.equal(windows[0].resetsAt, '2026-08-01T00:00:00.000Z');
  assert.equal(windows[1].resetsAt, undefined);
  assert.equal(windows[0].detail, 'input');
});

test('parseGeminiQuota falls back to remainingAmount and skips unusable buckets', () => {
  const windows = parseGeminiQuota({
    buckets: [
      { modelId: 'm1', remainingAmount: 500 },
      { modelId: 'm2' },
      { modelId: 'm3', remainingFraction: 0 }
    ]
  });
  assert.deepEqual(windows.map((window) => window.label), ['m1', 'm3']);
  assert.equal(windows[0].remaining, 500);
  assert.equal(windows[0].showMeter, false);
  assert.equal(windows[1].usedPercent, 100);
});

test('parseGeminiQuota returns nothing for an unrecognized body', () => {
  assert.deepEqual(parseGeminiQuota(null), []);
  assert.deepEqual(parseGeminiQuota({}), []);
  assert.deepEqual(parseGeminiQuota({ buckets: 'nope' }), []);
});

test('fetchGeminiLimits reports notConfigured without a credential', async () => {
  const result = await fetchGeminiLimits({}, {});
  assert.equal(result.provider, 'gemini');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchGeminiLimits resolves the project then reads the quota', async () => {
  const seen = [];
  const result = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body) });
      return routedFetch()(url, init);
    }
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.planLabel, 'Code Assist Standard');
  assert.equal(result.windows.length, 2);
  assert.ok(result.accountKey, 'expected a hashed account key');
  assert.equal(seen[0].url, GEMINI_LOAD_CODE_ASSIST_URL);
  assert.equal(seen[0].body.metadata.ideType, 'GEMINI_CLI');
  assert.equal(seen[1].url, GEMINI_RETRIEVE_QUOTA_URL);
  // The project id is carried from loadCodeAssist into the quota call.
  assert.equal(seen[1].body.project, 'my-project-123');
});

// This is the whole point of the deprecation handling: a retired consumer plan
// must be distinguishable from a transient failure so the UI can point at
// Antigravity instead of showing a bare error.
test('fetchGeminiLimits marks a retired consumer tier via region:retired', async () => {
  const result = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: routedFetch({ load: LOAD_RETIRED })
  });
  assert.equal(result.status, 'unauthorized');
  assert.equal(result.region, 'retired');
  assert.deepEqual(result.windows, []);
});

test('fetchGeminiLimits also treats a SUBSCRIPTION_REQUIRED 403 as retired', async () => {
  const result = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: async (url) => (String(url).includes('loadCodeAssist')
      ? jsonResponse(LOAD_OK)
      : jsonResponse({ error: { status: 'SUBSCRIPTION_REQUIRED' } }, 403))
  });
  assert.equal(result.status, 'unauthorized');
  assert.equal(result.region, 'retired');
});

// The operator-supplied OAuth client, standing in for the environment.
const OAUTH_CLIENT_ENV = {
  [GEMINI_OAUTH_CLIENT_ID_ENV]: 'client-id.apps.googleusercontent.com',
  [GEMINI_OAUTH_CLIENT_SECRET_ENV]: 'client-secret'
};

test('geminiOAuthClient requires BOTH halves and ignores placeholders', () => {
  assert.deepEqual(
    geminiOAuthClient(OAUTH_CLIENT_ENV),
    { clientId: 'client-id.apps.googleusercontent.com', clientSecret: 'client-secret' }
  );
  // Google rejects a client-id-only redemption, so a half-config is "unset".
  assert.equal(geminiOAuthClient({ [GEMINI_OAUTH_CLIENT_ID_ENV]: 'id' }), null);
  assert.equal(geminiOAuthClient({ [GEMINI_OAUTH_CLIENT_SECRET_ENV]: 'sec' }), null);
  assert.equal(geminiOAuthClient({}), null);
  assert.equal(geminiOAuthClient({ [GEMINI_OAUTH_CLIENT_ID_ENV]: '  ', [GEMINI_OAUTH_CLIENT_SECRET_ENV]: '  ' }), null);
});

test('fetchGeminiLimits refreshes an access token from the refresh token', async () => {
  const calls = [];
  const result = await fetchGeminiLimits({ geminiRefreshToken: 'rt' }, {
    processEnv: OAUTH_CLIENT_ENV,
    fetch: async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('oauth2.googleapis.com')) {
        // The wire form uses the OAuth field names, not our env var names.
        assert.match(init.body, /client_id=client-id\.apps\.googleusercontent\.com/);
        assert.match(init.body, /client_secret=client-secret/);
        return jsonResponse({ access_token: 'fresh', refresh_token: 'rt2' });
      }
      return routedFetch()(url);
    }
  });
  assert.equal(result.status, 'ok');
  assert.ok(calls.some((url) => url.includes('oauth2.googleapis.com')));
});

// Without an operator client there is no way to renew, and the honest status is
// notConfigured: the account is fine, the deployment is missing configuration.
test('a refresh without an operator OAuth client reports notConfigured', async () => {
  const result = await fetchGeminiLimits({ geminiRefreshToken: 'rt' }, {
    processEnv: {},
    fetch: async () => { throw new Error('must not reach the network without a client'); }
  });
  assert.equal(result.status, 'notConfigured');
  assert.deepEqual(result.windows, []);
});

test('an access token still works without an operator OAuth client', async () => {
  // Only RENEWAL needs the client; a pasted access token is used as-is.
  const result = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    processEnv: {},
    fetch: routedFetch()
  });
  assert.equal(result.status, 'ok');
});

test('refreshGeminiToken rejects a response with no access token', async () => {
  await assert.rejects(
    () => refreshGeminiToken('rt', { processEnv: OAUTH_CLIENT_ENV, fetch: async () => jsonResponse({}) }),
    /no access token/
  );
});

test('refreshGeminiToken never bundles a built-in Google client', async () => {
  // Shipping Google's own client credentials would make every install
  // authenticate as someone else's OAuth application, so the module must refuse
  // rather than fall back to one.
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../../src/shared/geminiLimits.js'), 'utf8'
  );
  assert.doesNotMatch(source, /GOCSPX-/);
  assert.doesNotMatch(source, /apps\.googleusercontent\.com';/);
});

test('fetchGeminiLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: async (url) => (String(url).includes('loadCodeAssist')
      ? jsonResponse({}, status)
      : jsonResponse(QUOTA_OK))
  });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchGeminiLimits survives a network failure and an empty quota', async () => {
  const network = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(network.status, 'unavailable');
  const empty = await fetchGeminiLimits({ geminiAccessToken: 'at' }, {
    fetch: routedFetch({ quota: { buckets: [] } })
  });
  assert.equal(empty.status, 'unavailable');
  assert.deepEqual(empty.windows, []);
});

test('probeLimitProvider reaches the Gemini fetcher for a Hub-supplied token', async () => {
  const rows = await probeLimitProvider('gemini', {
    limitProviders: 'gemini',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    geminiAccessToken: 'hub-at'
  }, {}, { fetch: routedFetch() });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].windows.length, 2);
});

test('probeLimitProvider returns no rows for Gemini without a credential', async () => {
  const rows = await probeLimitProvider('gemini', {
    limitProviders: 'gemini',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('gemini must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});
