'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  SAKANA_BILLING_URL,
  fetchSakanaLimits,
  findMonthlyPrice,
  findPlan,
  hasSakanaCredentials,
  looksLoggedOut,
  parseSakanaBillingHtml,
  sakanaSessionCookie,
  sakanaSessionPath
} = require('../../src/shared/sakanaLimits');
const { parseLimitProviders } = require('../../src/shared/limitCollector');

function htmlResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

const COOKIE = '__Secure-authjs.session-token=abc123';

// A billing page with both quota cards, mimicking the real markup shape: the
// window label in its own element and the percentage before a `% used` suffix.
function billingPage({ fiveHour = '45.5', weekly = '12', plan = 'Pro', price = 20 } = {}) {
  return [
    '<html><body><h1>Billing</h1>',
    `<div>${plan}</div><span>$${price}/mo</span>`,
    `<h3>5-hour</h3><span>${fiveHour}% used</span>`,
    '<p>Resets on September 18, 2026 at 3:00 PM</p>',
    `<h3>Weekly</h3><span>${weekly}% used</span>`,
    '<p>Resets on September 25, 2026 at 9:00 AM</p>',
    '</body></html>'
  ].join('');
}

test('sakana is in the parsed provider set', () => {
  assert.ok(parseLimitProviders().includes('sakana'));
});

test('sakanaSessionCookie prefers an explicit cookie and falls back to the config file', () => {
  const deps = {
    readFileSync: (p) => {
      assert.equal(p, sakanaSessionPath({ homeDir: '/home/alice' }));
      return `  ${COOKIE}\n`;
    }
  };
  assert.equal(sakanaSessionCookie({ homeDir: '/home/alice' }, deps), COOKIE);
  assert.equal(sakanaSessionCookie({ sakanaSessionCookie: ' explicit=1 ' }, deps), 'explicit=1');
  assert.equal(sakanaSessionCookie({}, { ...deps, env: { SAKANA_SESSION_COOKIE: 'env=1' } }), 'env=1');
  assert.equal(hasSakanaCredentials({ homeDir: '/home/alice' }, deps), true);
});

test('sakanaSessionCookie rejects a missing file, a value with no pair, and control characters', () => {
  const missing = { readFileSync: () => { throw new Error('ENOENT'); } };
  assert.equal(sakanaSessionCookie({}, missing), '');
  assert.equal(sakanaSessionCookie({ sakanaSessionCookie: 'justaword' }, missing), '');
  assert.equal(sakanaSessionCookie({ sakanaSessionCookie: 'a=1\nb=2' }, missing), '');
});

test('the sakana session path honours TOKSCALE_CONFIG_DIR', () => {
  // Build expectations with path.join: the implementation returns a real
  // filesystem path, so it uses the platform separator. Hardcoding '/'-joined
  // literals passed on Linux and macOS and failed on the Windows CI runner.
  const previous = process.env.TOKSCALE_CONFIG_DIR;
  process.env.TOKSCALE_CONFIG_DIR = '/custom/cfg';
  try {
    assert.equal(sakanaSessionPath({}), path.join('/custom/cfg', 'sakana-session'));
  } finally {
    if (previous === undefined) delete process.env.TOKSCALE_CONFIG_DIR;
    else process.env.TOKSCALE_CONFIG_DIR = previous;
  }
  assert.equal(
    sakanaSessionPath({ homeDir: '/home/alice' }),
    path.join('/home/alice', '.config', 'tokscale', 'sakana-session')
  );
});

test('parseSakanaBillingHtml binds each percentage to its own labelled section', () => {
  const windows = parseSakanaBillingHtml(billingPage());
  assert.deepEqual(windows.map((w) => w.label), ['5-hour', 'Weekly']);
  assert.equal(windows[0].usedPercent, 45.5);
  assert.equal(windows[1].usedPercent, 12);
  assert.equal(windows[0].windowMinutes, 300);
  assert.equal(windows[1].windowMinutes, 10080);
  assert.ok(windows[0].resetsAt && windows[1].resetsAt, 'expected both reset times');
});

