'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  COMMANDCODE_ALPHA_CREDITS_URL,
  COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL,
  COMMANDCODE_ALPHA_SUMMARY_URL,
  COMMANDCODE_ALPHA_WHOAMI_URL,
  COMMANDCODE_CLI_ENVIRONMENT,
  COMMANDCODE_CLI_VERSION,
  COMMANDCODE_CREDITS_URL,
  COMMANDCODE_PLANS,
  planFor,
  COMMANDCODE_SUBSCRIPTIONS_URL,
  alphaHeaders,
  commandcodeApiKey,
  commandcodeCookie,
  fetchCommandcodeLimits,
  hasCommandcodeCredentials,
  normalizeCommandcodeApiKey,
  normalizeCommandcodeCookieHeader,
  orgLimitWindows,
  parseCommandcodeCredits,
  parseCommandcodeSubscription,
  parseCommandcodeWhoami,
  spendWindows,
  withOrgId
} = require('../../src/shared/commandcodeLimits');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

const SESSION_COOKIE = '__Secure-commandcode_prod_.session_token=tok';
const SESSION_DATA_COOKIE = '__Secure-commandcode_prod_.session_data=data';

// A partly-spent `individual-go` account: the live shape from
// api.commandcode.ai (see the live-capture test below) with the grant drawn
// down, which is the state most of these tests need.
const CREDITS_BODY = {
  credits: {
    belowThreshold: false,
    creditThreshold: 0,
    monthlyCredits: 8.7784,
    purchasedCredits: 0,
    premiumMonthlyCredits: 0,
    opensourceMonthlyCredits: 8.7784
  },
  windowLimits: {
    limited: true,
    exceeded: null,
    fiveHour: { used: 1.2216, cap: 3, exceeded: false, resetAt: 1786700000000 },
    weekly: { used: 1.2216, cap: 6, exceeded: false, resetAt: 1787000000000 }
  }
};

const SUBSCRIPTION_BODY = {
  success: true,
  data: {
    id: 'sub_1TTzt3DSZgxV3MJKG4ClCWpn',
    status: 'active',
    userId: '015d654d-redacted',
    metadata: { commandCode: 'true', commandCodeUserId: '015d654d-redacted' },
    currentPeriodStart: '2026-05-06T07:28:50.000Z',
    currentPeriodEnd: '2026-06-06T07:28:50.000Z',
    planId: 'individual-go'
  }
};

