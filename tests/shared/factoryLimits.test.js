'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FACTORY_USAGE_URL,
  FACTORY_WORKOS_CLIENT_ID,
  fetchFactoryLimits,
  factoryCredential,
  hasFactoryCredentials,
  parseFactoryUsage,
  refreshFactoryToken
} = require('../../src/shared/factoryLimits');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// The live shape: a billing-period allowance with a precomputed ratio.
function usageBody({ standard, premium, endDate = 1772956800000 } = {}) {
  return {
    usage: {
      startDate: 1770623326000,
      endDate,
      standard: standard ?? {
        userTokens: 0,
        orgTotalTokensUsed: 5_000_000,
        orgOverageUsed: 0,
        basicAllowance: 20_000_000,
        totalAllowance: 20_000_000,
        orgOverageLimit: 0,
        usedRatio: 0.25
      },
      premium: premium ?? {
        userTokens: 0,
        orgTotalTokensUsed: 0,
        basicAllowance: 0,
        totalAllowance: 0,
        orgOverageLimit: 0,
        usedRatio: 0
      }
    },
    source: 'cache'
  };
}

test('droid is in the canonical provider list', () => {
  assert.ok(LIMIT_PROVIDER_IDS.includes('droid'));
});

test('factoryCredential accepts an API key or a WorkOS access token', () => {
  assert.deepEqual(factoryCredential({ factoryApiKey: 'fk-abc' }), { token: 'fk-abc', refreshToken: null });
  assert.deepEqual(factoryCredential({ factoryAccessToken: 'jwt.abc' }), { token: 'jwt.abc', refreshToken: null });
  assert.equal(hasFactoryCredentials({ factoryApiKey: 'fk-abc' }), true);
});

test('factoryCredential carries a paired refresh token and rejects junk', () => {
  assert.deepEqual(
    factoryCredential({ factoryAccessToken: 'jwt', factoryRefreshToken: 'rt' }),
    { token: 'jwt', refreshToken: 'rt' }
  );
  assert.equal(factoryCredential({}), null);
  assert.equal(factoryCredential({ factoryApiKey: '  ' }), null);
  assert.equal(factoryCredential({ factoryApiKey: 'a\nb' }), null);
});

test('parseFactoryUsage reads the allowance, ratio, and plan tier', () => {
  const parsed = parseFactoryUsage(usageBody());
  assert.equal(parsed.windows.length, 1);
  const [standard] = parsed.windows;
  assert.equal(standard.label, 'Standard');
  assert.equal(standard.used, 5_000_000);
  assert.equal(standard.limit, 20_000_000);
  assert.equal(standard.usedPercent, 25);
  assert.equal(standard.showMeter, true);
  assert.equal(standard.resetsAt, new Date(1772956800000).toISOString());
  assert.equal(parsed.plan, 'Pro');
});

test('parseFactoryUsage derives the percentage when the ratio is absent', () => {
  const { windows } = parseFactoryUsage(usageBody({
    standard: { orgTotalTokensUsed: 5_000_000, totalAllowance: 20_000_000 }
  }));
  assert.equal(windows[0].usedPercent, 25);
});

test('parseFactoryUsage tolerates a 0-100 ratio as well as a 0-1 ratio', () => {
  assert.equal(parseFactoryUsage(usageBody({ standard: { totalAllowance: 100, usedRatio: 0.5 } })).windows[0].usedPercent, 50);
  assert.equal(parseFactoryUsage(usageBody({ standard: { totalAllowance: 100, usedRatio: 50 } })).windows[0].usedPercent, 50);
});

test('parseFactoryUsage infers each plan tier from the allowance', () => {
  assert.equal(parseFactoryUsage(usageBody({ standard: { totalAllowance: 200_000_000 } })).plan, 'Max');
  assert.equal(parseFactoryUsage(usageBody({ standard: { totalAllowance: 20_000_000 } })).plan, 'Pro');
  assert.equal(parseFactoryUsage(usageBody({ standard: { totalAllowance: 1_000_000 } })).plan, 'Basic');
  assert.equal(parseFactoryUsage(usageBody({ standard: {} })).plan, null);
});

test('parseFactoryUsage emits a Premium window only when that pool is real', () => {
  const withPremium = parseFactoryUsage(usageBody({
    premium: { orgTotalTokensUsed: 1_000, totalAllowance: 5_000, usedRatio: 0.2 }
  }));
  assert.deepEqual(withPremium.windows.map((window) => window.label), ['Standard', 'Premium']);
  // A zeroed premium pool is not a window.
  assert.deepEqual(parseFactoryUsage(usageBody()).windows.map((window) => window.label), ['Standard']);
});