// The page embeds each figure more than once (card markup + serialized RSC
// data). Anchoring on labels and slicing per section is what stops a
// collect-everything scan from inventing a third phantom window.
test('duplicated percentages do not invent extra windows', () => {
  const page = billingPage()
    .replace('</body>', '<script>{"fiveHour":45.5,"weekly":12,"used":"45.5% used 12% used"}</script></body>');
  const windows = parseSakanaBillingHtml(page);
  assert.deepEqual(windows.map((w) => w.label), ['5-hour', 'Weekly']);
  assert.equal(windows.length, 2);
});

test('a label-less page falls back to at most the two known windows', () => {
  const page = '<html>45% used ... 12% used ... 99% used ...</html>';
  const windows = parseSakanaBillingHtml(page);
  assert.deepEqual(windows.map((w) => w.label), ['5-hour', 'Weekly']);
  assert.equal(windows.length, 2);
});

test('parseSakanaBillingHtml returns nothing for a logged-out shell', () => {
  assert.deepEqual(parseSakanaBillingHtml('<html><body>Sign in to continue</body></html>'), []);
  assert.deepEqual(parseSakanaBillingHtml(''), []);
  assert.deepEqual(parseSakanaBillingHtml(null), []);
});

test('plan and monthly price are read as metadata only', () => {
  const page = billingPage({ plan: 'Pro', price: 20 });
  assert.equal(findPlan(page), 'Pro');
  assert.equal(findMonthlyPrice(page), 20);
  assert.equal(findMonthlyPrice('<html>no price</html>'), null);
});

test('looksLoggedOut keys on marker absence, not on sign-in wording', () => {
  assert.equal(looksLoggedOut('<html><h1>Billing</h1><h3>5-hour</h3></html>'), false);
  assert.equal(looksLoggedOut('<html>Sign in</html>'), true);
  // A page that mentions logging in but IS the console must not be flagged.
  assert.equal(looksLoggedOut('<html><h1>Billing</h1><a>/login</a><h3>Weekly</h3></html>'), false);
});

test('fetchSakanaLimits reports notConfigured without a cookie', async () => {
  const result = await fetchSakanaLimits({}, { env: {}, readFileSync: () => { throw new Error('ENOENT'); } });
  assert.equal(result.provider, 'sakana');
  assert.equal(result.status, 'notConfigured');
});

test('fetchSakanaLimits fetches the billing console with the cookie and normalizes windows', async () => {
  let seen = null;
  const result = await fetchSakanaLimits({ sakanaSessionCookie: COOKIE }, {
    fetch: async (url, init) => {
      seen = { url, init };
      return htmlResponse(billingPage());
    }
  });
  assert.equal(seen.url, SAKANA_BILLING_URL);
  assert.equal(seen.init.headers.Cookie, COOKIE);
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'web');
  assert.equal(result.windows.length, 2);
  assert.equal(result.accountLabel, 'Fugu');
  // accountLabel sanitization drops the "$" and "/", so the price lands as "20mo".
  assert.match(result.planLabel, /Pro/);
  assert.match(result.planLabel, /20mo/);
  assert.ok(result.accountKey, 'expected a hashed account key');
});

test('fetchSakanaLimits treats a windowless page as an expired session, not an empty success', async () => {
  const result = await fetchSakanaLimits({ sakanaSessionCookie: COOKIE }, {
    fetch: async () => htmlResponse('<html>Sign in</html>')
  });
  assert.equal(result.status, 'unauthorized');
  assert.deepEqual(result.windows, []);
});

test('fetchSakanaLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchSakanaLimits({ sakanaSessionCookie: COOKIE }, { fetch: async () => htmlResponse('', status) });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchSakanaLimits survives a network failure', async () => {
  const result = await fetchSakanaLimits({ sakanaSessionCookie: COOKIE }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(result.status, 'unavailable');
});