function stubFetch(routes, calls = []) {
  return async (url, init) => {
    const href = String(url);
    calls.push({ url: href, headers: init?.headers || {} });
    const route = routes[href];
    if (typeof route === 'function') return route();
    return { ok: true, status: 200, json: async () => route };
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function windowByKind(provider, kind) {
  return provider.windows.filter((entry) => entry.kind === kind);
}

test('commandcodeCookie prefers settings over env and requires a session cookie', () => {
  assert.equal(
    commandcodeCookie({ COMMANDCODE_COOKIE: `${SESSION_COOKIE}-env` }, { commandcodeCookie: `  "${SESSION_COOKIE}"  ` }),
    SESSION_COOKIE
  );
  assert.equal(commandcodeCookie({ COMMANDCODE_COOKIE: `Cookie: ${SESSION_COOKIE}` }), SESSION_COOKIE);
  assert.equal(commandcodeCookie({ TOKEN_MONITOR_COMMANDCODE_COOKIE: SESSION_COOKIE }), SESSION_COOKIE);
  // A header from some other site is not a Command Code session, however
  // well-formed it looks.
  assert.equal(commandcodeCookie({ COMMANDCODE_COOKIE: 'sidebar=open; stripe_mid=mid' }), '');
  assert.equal(commandcodeCookie({}), '');
});

test('normalizeCommandcodeCookieHeader forwards only Command Code session cookies', () => {
  // Everything outside the exact session-cookie allowlist is a credential the
  // billing API has no business receiving, so a real page's Stripe and analytics
  // cookies are dropped rather than posted along with the session.
  assert.equal(
    normalizeCommandcodeCookieHeader(`${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}; __stripe_mid=m; _ga=GA1.1.x; cookie-perms=2`),
    `${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}`
  );
  // Command Code's namespace in all three browser spellings.
  assert.equal(
    normalizeCommandcodeCookieHeader('commandcode_prod_.session_token=tok'),
    'commandcode_prod_.session_token=tok'
  );
  assert.equal(
    normalizeCommandcodeCookieHeader('__Host-commandcode_prod_.session_token=tok'),
    '__Host-commandcode_prod_.session_token=tok'
  );
  // The rest of the namespace is better-auth machinery the billing API has no
  // use for, so the allowlist is exact rather than a namespace prefix.
  assert.equal(
    normalizeCommandcodeCookieHeader(`${SESSION_COOKIE}; __Secure-commandcode_prod_.dont_remember=1; __Secure-commandcode_prod_.two_factor=x`),
    SESSION_COOKIE
  );
  // better-auth's DEFAULT names are not accepted at all: they belong to the
  // library, not to this provider, so any site built on better-auth would
  // produce a header indistinguishable from a real session — and a bare header
  // carries nothing that says which site it came from.
  for (const foreign of [
    'better-auth.session_token=SOMEONE_ELSES; theme=dark',
    '__Secure-better-auth.session_token=SOMEONE_ELSES',
    '__Host-better-auth.session_token=SOMEONE_ELSES'
  ]) assert.equal(normalizeCommandcodeCookieHeader(foreign), '', foreign);
  // A bare token is not accepted: guessing a cookie name would send a header
  // the API cannot authenticate and report it as an expired session.
  assert.equal(normalizeCommandcodeCookieHeader('tok'), '');
  assert.equal(normalizeCommandcodeCookieHeader(''), '');
});

test('the billing routes stay on the cookie-authenticated /internal paths', () => {
  // The CLI calls `/alpha/billing/*`, which is Bearer-key auth and rejects a
  // cookie session. Our whole credential model is the better-auth cookie, so a
  // switch to `/alpha` would make every account read as unauthorized while
  // looking superficially correct. Pin the paths.
  assert.equal(COMMANDCODE_CREDITS_URL, 'https://api.commandcode.ai/internal/billing/credits');
  assert.equal(COMMANDCODE_SUBSCRIPTIONS_URL, 'https://api.commandcode.ai/internal/billing/subscriptions');
});

test('normalizeCommandcodeCookieHeader accepts a DevTools "Copy as cURL" paste', () => {
  const curl = "curl 'https://api.commandcode.ai/internal/billing/credits' "
    + "-H 'accept: application/json' "
    + `-H 'cookie: ${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}; _ga=GA1.1.x'`;
  assert.equal(normalizeCommandcodeCookieHeader(curl), `${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}`);
  // Chrome switches to ANSI-C quoting once a value needs escaping, and Windows
  // DevTools emits -b instead of a cookie header.
  assert.equal(
    normalizeCommandcodeCookieHeader(`curl 'https://commandcode.ai/settings/usage' -H $'cookie: ${SESSION_COOKIE}'`),
    SESSION_COOKIE
  );
  assert.equal(
    normalizeCommandcodeCookieHeader(`curl.exe 'https://www.commandcode.ai/' -b '${SESSION_COOKIE}'`),
    SESSION_COOKIE
  );
  // A capture of the wrong request has no Cookie header. Falling back to the
  // raw text would parse the command line itself as cookie pairs.
  assert.equal(normalizeCommandcodeCookieHeader("curl 'https://api.commandcode.ai/x' -H 'user-agent: Mozilla'"), '');
});

test('a cURL capture from another origin is refused outright', () => {
  // Unlike a bare header, a capture says which request it came from — so use it.
  // Without this, one mis-copied capture posts another site's session to
  // api.commandcode.ai, and better-auth's default cookie name means an unrelated
  // better-auth site would look exactly like a valid Command Code session.
  for (const origin of ['https://evil.example', 'https://commandcode.ai.evil.example', 'http://localhost:3000']) {
    assert.equal(
      normalizeCommandcodeCookieHeader(`curl '${origin}/api/me' -H 'cookie: ${SESSION_COOKIE}'`),
      '',
      origin
    );
  }
  // The request URL is the argument that *starts* with a scheme; one merely
  // quoted inside a header must not be mistaken for it, in either direction.
  assert.equal(
    normalizeCommandcodeCookieHeader(
      `curl 'https://commandcode.ai/settings/usage' -H 'referer: https://evil.example' -H 'cookie: ${SESSION_COOKIE}'`
    ),
    SESSION_COOKIE
  );
  assert.equal(
    normalizeCommandcodeCookieHeader(
      `curl 'https://evil.example/x' -H 'referer: https://commandcode.ai/' -H 'cookie: ${SESSION_COOKIE}'`
    ),
    ''
  );
  // No URL at all means nothing to verify against, so it is not trusted.
  assert.equal(normalizeCommandcodeCookieHeader(`curl -H 'cookie: ${SESSION_COOKIE}'`), '');
});

test('parseCommandcodeCredits reads rolling limits at the root and nested in credits', () => {
  const root = parseCommandcodeCredits({
    credits: { monthlyCredits: 8.5, purchasedCredits: 0 },
    windowLimits: {
      fiveHour: { cap: 3, used: 0.75, resetAt: 1_780_000_000_000 },
      weekly: { cap: 15, used: 1.5, resetAt: 1_780_100_000_000 }
    }
  });
  assert.equal(root.monthlyRemaining, 8.5);
  assert.equal(root.fiveHour.usedPercent, 25);
  assert.equal(root.fiveHour.windowMinutes, 300);
  assert.equal(root.fiveHour.resetsAt, new Date(1_780_000_000_000).toISOString());
  assert.equal(root.weekly.usedPercent, 10);
  assert.equal(root.weekly.windowMinutes, 10_080);

  // Seconds-vs-milliseconds and stringified numbers both arrive in the wild.
  const nested = parseCommandcodeCredits({
    credits: {
      monthlyCredits: 7.25,
      purchasedCredits: 2,
      windowLimits: {
        fiveHour: { cap: '4', used: '1', resetAt: '1780200000' },
        weekly: { cap: 20, used: 4, resetAt: 1_780_300_000_000 }
      }
    }
  });
  assert.equal(nested.purchasedCredits, 2);
  assert.equal(nested.fiveHour.usedPercent, 25);
  assert.equal(nested.fiveHour.resetsAt, new Date(1_780_200_000_000).toISOString());
  assert.equal(nested.weekly.usedPercent, 20);
});

test('parseCommandcodeCredits accepts snake_case and rejects a missing grant', () => {
  const snake = parseCommandcodeCredits({
    credits: { monthly_credits: 4, purchased_credits: 1, window_limits: { five_hour: { cap: 10, used: 2 } } }
  });
  assert.equal(snake.monthlyRemaining, 4);
  assert.equal(snake.purchasedCredits, 1);
  assert.equal(snake.fiveHour.usedPercent, 20);
  assert.equal(snake.weekly, null);

  assert.throws(() => parseCommandcodeCredits({}), /missing credits object/);
  assert.throws(() => parseCommandcodeCredits({ credits: {} }), /missing monthlyCredits/);
});

test('parseCommandcodeSubscription separates the free tier from a failed envelope', () => {
  const parsed = parseCommandcodeSubscription(SUBSCRIPTION_BODY);
  assert.equal(parsed.planId, 'individual-go');
  assert.equal(parsed.status, 'active');
  assert.equal(parsed.currentPeriodEnd, '2026-06-06T07:28:50.000Z');

  // Only an explicit success+null says "no subscription".
  assert.equal(parseCommandcodeSubscription({ success: true, data: null }), null);
  assert.throws(() => parseCommandcodeSubscription({ success: true }), /missing subscriptions data/);
  assert.throws(() => parseCommandcodeSubscription({ success: false, error: 'down' }), /unsuccessful/);
});

test('fetchCommandcodeLimits reports notConfigured without a cookie and never calls the API', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits({}, { env: {}, fetch: stubFetch({}, calls) });
  assert.equal(provider.provider, 'commandcode');
  assert.equal(provider.status, 'notConfigured');
  assert.equal(provider.source, 'web');
  assert.deepEqual(provider.windows, []);
  assert.equal(calls.length, 0);
});

test('fetchCommandcodeLimits maps the plan allowance onto the monthly credits window', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      now: () => Date.parse('2026-05-20T00:00:00.000Z'),
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
      }, calls)
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.source, 'web');
  assert.equal(provider.accountLabel, 'Go');
  assert.ok(provider.accountKey.startsWith('sha256:'));
  assert.equal(provider.updatedAt, '2026-05-20T00:00:00.000Z');

  const billing = windowByKind(provider, 'billing');
  assert.equal(billing.length, 1);
  assert.equal(billing[0].metric, 'credits');
  assert.equal(billing[0].label, 'Monthly');
  assert.equal(billing[0].currency, 'USD');
  assert.equal(billing[0].limit, 10);
  assert.equal(billing[0].remaining, 8.7784);
  assert.equal(Number(billing[0].used.toFixed(4)), 1.2216);
  assert.equal(billing[0].resetsAt, '2026-06-06T07:28:50.000Z');
  assert.equal(billing[0].showMeter, true);

  assert.deepEqual(new Set(calls.map((call) => call.url)), new Set([
    COMMANDCODE_CREDITS_URL,
    COMMANDCODE_SUBSCRIPTIONS_URL
  ]));
  for (const call of calls) assert.equal(call.headers.Cookie, SESSION_COOKIE);
});