test('parseFactoryUsage reports an overage in the window detail', () => {
  const { windows } = parseFactoryUsage(usageBody({
    standard: { orgTotalTokensUsed: 1, totalAllowance: 100, orgOverageUsed: 42 }
  }));
  assert.match(windows[0].detail, /42 overage tokens used/);
});

test('parseFactoryUsage returns nothing for an unrecognized body', () => {
  assert.deepEqual(parseFactoryUsage(null).windows, []);
  assert.deepEqual(parseFactoryUsage({ usage: {} }).windows, []);
});

test('fetchFactoryLimits reports notConfigured without a credential', async () => {
  const result = await fetchFactoryLimits({}, {});
  assert.equal(result.provider, 'droid');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchFactoryLimits posts the usage query with the bearer token', async () => {
  let seen = null;
  const result = await fetchFactoryLimits({ factoryApiKey: 'fk-test' }, {
    fetch: async (url, init) => {
      seen = { url, auth: init.headers.Authorization, body: init.body };
      return jsonResponse(usageBody());
    }
  });
  assert.equal(seen.url, FACTORY_USAGE_URL);
  assert.equal(seen.auth, 'Bearer fk-test');
  assert.deepEqual(JSON.parse(seen.body), { useCache: true });
  assert.equal(result.status, 'ok');
  assert.equal(result.planLabel, 'Pro');
  assert.ok(result.accountKey, 'expected a hashed account key');
});

test('fetchFactoryLimits falls back to the rolling-limits endpoint', async () => {
  const result = await fetchFactoryLimits({ factoryApiKey: 'fk-test' }, {
    fetch: async (url, init) => {
      // The usage shape carries nothing usable, so the limits shape must be tried.
      if (String(url).includes('subscription/usage')) return jsonResponse({ usage: {} });
      assert.match(String(url), /api\/billing\/limits/);
      assert.equal(init.method, 'GET');
      return jsonResponse({
        fiveHour: { orgTotalTokensUsed: 10, totalAllowance: 100, usedRatio: 0.1 },
        weekly: { orgTotalTokensUsed: 20, totalAllowance: 100, usedRatio: 0.2 }
      });
    }
  });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.windows.map((window) => window.label), ['5-hour', 'Weekly']);
  assert.equal(result.windows[0].kind, 'session');
  assert.equal(result.windows[1].kind, 'weekly');
});

test('fetchFactoryLimits refreshes a WorkOS token when a refresh token is supplied', async () => {
  const calls = [];
  const result = await fetchFactoryLimits({
    factoryAccessToken: 'stale',
    factoryRefreshToken: 'rt-1'
  }, {
    fetch: async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('workos.com')) {
        assert.match(String(init.body), /grant_type=refresh_token/);
        assert.match(String(init.body), new RegExp(FACTORY_WORKOS_CLIENT_ID));
        return jsonResponse({ access_token: 'fresh', refresh_token: 'rt-2' });
      }
      assert.equal(init.headers.Authorization, 'Bearer fresh');
      return jsonResponse(usageBody());
    }
  });
  assert.equal(result.status, 'ok');
  assert.ok(calls.some((url) => url.includes('workos.com')));
});

test('fetchFactoryLimits keeps a usable token when the refresh fails', async () => {
  const result = await fetchFactoryLimits({
    factoryAccessToken: 'still-good',
    factoryRefreshToken: 'rt-bad'
  }, {
    fetch: async (url, init) => {
      if (String(url).includes('workos.com')) return jsonResponse({}, 401);
      assert.equal(init.headers.Authorization, 'Bearer still-good');
      return jsonResponse(usageBody());
    }
  });
  assert.equal(result.status, 'ok');
});

test('refreshFactoryToken rejects a response with no access token', async () => {
  await assert.rejects(
    () => refreshFactoryToken('rt', { fetch: async () => jsonResponse({}) }),
    /no access token/
  );
});

test('fetchFactoryLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchFactoryLimits({ factoryApiKey: 'fk-x' }, {
    fetch: async () => jsonResponse({}, status)
  });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchFactoryLimits survives a network failure and an empty payload', async () => {
  const network = await fetchFactoryLimits({ factoryApiKey: 'fk-x' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(network.status, 'unavailable');
  const empty = await fetchFactoryLimits({ factoryApiKey: 'fk-x' }, {
    fetch: async () => jsonResponse({ usage: {} })
  });
  assert.equal(empty.status, 'unavailable');
  assert.deepEqual(empty.windows, []);
});

test('probeLimitProvider reaches the Droid fetcher for a Hub-supplied token', async () => {
  const rows = await probeLimitProvider('droid', {
    limitProviders: 'droid',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    factoryApiKey: 'fk-hub'
  }, {}, {
    fetch: async () => jsonResponse(usageBody())
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
});

test('probeLimitProvider returns no rows for Droid without a token', async () => {
  const rows = await probeLimitProvider('droid', {
    limitProviders: 'droid',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('droid must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});
