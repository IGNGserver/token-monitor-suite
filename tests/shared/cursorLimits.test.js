'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { fetchCursorLimits } = require('../../src/shared/limitCollector');

test('fetchCursorLimits returns notConfigured when no active account', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => null
  });
  assert.equal(result.provider, 'cursor');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchCursorLimits returns unauthorized when probe says so', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => ({ id: 'a1', sessionToken: 't', userId: 'u1' }),
    probe: async () => ({ ok: false, error: { kind: 'unauthorized', message: 'HTTP 401' } })
  });
  assert.equal(result.status, 'unauthorized');
});

test('fetchCursorLimits returns ok with Cursor billing dimensions when probe succeeds', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => ({ id: 'acct-1', sessionToken: 't', userId: 'u1' }),
    probe: async () => ({
      ok: true,
      usage: {
        planPercent: 42, autoPercent: 20, apiPercent: 64,
        planUsedUsd: 8.4, planLimitUsd: 20, onDemandUsedUsd: 0, onDemandLimitUsd: 50,
        requestsUsed: 7, requestsLimit: 10,
        billingCycleEnd: '2026-06-01T00:00:00Z', membershipType: 'pro'
      },
      user: { email: 'a@b.com', name: 'Alice', sub: 'u1' }
    })
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.provider, 'cursor');
  assert.equal(result.source, 'web');
  assert.deepEqual(result.windows.map((window) => window.label), ['Total', 'Auto', 'API', 'Credits']);
  assert.equal(result.windows[0].kind, 'billing');
  assert.equal(result.windows[0].usedPercent, 70);
  assert.equal(result.windows[0].used, 7);
  assert.equal(result.windows[0].limit, 10);
  assert.equal(result.windows[0].resetsAt, '2026-06-01T00:00:00.000Z');
  assert.equal(result.windows[1].usedPercent, 20);
  assert.equal(result.windows[2].usedPercent, 64);
  assert.equal(result.windows[3].usedPercent, 0);
  assert.equal(result.windows[3].showMeter, false);
  assert.equal(result.windows[3].remaining, 50);
  assert.equal(result.windows[3].resetDescription, '');
});

test('fetchCursorLimits humanizes underscored membership types for the account label', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => ({ id: 'acct-1', sessionToken: 't', userId: 'u1' }),
    probe: async () => ({
      ok: true,
      usage: { planPercent: 10, membershipType: 'pro_student' },
      user: { email: 'a@b.com', name: 'Alice', sub: 'u1' }
    })
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.accountLabel, 'Pro Student');
});

test('fetchCursorLimits includes team pool when Cursor reports pooled usage', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => ({ id: 'acct-1', sessionToken: 't', userId: 'u1' }),
    probe: async () => ({
      ok: true,
      usage: {
        planPercent: 73.84,
        planUsedUsd: 73.84,
        planLimitUsd: 100,
        planRemainingUsd: 26.16,
        teamPooledPercent: 45.25,
        teamPooledUsedUsd: 127251.35,
        teamPooledLimitUsd: 281220,
        teamPooledRemainingUsd: 153968.65,
        billingCycleEnd: '2026-06-01T00:00:00Z',
        membershipType: 'enterprise',
        hasTeamPooledUsage: true
      },
      user: { email: 'a@b.com', name: 'Alice', sub: 'u1' }
    })
  });

  const pool = result.windows.find((window) => window.label === 'Team pool');
  assert.ok(pool);
  assert.equal(pool.kind, 'billing');
  assert.equal(pool.usedPercent, 45.25);
  assert.equal(pool.used, 127251.35);
  assert.equal(pool.limit, 281220);
  assert.equal(pool.remaining, 153968.65);
});

// Cursor's quota probe is plain HTTP, so the Hub only needs the token. These
// tests pin that an explicitly supplied token is used and that local credential
// discovery is not consulted when one is present.

test('fetchCursorLimits uses a Hub-supplied session token instead of local credentials', async () => {
  let localReads = 0;
  const result = await fetchCursorLimits({ cursorSessionToken: 'hub-token' }, {
    readActiveAccount: () => { localReads += 1; return null; },
    probe: async (token) => {
      assert.equal(token, 'hub-token');
      return { ok: true, usage: { planPercent: 30, billingCycleEnd: '2026-07-01T00:00:00Z' } };
    }
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].usedPercent, 30);
  // The local store must never be consulted once a Hub token is supplied.
  assert.equal(localReads, 0);
});

test('fetchCursorLimits carries the Hub account label onto the row', async () => {
  const result = await fetchCursorLimits({
    cursorSessionToken: 'hub-token',
    cursorAccountLabel: 'work cursor'
  }, {
    readActiveAccount: () => null,
    probe: async () => ({ ok: true, usage: { planPercent: 5 } })
  });
  assert.equal(result.accountLabel, 'work cursor');
});

test('fetchCursorLimits reports notConfigured when neither a Hub token nor a local account exists', async () => {
  const result = await fetchCursorLimits({}, {
    readActiveAccount: () => null,
    probe: async () => { throw new Error('probe must not run without a token'); }
  });
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});