test('fetchCommandcodeLimits ships rolling limits and a rollover top-up as separate windows', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: {
          credits: {
            monthlyCredits: 35,
            purchasedCredits: 12.5,
            windowLimits: {
              fiveHour: { cap: 14, used: 7 },
              weekly: { cap: 35, used: 14 }
            }
          }
        },
        [COMMANDCODE_SUBSCRIPTIONS_URL]: {
          success: true,
          data: { planId: 'individual-goat', status: 'active', currentPeriodEnd: '2026-06-06T07:28:50.000Z' }
        }
      })
    }
  );

  assert.equal(provider.accountLabel, 'GOAT');
  assert.equal(windowByKind(provider, 'session')[0].usedPercent, 50);
  assert.equal(windowByKind(provider, 'weekly')[0].usedPercent, 40);

  const billing = windowByKind(provider, 'billing');
  assert.deepEqual(billing.map((entry) => entry.label), ['Monthly', 'Top-up']);
  assert.equal(billing[0].usedPercent, 50);
  // The top-up has no allowance to measure against, so it carries money and no
  // meter rather than an empty bar that would read as exhausted.
  assert.equal(billing[1].remaining, 12.5);
  assert.equal(billing[1].limit, null);
  assert.equal(billing[1].showMeter, false);
});

test('fetchCommandcodeLimits keeps the grant as money when the plan is unknown', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: { success: true, data: { planId: 'individual-brand-new', status: 'active' } }
      })
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.accountLabel, '');
  const billing = windowByKind(provider, 'billing');
  assert.equal(billing.length, 1);
  assert.equal(billing[0].remaining, 8.7784);
  assert.equal(billing[0].limit, null);
  assert.equal(billing[0].usedPercent, null);
  assert.equal(billing[0].showMeter, false);
});

