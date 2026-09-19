'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  KILO_PROCEDURES,
  kiloApiKey,
  fetchKiloLimits,
  hasKiloCredentials,
  kiloCreditWindows,
  kiloPassWindow,
  kiloTrpcUrl,
  parseKiloUsage
} = require('../../src/shared/kiloLimits');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// tRPC's httpBatchLink answers with a positional array, each entry wrapping its
// payload in `result.data.json`.
function batch(...payloads) {
  return payloads.map((payload) => (payload === undefined
    ? { error: { message: 'not found', data: { httpStatus: 404 } } }
    : { result: { data: { json: payload } } }));
}

const CREDIT_BLOCKS = { creditBlocks: [{ amount_mUsd: 10_000_000, balance_mUsd: 4_000_000 }] };
const KILO_PASS = {
  subscription: {
    currentPeriodUsageUsd: 5,
    currentPeriodBaseCreditsUsd: 20,
    currentPeriodBonusCreditsUsd: 0,
    tier: 'tier_49',
    nextBillingAt: '2026-08-01T00:00:00Z'
  }
};

test('kilocode is in the canonical provider list', () => {
  assert.ok(LIMIT_PROVIDER_IDS.includes('kilocode'));
});

test('kiloApiKey accepts a key and rejects empty or malformed values', () => {
  assert.equal(kiloApiKey({ kiloApiKey: 'kilo-tok' }), 'kilo-tok');
  assert.equal(kiloApiKey({}), '');
  assert.equal(kiloApiKey({ kiloApiKey: '  ' }), '');
  assert.equal(kiloApiKey({ kiloApiKey: 'a\nb' }), '');
  assert.equal(hasKiloCredentials({ kiloApiKey: 'kilo-tok' }), true);
});

test('kiloTrpcUrl batches the three procedures positionally', () => {
  const url = kiloTrpcUrl();
  assert.ok(url.startsWith('https://app.kilo.ai/api/trpc/'));
  for (const procedure of KILO_PROCEDURES) assert.ok(url.includes(procedure), procedure);
  assert.ok(url.includes('batch=1'));
  const input = JSON.parse(decodeURIComponent(url.split('input=')[1]));
  assert.deepEqual(Object.keys(input), ['0', '1', '2']);
});

test('kiloCreditWindows converts micro-USD into a credit window', () => {
  const [window] = kiloCreditWindows(CREDIT_BLOCKS);
  assert.equal(window.label, 'Credits');
  assert.equal(window.metric, 'credits');
  assert.equal(window.remaining, 4);
  assert.equal(window.limit, 10);
  assert.equal(window.used, 6);
  assert.equal(window.usedPercent, 60);
  assert.equal(window.currency, 'USD');
  assert.equal(window.showMeter, true);
});

// A prepaid pool with no recorded purchase has no denominator to meter.
test('kiloCreditWindows reports a balance without a meter when there is no amount', () => {
  const [window] = kiloCreditWindows({ creditBlocks: [{ balance_mUsd: 2_000_000 }] });
  assert.equal(window.remaining, 2);
  assert.equal(window.limit, undefined);
  assert.equal(window.showMeter, false);
});

test('kiloCreditWindows returns nothing for an empty or unreadable list', () => {
  assert.deepEqual(kiloCreditWindows({ creditBlocks: [] }), []);
  assert.deepEqual(kiloCreditWindows(null), []);
  assert.deepEqual(kiloCreditWindows({ creditBlocks: 'nope' }), []);
});

test('kiloPassWindow reads the period usage and maps the tier label', () => {
  const { window, plan } = kiloPassWindow(KILO_PASS);
  assert.equal(window.label, 'Subscription');
  assert.equal(window.used, 5);
  assert.equal(window.limit, 20);
  assert.equal(window.usedPercent, 25);
  assert.equal(window.resetsAt, '2026-08-01T00:00:00.000Z');
  assert.equal(plan, 'Pro');
});

