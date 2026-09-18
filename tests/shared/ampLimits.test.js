'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AMP_API_URL,
  AMP_SECRETS_KEY,
  ampSecretsPath,
  ampApiKey,
  fetchAmpLimits,
  hasAmpCredentials,
  parseAmpDisplayText
} = require('../../src/shared/ampLimits');
const { parseLimitProviders } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function balanceBody(displayText, ok = true) {
  return { ok, result: { display_text: displayText } };
}

test('amp is in the parsed provider set', () => {
  assert.ok(parseLimitProviders().includes('amp'));
});

test('ampApiKey reads the apiKey@https://ampcode.com/ entry from Amp own secrets.json', () => {
  const deps = {
    readFileSync: (p) => {
      assert.equal(p, ampSecretsPath({ homeDir: '/home/alice' }));
      return JSON.stringify({ [AMP_SECRETS_KEY]: '  "amp-key-123"  ' });
    }
  };
  assert.equal(ampApiKey({ homeDir: '/home/alice' }, deps), 'amp-key-123');
  assert.equal(hasAmpCredentials({ homeDir: '/home/alice' }, deps), true);
});

test('ampApiKey treats a missing or malformed secrets file as absent credentials', () => {
  const missing = { readFileSync: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); } };
  assert.equal(ampApiKey({}, missing), '');
  const corrupt = { readFileSync: () => 'not json' };
  assert.equal(ampApiKey({}, corrupt), '');
  const wrongKey = { readFileSync: () => JSON.stringify({ other: 'x' }) };
  assert.equal(ampApiKey({}, wrongKey), '');
});

test('ampApiKey prefers an explicit key over the secrets file', () => {
  const deps = { readFileSync: () => { throw new Error('should not be read'); } };
  assert.equal(ampApiKey({ ampApiKey: 'explicit' }, deps), 'explicit');
  assert.equal(ampApiKey({}, { ...deps, env: { AMP_API_KEY: 'from-env' } }), 'from-env');
});

test('parseAmpDisplayText reads the free-tier grant with a used meter', () => {
  const windows = parseAmpDisplayText('Free tier: $4.50/$20.00 remaining');
  assert.equal(windows.length, 1);
  assert.equal(windows[0].label, 'Free');
  assert.equal(windows[0].remaining, 4.5);
  assert.equal(windows[0].limit, 20);
  assert.equal(windows[0].used, 15.5);
  assert.equal(windows[0].usedPercent, 77.5);
  assert.equal(windows[0].showMeter, true);
  assert.equal(windows[0].currency, 'USD');
});

test('parseAmpDisplayText reads thousands separators', () => {
  const [window] = parseAmpDisplayText('$1,200.00/$2,000.00 remaining');
  assert.equal(window.remaining, 1200);
  assert.equal(window.limit, 2000);
  assert.equal(window.used, 800);
});

test('parseAmpDisplayText derives a reset estimate from the replenish rate', () => {
  const [window] = parseAmpDisplayText('$10.00/$20.00 remaining (+$1.00/hour)');
  assert.equal(window.usedPercent, 50);
  assert.ok(window.resetsAt, 'expected an estimated resetsAt');
  const hours = (Date.parse(window.resetsAt) - Date.now()) / 3600_000;
  // $10 of usage at $1/hour -> about ten hours out.
  assert.ok(hours > 9 && hours < 11, `unexpected reset horizon: ${hours}h`);
});

test('parseAmpDisplayText reads purchased credits as a count-only window', () => {
  const [window] = parseAmpDisplayText('Individual credits: $12.00 remaining');
  assert.equal(window.label, 'Credits');
  assert.equal(window.metric, 'credits');
  assert.equal(window.remaining, 12);
  // No denominator, so no bar: an empty meter would read as an exhausted grant.
  assert.equal(window.showMeter, false);
  assert.equal(window.limit, undefined);
});

test('parseAmpDisplayText reads both windows when the sentence carries both', () => {
  const windows = parseAmpDisplayText('Free: $18.00/$20.00 remaining · Individual credits: $3.25 remaining');
  assert.deepEqual(windows.map((w) => w.label), ['Free', 'Credits']);
});

test('parseAmpDisplayText reports nothing for unrecognized prose rather than guessing', () => {
  assert.deepEqual(parseAmpDisplayText('all systems nominal'), []);
  assert.deepEqual(parseAmpDisplayText(''), []);
  assert.deepEqual(parseAmpDisplayText(null), []);
  // A zero denominator must not produce a division-by-zero meter.
  assert.deepEqual(parseAmpDisplayText('$5.00/$0.00 remaining'), []);
});

test('fetchAmpLimits reports notConfigured without a key', async () => {
  const result = await fetchAmpLimits({}, { env: {}, readFileSync: () => { throw new Error('ENOENT'); } });
  assert.equal(result.provider, 'amp');
  assert.equal(result.status, 'notConfigured');
});

test('fetchAmpLimits posts the balance request and normalizes windows', async () => {
  let seen = null;
  const result = await fetchAmpLimits({ ampApiKey: 'k' }, {
    fetch: async (url, init) => {
      seen = { url, init };
      return jsonResponse(balanceBody('Free tier: $4.50/$20.00 remaining'));
    }
  });
  assert.equal(seen.url, AMP_API_URL);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer k');
  assert.deepEqual(JSON.parse(seen.init.body), { method: 'userDisplayBalanceInfo', params: {} });
  assert.equal(result.status, 'ok');
  assert.equal(result.planLabel, 'Free');
  assert.equal(result.windows.length, 1);
  assert.ok(result.accountKey, 'expected a hashed account key');
});

test('fetchAmpLimits maps an auth-shaped in-body error to unauthorized', async () => {
  const result = await fetchAmpLimits({ ampApiKey: 'k' }, {
    fetch: async () => jsonResponse(balanceBody('Please log in to continue', false))
  });
  assert.equal(result.status, 'unauthorized');
});

test('fetchAmpLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchAmpLimits({ ampApiKey: 'k' }, { fetch: async () => jsonResponse({}, status) });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchAmpLimits reports unavailable when the wording is no longer parseable', async () => {
  const result = await fetchAmpLimits({ ampApiKey: 'k' }, {
    fetch: async () => jsonResponse(balanceBody('a brand new sentence'))
  });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.windows, []);
});

test('fetchAmpLimits survives a network failure', async () => {
  const result = await fetchAmpLimits({ ampApiKey: 'k' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(result.status, 'unavailable');
});