test('a stale plan allowance is dropped rather than used as a bad denominator', async () => {
  // `individual-go` is catalogued at $10. A weekly cap above that, or a grant
  // with more left in it than the plan supposedly grants, both say the
  // catalogue entry has gone stale — the meter is dropped, the money stays.
  const cases = [
    { monthlyCredits: 10, windowLimits: { fiveHour: { cap: 3, used: 0 }, weekly: { cap: 25, used: 1 } } },
    { monthlyCredits: 42, windowLimits: { fiveHour: { cap: 3, used: 0 }, weekly: { cap: 6, used: 0 } } }
  ];
  for (const credits of cases) {
    const provider = await fetchCommandcodeLimits(
      { commandcodeCookie: SESSION_COOKIE },
      {
        env: {},
        fetch: stubFetch({
          [COMMANDCODE_CREDITS_URL]: { credits },
          [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
        })
      }
    );
    const billing = windowByKind(provider, 'billing');
    // The plan id still names the plan correctly; only its price is suspect.
    assert.equal(provider.accountLabel, 'Go');
    assert.equal(billing[0].limit, null);
    assert.equal(billing[0].showMeter, false);
    assert.equal(billing[0].remaining, credits.monthlyCredits);
  }
});

test('a repriced plan is detected by its published caps, not just its total', async () => {
  // The remaining balance can never contradict a catalogued total that is too
  // LARGE, so the published 5-hour/weekly caps are what pin the entry to the
  // plan it was copied from. Command Code repriced Pro from $30 to $80 with its
  // caps; a stale entry surviving that would show a confidently wrong meter.
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: {
          credits: {
            monthlyCredits: 4,
            purchasedCredits: 0,
            // Go is catalogued at $3/$6; this account's plan has moved on.
            windowLimits: { fiveHour: { cap: 9, used: 0 }, weekly: { cap: 18, used: 0 } }
          }
        },
        [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
      })
    }
  );

  const [monthly] = windowByKind(provider, 'billing');
  assert.equal(provider.accountLabel, 'Go');
  assert.equal(monthly.limit, null);
  assert.equal(monthly.showMeter, false);
  assert.equal(monthly.remaining, 4);
  // The rolling windows are read off the wire, so they stay exact regardless.
  assert.equal(windowByKind(provider, 'session')[0].limit, 9);
  assert.equal(windowByKind(provider, 'weekly')[0].limit, 18);
});

test('a response without the published caps drops the denominator too', async () => {
  // The caps are the only thing that can catch a catalogued grant that has gone
  // UP, so a response carrying none of them is not evidence the catalogue still
  // matches — it is the absence of evidence, and the meter goes with it. Every
  // published plan has both caps and a live account reports them before either
  // window is touched, so this shape means the API moved, not that the plan is
  // unmetered.
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: { credits: { monthlyCredits: 8.7784, purchasedCredits: 0 } },
        [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
      })
    }
  );

  const [monthly] = windowByKind(provider, 'billing');
  assert.equal(provider.status, 'ok');
  assert.equal(provider.accountLabel, 'Go');
  assert.equal(monthly.remaining, 8.7784);
  assert.equal(monthly.limit, null);
  assert.equal(monthly.showMeter, false);
  assert.equal(windowByKind(provider, 'session').length, 0);
  assert.equal(windowByKind(provider, 'weekly').length, 0);
});

test('every catalogued plan is priced and labelled, and its caps are coherent', () => {
  // Only the plans whose live payload has been captured carry caps (they are
  // read off the wire, not published), so the cap checks apply to just those.
  // The monthly amount and label are required for every entry, because a missing
  // one silently costs that plan its meter and its name.
  for (const [id, plan] of Object.entries(COMMANDCODE_PLANS)) {
    assert.ok(plan.monthlyCreditsUsd > 0, id);
    assert.ok(plan.label, id);
    if (plan.fiveHourCapUsd === undefined && plan.weeklyCapUsd === undefined) continue;
    assert.ok(plan.fiveHourCapUsd > 0 && plan.fiveHourCapUsd < plan.monthlyCreditsUsd, id);
    assert.ok(plan.weeklyCapUsd > plan.fiveHourCapUsd && plan.weeklyCapUsd < plan.monthlyCreditsUsd, id);
  }
});

test('the plan catalogue covers both Pro price cohorts separately', () => {
  // Command Code repriced Pro ($30 -> $80) and minted `individual-pro-v1` for the
  // new price instead of migrating the old id, so both are live. The CLI resolves
  // this by prefix-matching with the shorter id first, which reads every v1
  // subscriber as a $30 plan; our exact match must not reproduce that.
  assert.equal(COMMANDCODE_PLANS['individual-pro'].monthlyCreditsUsd, 30);
  assert.equal(COMMANDCODE_PLANS['individual-pro-v1'].monthlyCreditsUsd, 80);
  assert.equal(planFor('individual-pro'), COMMANDCODE_PLANS['individual-pro']);
  assert.equal(planFor('individual-pro-v1'), COMMANDCODE_PLANS['individual-pro-v1']);
});

test('accountKey follows the account, not the credential', async () => {
  const keyFor = async (subscriptionData, cookie = `${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}`) => (
    await fetchCommandcodeLimits({ commandcodeCookie: cookie }, {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: { success: true, data: { ...SUBSCRIPTION_BODY.data, ...subscriptionData } }
      })
    })
  ).accountKey;

  const base = await keyFor({ userId: 'user-abc' });
  assert.ok(base.startsWith('sha256:'));
  // A re-pasted cookie, a rotated session_data cache, and a cancel-and-resubscribe
  // are all the same person — the key is what dedupes them across devices.
  assert.equal(await keyFor({ userId: 'user-abc' }, `${SESSION_COOKIE}; __Secure-commandcode_prod_.session_data=rotated`), base);
  assert.equal(await keyFor({ userId: 'user-abc' }, '__Secure-commandcode_prod_.session_token=different'), base);
  assert.equal(await keyFor({ userId: 'user-abc', id: 'sub_NEW' }), base);
  assert.notEqual(await keyFor({ userId: 'someone-else' }), base);

  // The ladder below `userId`, pinned so a shape that carries only one spelling
  // of the account id still keys on the account. `id` is the subscription and
  // is last: it survives a new session but not a resubscribe, which is why it
  // ranks under the user id and above the credential.
  const viaMetadata = { userId: undefined, metadata: { commandCodeUserId: 'user-abc' } };
  assert.equal(await keyFor(viaMetadata), base);
  assert.equal(await keyFor({ userId: undefined, user_id: 'user-abc', metadata: undefined }), base);
  const viaSubscription = { userId: undefined, metadata: undefined, id: 'sub_ONE' };
  assert.equal(
    await keyFor(viaSubscription, '__Secure-commandcode_prod_.session_token=another-device'),
    await keyFor(viaSubscription)
  );
  assert.notEqual(await keyFor({ ...viaSubscription, id: 'sub_TWO' }), await keyFor(viaSubscription));

  // Without the optional subscription read there is no account id, so the
  // identity half of the credential seeds it — never the session_data cache.
  const withoutPlan = await fetchCommandcodeLimits(
    { commandcodeCookie: `${SESSION_COOKIE}; ${SESSION_DATA_COOKIE}` },
    { env: {}, fetch: stubFetch({
      [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
      [COMMANDCODE_SUBSCRIPTIONS_URL]: { success: true, data: null }
    }) }
  );
  const withRotatedCache = await fetchCommandcodeLimits(
    { commandcodeCookie: `${SESSION_COOKIE}; __Secure-commandcode_prod_.session_data=rotated` },
    { env: {}, fetch: stubFetch({
      [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
      [COMMANDCODE_SUBSCRIPTIONS_URL]: { success: true, data: null }
    }) }
  );
  assert.equal(withoutPlan.accountKey, withRotatedCache.accountKey);
});

