'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CLINE_USAGE_URL,
  clineApiKey,
  fetchClineLimits,
  hasClineCredentials,
  parseClineUsage
} = require('../../src/shared/clineLimits');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function usageBody(limits) {
  return { success: true, data: { limits } };
}

const THREE_WINDOWS = [
  { type: 'five_hour', percentUsed: 12.5, resetsAt: '2026-07-01T05:00:00Z' },
  { type: 'weekly', percentUsed: 40, resetsAt: '2026-07-07T00:00:00Z' },
  { type: 'monthly', percentUsed: 80, resetsAt: null }
];

test('cline is in the canonical provider list', () => {
  assert.ok(LIMIT_PROVIDER_IDS.includes('cline'));
});

test('clineApiKey accepts an API key and rejects empty or malformed values', () => {
  assert.equal(clineApiKey({ clineApiKey: 'sk-cline' }), 'sk-cline');
  assert.equal(clineApiKey({ clinepassApiKey: 'sk-pass' }), 'sk-pass');
  assert.equal(clineApiKey({}), '');
  assert.equal(clineApiKey({ clineApiKey: '  ' }), '');
  assert.equal(clineApiKey({ clineApiKey: 'a\nb' }), '');
  assert.equal(hasClineCredentials({ clineApiKey: 'sk-cline' }), true);
});

test('parseClineUsage maps the three named windows onto shared kinds', () => {
  const { windows, malformed } = parseClineUsage(usageBody(THREE_WINDOWS));
  assert.equal(malformed, false);
  assert.deepEqual(windows.map((window) => window.label), ['5-hour', 'Weekly', 'Monthly']);
  assert.deepEqual(windows.map((window) => window.kind), ['session', 'weekly', 'billing']);
  assert.deepEqual(windows.map((window) => window.windowMinutes), [300, 10080, 43200]);
  assert.deepEqual(windows.map((window) => window.usedPercent), [12.5, 40, 80]);
  assert.equal(windows[0].resetsAt, '2026-07-01T05:00:00.000Z');
});

// A null reset is a real state (no scheduled reset), not a broken payload.
test('parseClineUsage treats a null resetsAt as valid and omits the field', () => {
  const { windows, malformed } = parseClineUsage(usageBody([
    { type: 'monthly', percentUsed: 80, resetsAt: null }
  ]));
  assert.equal(malformed, false);
  assert.equal(windows.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(windows[0], 'resetsAt'), false);
});

test('parseClineUsage flags a malformed entry instead of silently dropping it', () => {
  const bad = parseClineUsage(usageBody([{ type: 'weekly', percentUsed: 'lots', resetsAt: null }]));
  assert.equal(bad.malformed, true);
  assert.equal(bad.windows.length, 0);
  const badTime = parseClineUsage(usageBody([{ type: 'weekly', percentUsed: 1, resetsAt: 'not-a-date' }]));
  assert.equal(badTime.malformed, true);
});

test('parseClineUsage clamps out-of-range percentages and skips unknown types', () => {
  const { windows } = parseClineUsage(usageBody([
    { type: 'weekly', percentUsed: 150, resetsAt: null },
    { type: 'five_hour', percentUsed: -5, resetsAt: null },
    { type: 'fortnightly', percentUsed: 10, resetsAt: null }
  ]));
  assert.deepEqual(windows.map((window) => window.usedPercent), [100, 0]);
  assert.equal(windows.length, 2);
});

test('parseClineUsage returns nothing for an unrecognized body', () => {
  assert.deepEqual(parseClineUsage(null).windows, []);
  assert.deepEqual(parseClineUsage({}).windows, []);
  assert.deepEqual(parseClineUsage({ data: { limits: 'nope' } }).windows, []);
});

// Cline reports percentages only, so there is no absolute used/limit to carry.
test('parseClineUsage produces percent-only windows', () => {
  const { windows } = parseClineUsage(usageBody(THREE_WINDOWS));
  for (const window of windows) {
    assert.equal(window.used, undefined);
    assert.equal(window.limit, undefined);
    assert.equal(window.remaining, undefined);
    assert.equal(window.showMeter, true);
  }
});

test('fetchClineLimits reports notConfigured without a key', async () => {
  const result = await fetchClineLimits({}, {});
  assert.equal(result.provider, 'cline');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchClineLimits sends the bearer key and normalizes the windows', async () => {
  let seen = null;
  const result = await fetchClineLimits({ clineApiKey: 'sk-test' }, {
    fetch: async (url, init) => {
      seen = { url, auth: init.headers.Authorization };
      return jsonResponse(usageBody(THREE_WINDOWS));
    }
  });
  assert.equal(seen.url, CLINE_USAGE_URL);
  assert.equal(seen.auth, 'Bearer sk-test');
  assert.equal(result.status, 'ok');
  assert.equal(result.windows.length, 3);
  assert.ok(result.accountKey, 'expected a hashed account key');
});

test('fetchClineLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchClineLimits({ clineApiKey: 'sk-x' }, {
    fetch: async () => jsonResponse({}, status)
  });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchClineLimits reports unavailable for an empty or malformed payload', async () => {
  const empty = await fetchClineLimits({ clineApiKey: 'sk-x' }, {
    fetch: async () => jsonResponse({ data: { limits: [] } })
  });
  assert.equal(empty.status, 'unavailable');
  const malformed = await fetchClineLimits({ clineApiKey: 'sk-x' }, {
    fetch: async () => jsonResponse(usageBody([{ type: 'weekly', percentUsed: 'x' }]))
  });
  assert.equal(malformed.status, 'unavailable');
});

test('fetchClineLimits survives a network failure', async () => {
  const result = await fetchClineLimits({ clineApiKey: 'sk-x' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(result.status, 'unavailable');
});

test('probeLimitProvider reaches the Cline fetcher for a Hub-supplied key', async () => {
  const rows = await probeLimitProvider('cline', {
    limitProviders: 'cline',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    clineApiKey: 'sk-hub'
  }, {}, {
    fetch: async () => jsonResponse(usageBody(THREE_WINDOWS))
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].windows.length, 3);
});

test('probeLimitProvider returns no rows for Cline without a key', async () => {
  const rows = await probeLimitProvider('cline', {
    limitProviders: 'cline',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('cline must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});