test('kiloPassWindow includes the bonus credits in the denominator', () => {
  const { window } = kiloPassWindow({
    subscription: { currentPeriodUsageUsd: 5, currentPeriodBaseCreditsUsd: 10, currentPeriodBonusCreditsUsd: 10 }
  });
  assert.equal(window.limit, 20);
  assert.equal(window.usedPercent, 25);
});

test('kiloPassWindow passes through an unknown tier string and returns null when empty', () => {
  assert.equal(kiloPassWindow({ subscription: { currentPeriodUsageUsd: 1, tier: 'tier_999' } }).plan, 'tier_999');
  assert.equal(kiloPassWindow({ subscription: {} }), null);
  assert.equal(kiloPassWindow(null), null);
});

test('parseKiloUsage reads both batch entries and tolerates the optional one', () => {
  const { windows, plan } = parseKiloUsage(batch(CREDIT_BLOCKS, KILO_PASS, undefined));
  assert.deepEqual(windows.map((window) => window.label), ['Credits', 'Subscription']);
  assert.equal(plan, 'Pro');
});

test('parseKiloUsage still returns data when one entry errors', () => {
  const { windows } = parseKiloUsage(batch(undefined, KILO_PASS, undefined));
  assert.deepEqual(windows.map((window) => window.label), ['Subscription']);
});

test('parseKiloUsage propagates an unauthorized batch entry', () => {
  const unauthorized = [{ error: { message: 'bad key', data: { httpStatus: 401 } } }, { result: { data: { json: KILO_PASS } } }];
  assert.throws(() => parseKiloUsage(unauthorized), (error) => error.status === 'unauthorized');
});

test('parseKiloUsage returns nothing for an unrecognized batch', () => {
  assert.deepEqual(parseKiloUsage(null).windows, []);
  assert.deepEqual(parseKiloUsage([]).windows, []);
  assert.deepEqual(parseKiloUsage([{ result: { data: { json: {} } } }]).windows, []);
});

test('fetchKiloLimits reports notConfigured without a key', async () => {
  const result = await fetchKiloLimits({}, {});
  assert.equal(result.provider, 'kilocode');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchKiloLimits sends the bearer key and normalizes both windows', async () => {
  let seen = null;
  const result = await fetchKiloLimits({ kiloApiKey: 'kilo-test' }, {
    fetch: async (url, init) => {
      seen = { url, auth: init.headers.Authorization };
      return jsonResponse(batch(CREDIT_BLOCKS, KILO_PASS, {}));
    }
  });
  assert.match(seen.url, /app\.kilo\.ai\/api\/trpc/);
  assert.equal(seen.auth, 'Bearer kilo-test');
  assert.equal(result.status, 'ok');
  assert.equal(result.planLabel, 'Pro');
  assert.equal(result.windows.length, 2);
  assert.ok(result.accountKey, 'expected a hashed account key');
});

test('fetchKiloLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchKiloLimits({ kiloApiKey: 'k' }, {
    fetch: async () => jsonResponse({}, status)
  });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchKiloLimits reports unavailable for a payload with no usable data', async () => {
  const result = await fetchKiloLimits({ kiloApiKey: 'k' }, {
    fetch: async () => jsonResponse(batch({}, {}, {}))
  });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.windows, []);
});

test('fetchKiloLimits survives a network failure', async () => {
  const result = await fetchKiloLimits({ kiloApiKey: 'k' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(result.status, 'unavailable');
});

test('probeLimitProvider reaches the Kilo fetcher for a Hub-supplied key', async () => {
  const rows = await probeLimitProvider('kilocode', {
    limitProviders: 'kilocode',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    kiloApiKey: 'kilo-hub'
  }, {}, {
    fetch: async () => jsonResponse(batch(CREDIT_BLOCKS, KILO_PASS, {}))
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].windows.length, 2);
});

test('probeLimitProvider returns no rows for Kilo without a key', async () => {
  const rows = await probeLimitProvider('kilocode', {
    limitProviders: 'kilocode',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('kilo must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});