test('a live Go account maps onto the windows the dashboard shows', async () => {
  // Captured verbatim from api.commandcode.ai on a fresh individual-go
  // subscription, ids redacted and nothing else removed: no monthly allowance
  // anywhere on the wire (hence the catalogue), premium+opensource summing to
  // the REMAINING grant, resetAt 0 on windows that have not been touched yet,
  // and a `userId` — this response is the evidence that the account key has a
  // real account id to hang on. Keep the untouched fields; they are what shows
  // the shape this provider was written against if the endpoint ever moves.
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: {
          credits: {
            belowThreshold: false,
            creditThreshold: 0,
            monthlyCredits: 10,
            purchasedCredits: 0,
            premiumMonthlyCredits: 0,
            opensourceMonthlyCredits: 10
          },
          windowLimits: {
            limited: true,
            exceeded: null,
            fiveHour: { used: 0, cap: 3, exceeded: false, resetAt: 0 },
            weekly: { used: 0, cap: 6, exceeded: false, resetAt: 0 }
          }
        },
        [COMMANDCODE_SUBSCRIPTIONS_URL]: {
          success: true,
          data: {
            id: 'sub_redacted',
            status: 'active',
            userId: '015d654d-redacted',
            orgId: null,
            createdAt: '2026-08-15T04:42:16.000Z',
            priceId: 'price_redacted',
            metadata: { fbp: 'fb.redacted', commandCode: 'true', commandCodeUserId: '015d654d-redacted' },
            quantity: 1,
            cancelAtPeriodEnd: false,
            currentPeriodStart: '2026-08-15T04:42:16.000Z',
            currentPeriodEnd: '2026-09-15T04:42:16.000Z',
            endedAt: null,
            cancelAt: null,
            canceledAt: null,
            planId: 'individual-go',
            pendingPhase: null
          }
        }
      })
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.accountLabel, 'Go');
  const [session] = windowByKind(provider, 'session');
  assert.deepEqual([session.used, session.limit, session.usedPercent], [0, 3, 0]);
  // An untouched window reports resetAt 0, which is an absent reset, not 1970.
  assert.equal(session.resetsAt, null);
  const [weekly] = windowByKind(provider, 'weekly');
  assert.deepEqual([weekly.used, weekly.limit, weekly.usedPercent], [0, 6, 0]);
  assert.equal(weekly.resetsAt, null);
  const billing = windowByKind(provider, 'billing');
  assert.equal(billing.length, 1);
  assert.deepEqual(
    [billing[0].remaining, billing[0].limit, billing[0].used, billing[0].usedPercent],
    [10, 10, 0, 0]
  );
  assert.equal(billing[0].resetsAt, '2026-09-15T04:42:16.000Z');
});

test('a failed subscription lookup still publishes the credits it did read', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: () => jsonResponse(503, { error: 'unavailable' })
      })
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.accountLabel, '');
  assert.equal(windowByKind(provider, 'billing')[0].remaining, 8.7784);
});

test('fetchCommandcodeLimits maps credits transport failures onto provider statuses', async () => {
  const cases = [
    [() => jsonResponse(401, {}), 'unauthorized'],
    [() => jsonResponse(403, {}), 'unauthorized'],
    [() => jsonResponse(429, {}), 'sourceRateLimited'],
    [() => jsonResponse(500, {}), 'unavailable'],
    [() => jsonResponse(200, { unexpected: true }), 'unavailable'],
    [() => { throw new Error('socket hang up'); }, 'unavailable']
  ];
  for (const [route, expected] of cases) {
    const provider = await fetchCommandcodeLimits(
      { commandcodeCookie: SESSION_COOKIE },
      {
        env: {},
        fetch: stubFetch({
          [COMMANDCODE_CREDITS_URL]: route,
          [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
        })
      }
    );
    assert.equal(provider.status, expected);
    assert.deepEqual(provider.windows, []);
  }
});

test('a stalled subscription lookup does not hold the probe past the credits deadline', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      commandcodeFetchTimeoutMs: 200,
      commandcodeSubscriptionTimeoutMs: 20,
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: () => new Promise(() => {})
      })
    }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.accountLabel, '');
  assert.equal(windowByKind(provider, 'billing')[0].remaining, 8.7784);
});

