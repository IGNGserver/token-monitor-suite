'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  qoderCookie,
  qoderCookieMode,
  qoderSite,
  qoderUsageUrl,
  qoderUserPlanUrl,
  parseQoderPlanLabel,
  parseQoderUsage,
  fetchQoderLimits,
  normalizeQoderCookieMode
} = require('../../src/shared/qoderLimits');
const { hashKey } = require('../../src/shared/hashKey');

test('qoderCookie reads settings before env and trims quoted cookies', () => {
  assert.equal(qoderCookie({ QODER_COOKIE: 'env-cookie' }, { qoderCookie: '  "settings-cookie"  ' }), 'settings-cookie');
  assert.equal(qoderCookie({ QODER_COOKIE: '  "env-cookie"  ' }), 'env-cookie');
  assert.equal(qoderCookie({ TOKEN_MONITOR_QODER_COOKIE: 'tm-cookie' }), 'tm-cookie');
  assert.equal(qoderCookie({}), '');
});

test('qoderSite maps global and China dashboard hosts', () => {
  assert.equal(qoderSite({ qoderSite: 'cn' }), 'cn');
  assert.equal(qoderSite({ qoderSite: 'china' }), 'cn');
  assert.equal(qoderSite({ qoderSite: 'https://qoder.com.cn/account/usage' }), 'cn');
  assert.equal(qoderSite({ qoderSite: 'global' }), 'global');
  assert.equal(qoderUsageUrl('cn'), 'https://qoder.com.cn/api/v2/me/usages/big_model_credits');
  assert.equal(qoderUserPlanUrl('cn'), 'https://qoder.com.cn/api/v1/me/userplan');
});

test('parseQoderPlanLabel maps official plan tiers to display labels', () => {
  assert.equal(parseQoderPlanLabel({ data: { plan_tier: 'PLAN_TIER_PRO_PLUS' } }), 'Pro+');
  assert.equal(parseQoderPlanLabel({ data: { subscription: { planTier: 'PLAN_TIER_ULTRA' } } }), 'Ultra');
  assert.equal(parseQoderPlanLabel({ plan_tier: 'PLAN_TIER_FREE' }), 'Community Edition');
  assert.equal(parseQoderPlanLabel({ data: { current_plan: { plan_tier: 'ORGANIZATION_PLAN_TIER_ENTERPRISE' } } }), 'Enterprise');
});

test('parseQoderUsage merges personal and shared big-model credit quotas', () => {
  const usage = parseQoderUsage({
    totalQuota: {
      quotaSummary: {
        usedValue: 25,
        limitValue: 100,
        remainingValue: 75,
        unit: 'credits'
      }
    },
    sharedQuota: {
      quotaSummary: {
        usedValue: 10,
        limitValue: 50,
        remainingValue: 40,
        unit: 'credits'
      }
    },
    nextResetAt: '2026-08-01T00:00:00Z'
  });

  assert.equal(usage.usedCredits, 35);
  assert.equal(usage.totalCredits, 150);
  assert.equal(usage.remainingCredits, 115);
  assert.equal(usage.usagePercentage, 35 / 150 * 100);
  assert.equal(usage.resetsAt, '2026-08-01T00:00:00.000Z');
  assert.equal(usage.window.kind, 'billing');
  assert.equal(usage.window.label, 'Credits');
});

test('parseQoderUsage accepts data-wrapped usage payloads', () => {
  const usage = parseQoderUsage({
    data: {
      total_quota: {
        quota_summary: {
          used_value: 42,
          limit_value: 100,
          remaining_value: 58,
          unit: 'credits'
        }
      },
      next_reset_at: 1780272000
    }
  });

  assert.equal(usage.usedCredits, 42);
  assert.equal(usage.totalCredits, 100);
  assert.equal(usage.remainingCredits, 58);
  assert.equal(usage.resetsAt, '2026-06-01T00:00:00.000Z');
});

test('fetchQoderLimits returns notConfigured without a cookie', async () => {
  const provider = await fetchQoderLimits({}, { env: {}, now: () => Date.parse('2026-07-06T00:00:00Z') });
  assert.equal(provider.provider, 'qoder');
  assert.equal(provider.source, 'web');
  assert.equal(provider.status, 'notConfigured');
});

test('fetchQoderLimits requests the selected site with the dashboard cookie', async () => {
  const requests = [];
  const provider = await fetchQoderLimits(
    { qoderCookie: 'session=abc', qoderSite: 'cn' },
    {
      env: {},
      now: () => Date.parse('2026-07-06T00:00:00Z'),
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        if (String(url).endsWith('/api/v1/me/userplan')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: { plan_tier: 'PLAN_TIER_PRO_PLUS' }
            })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total_quota: {
              quota_summary: {
                used_value: 20,
                limit_value: 100,
                remaining_value: 80,
                usage_percentage: 20,
                unit: 'credits'
              }
            }
          })
        };
      }
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.region, 'cn');
  assert.equal(provider.accountLabel, 'Pro+');
  assert.equal(provider.windows.length, 1);
  assert.equal(requests[0].url, 'https://qoder.com.cn/api/v2/me/usages/big_model_credits');
  assert.equal(requests[1].url, 'https://qoder.com.cn/api/v1/me/userplan');
  assert.equal(requests[0].init.headers.Cookie, 'session=abc');
  assert.equal(requests[0].init.headers.Origin, 'https://qoder.com.cn');
});