test('a fast credits failure does not wait out the enrichment deadline', async () => {
  // The plan lookup is discarded on this path, so holding the error behind its
  // deadline would make an expired cookie take seconds to report.
  const startedAt = Date.now();
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      commandcodeSubscriptionTimeoutMs: 5_000,
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: () => jsonResponse(401, {}),
        [COMMANDCODE_SUBSCRIPTIONS_URL]: () => new Promise(() => {})
      })
    }
  );

  assert.equal(provider.status, 'unauthorized');
  assert.ok(Date.now() - startedAt < 1_000, `took ${Date.now() - startedAt}ms`);
});

test('an exhausted credits probe reports unavailable rather than hanging', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      commandcodeFetchTimeoutMs: 20,
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: () => new Promise(() => {}),
        [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
      })
    }
  );

  assert.equal(provider.status, 'unavailable');
  assert.deepEqual(provider.windows, []);
});

// ---------------------------------------------------------------------------
// API-key channel (`/alpha/*`): the `cmd` CLI's own route, Bearer-authenticated.
// ---------------------------------------------------------------------------

const API_KEY = 'cmd_hubkey1234567890';
const WHOAMI_URL = `${COMMANDCODE_ALPHA_WHOAMI_URL}?limits=1`;

// A v1 Pro account: the id minted when Pro was repriced from $30 to $80.
const ALPHA_CREDITS_BODY = {
  credits: {
    planId: 'individual-pro-v1',
    monthlyCredits: 60,
    usagePercent: 25,
    purchasedRemaining: 12.5,
    freeCredits: 5,
    windowLimits: {
      fiveHour: { cap: 20, used: 5, exceeded: false, resetAt: 1786700000000 },
      weekly: { cap: 40, used: 10, exceeded: false, resetAt: 1787000000000 }
    }
  }
};
const ALPHA_SUBSCRIPTION_BODY = {
  data: { planId: 'individual-pro-v1', status: 'active', currentPeriodEnd: 1787000000000 }
};
const ALPHA_WHOAMI_BODY = {
  org: { id: 'org_123', login: 'acme' },
  user: { userName: 'dev' },
  orgLimits: [{ label: 'Org monthly', limit: 500, used: 120, currency: 'USD' }]
};

// Routes the alpha channel by path, ignoring the query string so the orgId
// assertions stay separate from the stubbing.
function stubAlpha(overrides = {}, calls = []) {
  const routes = {
    [COMMANDCODE_ALPHA_WHOAMI_URL]: ALPHA_WHOAMI_BODY,
    [COMMANDCODE_ALPHA_CREDITS_URL]: ALPHA_CREDITS_BODY,
    [COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL]: ALPHA_SUBSCRIPTION_BODY,
    ...overrides
  };
  return async (url, init) => {
    const href = String(url);
    calls.push({ url: href, headers: init?.headers || {} });
    const path = href.split('?')[0];
    const route = routes[path];
    if (route === undefined) throw new Error(`unexpected request: ${href}`);
    if (typeof route === 'function') return route();
    return { ok: true, status: 200, json: async () => route };
  };
}

test('normalizeCommandcodeApiKey accepts only cmd_-prefixed keys', () => {
  assert.equal(normalizeCommandcodeApiKey('cmd_abcdefgh1234'), 'cmd_abcdefgh1234');
  assert.equal(normalizeCommandcodeApiKey('  "cmd_abcdefgh1234"  '), 'cmd_abcdefgh1234');
  // Anything else is far more likely another provider's credential, and sending
  // it as a Bearer would leak it to api.commandcode.ai.
  assert.equal(normalizeCommandcodeApiKey('sk-whatever'), '');
  assert.equal(normalizeCommandcodeApiKey('cmd_short'), '');
  assert.equal(normalizeCommandcodeApiKey(''), '');
  assert.equal(normalizeCommandcodeApiKey('cmd_has\nnewline'), '');
});

test('commandcodeApiKey prefers settings over env', () => {
  assert.equal(commandcodeApiKey({}, { commandcodeApiKey: API_KEY }), API_KEY);
  assert.equal(commandcodeApiKey({ COMMAND_CODE_API_KEY: API_KEY }), API_KEY);
  assert.equal(commandcodeApiKey({ COMMANDCODE_API_KEY: API_KEY }), API_KEY);
  assert.equal(commandcodeApiKey({ COMMAND_CODE_API_KEY: 'nope' }), '');
  assert.equal(commandcodeApiKey({}), '');
});

test('hasCommandcodeCredentials accepts either credential form', () => {
  assert.equal(hasCommandcodeCredentials({ commandcodeApiKey: API_KEY }), true);
  assert.equal(hasCommandcodeCredentials({ commandcodeCookie: SESSION_COOKIE }), true);
  assert.equal(hasCommandcodeCredentials({}), false);
});

test('alphaHeaders reproduces the CLI header set', () => {
  const headers = alphaHeaders(API_KEY);
  assert.equal(headers.Authorization, `Bearer ${API_KEY}`);
  assert.equal(headers['User-Agent'], 'cli');
  assert.equal(headers['x-cli-environment'], COMMANDCODE_CLI_ENVIRONMENT);
  assert.equal(headers['x-command-code-version'], COMMANDCODE_CLI_VERSION);
  // The cookie channel's browser UA must not leak onto the CLI route.
  assert.equal(headers.Cookie, undefined);
});

test('withOrgId appends only the params that are known', () => {
  assert.equal(withOrgId('https://x/y', 'org_1'), 'https://x/y?orgId=org_1');
  assert.equal(withOrgId('https://x/y', ''), 'https://x/y');
  assert.equal(withOrgId('https://x/y', null, { since: '2026-05-01' }), 'https://x/y?since=2026-05-01');
  assert.equal(withOrgId('https://x/y', 'o', { since: 's' }), 'https://x/y?orgId=o&since=s');
});

test('parseCommandcodeWhoami reads the org, the user, and org limits', () => {
  const identity = parseCommandcodeWhoami(ALPHA_WHOAMI_BODY);
  assert.equal(identity.orgId, 'org_123');
  assert.equal(identity.orgLogin, 'acme');
  assert.equal(identity.userName, 'dev');
  assert.equal(identity.orgLimits.length, 1);
  // A bare payload (no `data` wrapper) is the alpha shape; tolerate both.
  assert.equal(parseCommandcodeWhoami({ data: { org: { id: 'x' } } }).orgId, 'x');
  assert.deepEqual(parseCommandcodeWhoami(null), { orgId: '', orgLogin: '', userName: '', orgLimits: [] });
});

test('parseCommandcodeSubscription accepts the unwrapped alpha envelope', () => {
  // The alpha route has no `success` flag: the plan id sits at data.planId.
  const subscription = parseCommandcodeSubscription(ALPHA_SUBSCRIPTION_BODY);
  assert.equal(subscription.planId, 'individual-pro-v1');
  assert.equal(subscription.status, 'active');
  // A free alpha account is an absent inner object.
  assert.equal(parseCommandcodeSubscription({ data: null }), null);
  // But a FAILED cookie-channel envelope still must not read as free.
  assert.throws(() => parseCommandcodeSubscription({ success: false, data: null }), /unsuccessful/);
});

test('parseCommandcodeCredits reads the vendor percentage and both pools', () => {
  const credits = parseCommandcodeCredits(ALPHA_CREDITS_BODY);
  assert.equal(credits.usagePercent, 25);
  assert.equal(credits.purchasedRemaining, 12.5);
  assert.equal(credits.freeCredits, 5);
  assert.equal(credits.planId, 'individual-pro-v1');
  // A response without usagePercent reports null rather than a guessed figure.
  assert.equal(parseCommandcodeCredits({ credits: { monthlyCredits: 5 } }).usagePercent, null);
});

test('orgLimitWindows reads org caps and skips unusable entries', () => {
  const windows = orgLimitWindows([
    { label: 'Org monthly', limit: 500, used: 120, currency: 'USD' },
    { label: 'No limit' },
    { name: 'Spend', cap: 100, spent: 40, resetAt: 1787000000000 }
  ]);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].label, 'Org monthly');
  assert.equal(windows[0].usedPercent, 24);
  assert.equal(windows[0].metric, 'spend');
  assert.equal(windows[1].label, 'Spend');
  assert.equal(windows[1].usedPercent, 40);
  assert.deepEqual(orgLimitWindows(null), []);
});

test('the API key path calls whoami then both billing reads with the org id', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    { env: {}, fetch: stubAlpha({}, calls) }
  );

  assert.equal(provider.status, 'ok');
  assert.equal(provider.source, 'api');
  assert.equal(provider.accountLabel, 'Pro');
  assert.equal(provider.accountName, 'acme');
  assert.ok(provider.accountKey.startsWith('sha256:'));

  // whoami first (it resolves the org), then credits + subscriptions, both scoped.
  assert.equal(calls[0].url, WHOAMI_URL);
  assert.ok(calls.every((call) => call.headers.Authorization === `Bearer ${API_KEY}`));
  assert.ok(calls.every((call) => call.headers.Cookie === undefined));
  const creditsCall = calls.find((call) => call.url.startsWith(COMMANDCODE_ALPHA_CREDITS_URL));
  const subscriptionCall = calls.find((call) => call.url.startsWith(COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL));
  assert.match(creditsCall.url, /\?orgId=org_123$/);
  assert.match(subscriptionCall.url, /\?orgId=org_123$/);
});

test('the API key path meters the month from the vendor percentage', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    { env: {}, fetch: stubAlpha() }
  );
  const [monthly] = windowByKind(provider, 'billing');
  assert.equal(monthly.label, 'Monthly');
  // 25 is the vendor's own figure. It must NOT be recomputed from the catalogue
  // entry (individual-pro-v1 = $80), which would report 25% of 80 as the meter.
  assert.equal(monthly.usedPercent, 25);
  assert.equal(monthly.remainingPercent, 75);
  assert.equal(monthly.remaining, 60);
  assert.equal(monthly.showMeter, true);
  // The catalogue is not consulted when the vendor reports a percentage, so no
  // denominator ships (normalizeLimitWindow emits null, not undefined).
  assert.equal(monthly.limit, null);
  // Rolling windows and the top-up still ship.
  assert.equal(windowByKind(provider, 'session')[0].usedPercent, 25);
  assert.equal(windowByKind(provider, 'weekly')[0].usedPercent, 25);
  assert.equal(provider.windows.some((window) => window.label === 'Top-up' && window.remaining === 12.5), true);
});

test('the API key path publishes org-wide caps the cookie route cannot see', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    { env: {}, fetch: stubAlpha() }
  );
  const org = provider.windows.find((window) => window.label === 'Org monthly');
  assert.ok(org, 'expected the org limit window');
  assert.equal(org.metric, 'spend');
  assert.equal(org.limit, 500);
  assert.equal(org.usedPercent, 24);
});

test('the API key path still works when whoami reports no org', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    { env: {}, fetch: stubAlpha({ [COMMANDCODE_ALPHA_WHOAMI_URL]: {} }, calls) }
  );
  assert.equal(provider.status, 'ok');
  // Without an org there is nothing to scope by, so the param is omitted.
  assert.equal(calls.some((call) => call.url.includes('orgId')), false);
});