test('fetchQoderLimits uses stable identity and metadata from the user-plan response', async () => {
  const provider = await fetchQoderLimits(
    { qoderCookie: 'session=rotated', qoderSite: 'global' },
    {
      env: {},
      fetch: async (url) => {
        if (String(url).endsWith('/api/v1/me/userplan')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { user: { user_id: 'stable-from-plan', email: 'user@example.test' }, plan_tier: 'PLAN_TIER_PRO' } })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total_quota: { quota_summary: { used_value: 1, limit_value: 2, remaining_value: 1 } }
          })
        };
      }
    }
  );

  assert.equal(provider.accountKey, hashKey('qoder-account', 'stable-from-plan'));
  assert.equal(provider.accountEmail, 'user@example.test');
  assert.equal(provider.accountLabel, 'Pro');
});

test('qoder cookie modes normalize legacy aliases and keep env discovery automatic', () => {
  assert.equal(normalizeQoderCookieMode('automatic'), 'auto');
  assert.equal(normalizeQoderCookieMode('manual-only'), 'manual');
  assert.equal(normalizeQoderCookieMode('disabled'), 'off');
  assert.equal(qoderCookieMode({}, {}), 'auto');
  assert.equal(qoderCookieMode({ qoderCookieMode: 'manual' }, { TOKEN_MONITOR_QODER_COOKIE_MODE: 'auto' }), 'manual');
});

test('qoder manual mode ignores env and browser candidates', async () => {
  let imported = false;
  const requests = [];
  const provider = await fetchQoderLimits(
    { qoderCookieMode: 'manual', qoderCookie: 'session=manual', qoderSite: 'global' },
    {
      env: { QODER_COOKIE: 'session=env' },
      importQoderCookies: async () => { imported = true; return [{ cookie: 'session=browser', site: 'global' }]; },
      fetch: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, status: 200, json: async () => ({
          user: { userId: 'stable-user' },
          total_quota: { quota_summary: { used_value: 1, limit_value: 2, remaining_value: 1 } }
        }) };
      }
    }
  );
  assert.equal(imported, false);
  assert.equal(provider.status, 'ok');
  assert.equal(provider.credentialOrigin, 'manual');
  assert.equal(provider.accountKey.startsWith('sha256:'), true);
  assert.equal(requests[0].init.headers.Cookie, 'session=manual');
});

test('generic provider manual-only policy preserves explicit Qoder Cookie but blocks auto candidates', async () => {
  let imported = false;
  const requests = [];
  const provider = await fetchQoderLimits(
    {
      qoderCookieMode: 'auto',
      qoderCookie: 'session=manual',
      suppressAutoDetectedAccounts: true,
      qoderSite: 'global'
    },
    {
      env: { QODER_COOKIE: 'session=env' },
      importQoderCookies: async () => {
        imported = true;
        return [{ cookie: 'session=browser', site: 'global' }];
      },
      fetch: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, status: 200, json: async () => ({
          user: { userId: 'manual-user' },
          total_quota: { quota_summary: { used_value: 1, limit_value: 2, remaining_value: 1 } }
        }) };
      }
    }
  );

  assert.equal(imported, false);
  assert.equal(provider.status, 'ok');
  assert.equal(provider.credentialOrigin, 'manual');
  assert.equal(requests[0].init.headers.Cookie, 'session=manual');
});

test('qoder manual mode does not resurrect an automatic cache', async () => {
  const requests = [];
  const provider = await fetchQoderLimits(
    { qoderCookieMode: 'manual' },
    {
      env: {},
      qoderCookieCache: [{ cookie: 'session=automatic', site: 'global', source: 'chrome' }],
      fetch: async (_url, init) => {
        requests.push(init.headers.Cookie);
        return { ok: true, status: 200, json: async () => ({
          user: { userId: 'manual-user' },
          total_quota: { quota_summary: { used_value: 1, limit_value: 2, remaining_value: 1 } }
        }) };
      }
    }
  );
  assert.equal(provider.status, 'notConfigured');
  assert.deepEqual(requests, []);
});

test('qoder auto mode drops an invalid cached candidate and uses the next candidate', async () => {
  const cache = [{ cookie: 'session=expired', site: 'cn', source: 'chrome', validatedAt: '2026-07-01T00:00:00Z' }];
  const persisted = [];
  const cookies = [];
  const provider = await fetchQoderLimits(
    { qoderCookieMode: 'auto' },
    {
      env: {},
      now: () => Date.parse('2026-07-06T00:00:00Z'),
      qoderCookieCache: cache,
      readQoderCookieCache: () => cache,
      writeQoderCookieCache: (next) => { persisted.push(next); cache.splice(0, cache.length, ...next); },
      importQoderCookies: async () => [{ cookie: 'session=fresh', site: 'cn', source: 'chrome', profile: 'Default' }],
      fetch: async (url, init) => {
        cookies.push(init.headers.Cookie);
        if (init.headers.Cookie === 'session=expired') return { ok: false, status: 401, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({
          data: {
            user: { id: 'stable-user' },
            total_quota: { quota_summary: { used_value: 10, limit_value: 100, remaining_value: 90 } }
          }
        }) };
      }
    }
  );
  assert.equal(provider.status, 'ok');
  assert.equal(provider.credentialOrigin, 'automatic');
  assert.equal(provider.region, 'cn');
  assert.deepEqual(cookies.slice(0, 2), ['session=expired', 'session=fresh']);
  assert.equal(persisted.length >= 2, true, 'invalid cache removal and valid cache write are both persisted');
  assert.match(cache[0].cookie, /session=fresh/);
});

test('qoder off mode never makes a network request', async () => {
  let requests = 0;
  const provider = await fetchQoderLimits({ qoderCookieMode: 'off', qoderCookie: 'session=manual' }, {
    fetch: async () => { requests += 1; throw new Error('must not fetch'); }
  });
  assert.equal(provider.status, 'disabled');
  assert.equal(requests, 0);
});