test('the API key path survives a failed subscription read', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    {
      env: {},
      fetch: (url, init) => {
        if (String(url).startsWith(COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL)) {
          return Promise.resolve(jsonResponse(500, {}));
        }
        return stubAlpha()(url, init);
      }
    }
  );
  assert.equal(provider.status, 'ok');
  // The credits payload carries its own planId, which is the CLI's own fallback.
  assert.equal(provider.accountLabel, 'Pro');
  assert.equal(windowByKind(provider, 'billing')[0].remaining, 60);
});

test('the API key path reports a rejected key as unauthorized without touching the cookie route', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY, commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: async (url, init) => {
        calls.push({ url: String(url), headers: init?.headers || {} });
        return jsonResponse(401, {});
      }
    }
  );
  assert.equal(provider.status, 'unauthorized');
  assert.equal(provider.source, 'api');
  // No automatic fallback: the two channels speak different auth schemes, so
  // retrying the cookie route would report a rejected KEY as an expired SESSION.
  assert.ok(calls.every((call) => call.url.includes('/alpha/')));
});

test('the API key path maps transport failures onto provider statuses', async () => {
  const at = (status) => fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    { env: {}, fetch: async () => jsonResponse(status, {}) }
  );
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('an API key wins over a cookie when both are configured', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY, commandcodeCookie: SESSION_COOKIE },
    { env: {}, fetch: stubAlpha({}, calls) }
  );
  assert.equal(provider.source, 'api');
  assert.ok(calls.every((call) => call.url.includes('/alpha/')));
  assert.ok(calls.every((call) => call.headers.Cookie === undefined));
});

test('the cookie channel is untouched by the API key path', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeCookie: SESSION_COOKIE },
    {
      env: {},
      fetch: stubFetch({
        [COMMANDCODE_CREDITS_URL]: CREDITS_BODY,
        [COMMANDCODE_SUBSCRIPTIONS_URL]: SUBSCRIPTION_BODY
      }, calls)
    }
  );
  assert.equal(provider.source, 'web');
  assert.equal(provider.status, 'ok');
  assert.ok(calls.every((call) => call.url.includes('/internal/')));
});

test('probeLimitProvider reaches the API key channel through the Hub gate', async () => {
  const rows = await probeLimitProvider('commandcode', {
    limitProviders: 'commandcode',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    commandcodeApiKey: API_KEY
  }, {}, { fetch: stubAlpha() });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].source, 'api');
});

test('probeLimitProvider returns no rows for commandcode without a credential', async () => {
  const rows = await probeLimitProvider('commandcode', {
    limitProviders: 'commandcode',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('commandcode must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});

test('spendWindows reports the period cost without a meter', () => {
  const [window] = spendWindows({ totalCost: 12.34 });
  assert.equal(window.label, 'Period spend');
  assert.equal(window.metric, 'spend');
  assert.equal(window.remaining, 12.34);
  assert.equal(window.currency, 'USD');
  // A dollar figure is not a consumed quota, so there is no bar to draw.
  assert.equal(window.showMeter, false);
  // A bare payload is tolerated; an unusable one yields nothing rather than $0.
  assert.equal(spendWindows({ data: { totalCost: 5 } })[0].remaining, 5);
  assert.deepEqual(spendWindows(null), []);
  assert.deepEqual(spendWindows({}), []);
});

test('the API key path anchors the usage summary on the billing period start', async () => {
  const calls = [];
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    {
      env: {},
      fetch: (url, init) => {
        const path = String(url).split('?')[0];
        if (path === COMMANDCODE_ALPHA_SUMMARY_URL) {
          calls.push({ url: String(url), headers: init?.headers || {} });
          return Promise.resolve(jsonResponse(200, { totalCost: 12.34 }));
        }
        return stubAlpha({
          [COMMANDCODE_ALPHA_SUBSCRIPTIONS_URL]: {
            data: {
              planId: 'individual-pro-v1',
              status: 'active',
              currentPeriodEnd: 1787000000000,
              currentPeriodStart: 1784000000000
            }
          }
        }, calls)(url, init);
      }
    }
  );

  assert.equal(provider.status, 'ok');
  const summaryCall = calls.find((call) => call.url.startsWith(COMMANDCODE_ALPHA_SUMMARY_URL));
  assert.ok(summaryCall, 'expected a usage summary request');
  assert.match(summaryCall.url, /\?orgId=org_123&since=/);
  assert.equal(summaryCall.url.includes(encodeURIComponent(new Date(1784000000000).toISOString())), true);
  const spend = provider.windows.find((window) => window.label === 'Period spend');
  assert.equal(spend.remaining, 12.34);
});

test('a failed usage summary costs only its own window', async () => {
  const provider = await fetchCommandcodeLimits(
    { commandcodeApiKey: API_KEY },
    {
      env: {},
      fetch: (url, init) => {
        if (String(url).startsWith(COMMANDCODE_ALPHA_SUMMARY_URL)) {
          return Promise.resolve(jsonResponse(500, {}));
        }
        return stubAlpha()(url, init);
      }
    }
  );
  assert.equal(provider.status, 'ok');
  assert.equal(provider.windows.some((window) => window.label === 'Period spend'), false);
  // Everything else still ships: the monthly grant, the top-up, and the org cap
  // from whoami. Only the spend window is lost.
  assert.deepEqual(
    windowByKind(provider, 'billing').map((window) => window.label),
    ['Monthly', 'Top-up', 'Org monthly']
  );
});
