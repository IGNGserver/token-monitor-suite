'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  WARP_GRAPHQL_ENDPOINT,
  buildWarpWindows,
  fetchWarpLimits,
  hasWarpCredentials,
  warpCredential
} = require('../../src/shared/warpLimits');
const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
const { probeLimitProvider } = require('../../src/shared/limitCollector');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// Mirrors the real GraphQL envelope: the payload is nested under `data` keyed by
// the operation name, which is why the parser searches by key rather than path.
function limitInfoBody(info) {
  return { data: { requestLimitInfo: info } };
}

test('warp is in the canonical provider list', () => {
  assert.ok(LIMIT_PROVIDER_IDS.includes('warp'));
});

test('warpCredential prefers an explicit wk- API key and treats it as a bearer', () => {
  assert.deepEqual(warpCredential({ warpApiKey: 'wk-abc' }), { kind: 'bearer', value: 'wk-abc' });
  assert.deepEqual(warpCredential({ warpBearerToken: 'wk-def' }), { kind: 'bearer', value: 'wk-def' });
  assert.equal(hasWarpCredentials({ warpApiKey: 'wk-abc' }), true);
});

test('warpCredential sends a cookie-shaped value as a Cookie header', () => {
  assert.deepEqual(
    warpCredential({ warpCookie: 'session=abc; other=def' }),
    { kind: 'cookie', value: 'session=abc; other=def' }
  );
});

test('warpCredential rejects empty, control-character, and non-credential values', () => {
  assert.equal(warpCredential({}), null);
  assert.equal(warpCredential({ warpApiKey: '   ' }), null);
  assert.equal(warpCredential({ warpApiKey: 'a=1\nb=2' }), null);
  assert.equal(hasWarpCredentials({}), false);
});

test('buildWarpWindows meters requests against a limit and reports the remainder', () => {
  const windows = buildWarpWindows([limitInfoBody({
    requestLimit: 200,
    requestsUsedSinceLastRefresh: 50,
    nextRefreshTime: '2026-07-01T00:00:00Z'
  })]);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].label, 'Requests');
  assert.equal(windows[0].used, 50);
  assert.equal(windows[0].limit, 200);
  assert.equal(windows[0].usedPercent, 25);
  assert.equal(windows[0].showMeter, true);
  assert.equal(windows[0].detail, '150 requests left');
  assert.equal(windows[0].resetsAt, '2026-07-01T00:00:00.000Z');
});

// With no denominator this is an informational counter. Rendering a meter would
// show an "exhausted" bar for a healthy account.
test('buildWarpWindows keeps an uncapped request counter meterless', () => {
  const [window] = buildWarpWindows([limitInfoBody({ requestsUsedSinceLastRefresh: 7 })]);
  assert.equal(window.showMeter, false);
  assert.equal(window.detail, '7 requests used');
  // The count itself is still real data; only the denominator is absent.
  assert.equal(window.used, 7);
  assert.equal(window.limit, undefined);
  assert.equal(window.usedPercent, undefined);
});

test('buildWarpWindows renders spend as an informational dollar figure', () => {
  const windows = buildWarpWindows([limitInfoBody({
    requestLimit: 10,
    requestsUsedSinceLastRefresh: 1,
    bonusGrantsInfo: { spendingInfo: { currentMonthSpendCents: 1234 } }
  })]);
  const spend = windows.find((window) => window.label === 'Spend');
  assert.ok(spend, 'expected a Spend window');
  assert.equal(spend.remaining, 12.34);
  assert.equal(spend.currency, 'USD');
  assert.equal(spend.showMeter, false);
});

test('buildWarpWindows falls back to workspace totals and tolerates a missing rollup', () => {
  // The workspace query failing must not discard the request-limit numbers.
  const windows = buildWarpWindows([
    limitInfoBody({ requestLimit: 100, requestsUsedSinceLastRefresh: 10 }),
    null
  ]);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].used, 10);
  // And the workspace-only shape still produces a window.
  const workspaceOnly = buildWarpWindows([
    { data: { workspacesMetadataForUser: [{ totalRequestsUsedSinceLastRefresh: 42 }] } }
  ]);
  assert.equal(workspaceOnly[0].used, 42);
});

test('buildWarpWindows returns nothing for an unrecognized payload', () => {
  assert.deepEqual(buildWarpWindows([{ data: {} }]), []);
  assert.deepEqual(buildWarpWindows([null]), []);
});

test('fetchWarpLimits reports notConfigured without a credential', async () => {
  const result = await fetchWarpLimits({}, {});
  assert.equal(result.provider, 'warp');
  assert.equal(result.status, 'notConfigured');
  assert.equal(result.windows.length, 0);
});

test('fetchWarpLimits posts both operations with the bearer key and normalizes windows', async () => {
  const seen = [];
  const result = await fetchWarpLimits({ warpApiKey: 'wk-test' }, {
    fetch: async (url, init) => {
      seen.push({ url, auth: init.headers.Authorization, op: JSON.parse(init.body).operationName });
      const op = JSON.parse(init.body).operationName;
      if (op === 'GetRequestLimitInfo') {
        return jsonResponse(limitInfoBody({ requestLimit: 200, requestsUsedSinceLastRefresh: 20 }));
      }
      return jsonResponse({ data: { workspacesMetadataForUser: [] } });
    }
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'api');
  assert.equal(result.windows.length, 1);
  assert.ok(result.accountKey, 'expected a hashed account key');
  assert.deepEqual(seen.map((entry) => entry.op), ['GetRequestLimitInfo', 'GetWorkspacesMetadataForUser']);
  for (const entry of seen) {
    assert.equal(entry.url, WARP_GRAPHQL_ENDPOINT);
    assert.equal(entry.auth, 'Bearer wk-test');
  }
});

test('fetchWarpLimits sends a Cookie header when the credential is cookie-shaped', async () => {
  let headers = null;
  await fetchWarpLimits({ warpCookie: 'session=xyz' }, {
    fetch: async (url, init) => {
      headers = init.headers;
      const op = JSON.parse(init.body).operationName;
      return op === 'GetRequestLimitInfo'
        ? jsonResponse(limitInfoBody({ requestsUsedSinceLastRefresh: 1 }))
        : jsonResponse({ data: {} });
    }
  });
  assert.equal(headers.Cookie, 'session=xyz');
  assert.equal(headers.Authorization, undefined);
});

test('fetchWarpLimits maps HTTP status codes to probe statuses', async () => {
  const at = (status) => fetchWarpLimits({ warpApiKey: 'wk-x' }, {
    fetch: async () => jsonResponse({}, status)
  });
  assert.equal((await at(401)).status, 'unauthorized');
  assert.equal((await at(403)).status, 'unauthorized');
  assert.equal((await at(429)).status, 'sourceRateLimited');
  assert.equal((await at(500)).status, 'unavailable');
});

test('fetchWarpLimits survives a network failure and an unparseable payload', async () => {
  const network = await fetchWarpLimits({ warpApiKey: 'wk-x' }, {
    fetch: async () => { throw new Error('ECONNRESET'); }
  });
  assert.equal(network.status, 'unavailable');
  const empty = await fetchWarpLimits({ warpApiKey: 'wk-x' }, {
    fetch: async (url, init) => (JSON.parse(init.body).operationName === 'GetRequestLimitInfo'
      ? jsonResponse({ data: {} })
      : jsonResponse({ data: {} }))
  });
  assert.equal(empty.status, 'unavailable');
  assert.deepEqual(empty.windows, []);
});

// The Hub nulls env and has no tokscale cache, so the config gate is the only
// thing standing between a pasted key and a working provider.
test('probeLimitProvider reaches the Warp fetcher for a Hub-supplied key', async () => {
  const rows = await probeLimitProvider('warp', {
    limitProviders: 'warp',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true,
    warpApiKey: 'wk-hub'
  }, {}, {
    fetch: async (url, init) => (JSON.parse(init.body).operationName === 'GetRequestLimitInfo'
      ? jsonResponse(limitInfoBody({ requestLimit: 10, requestsUsedSinceLastRefresh: 5 }))
      : jsonResponse({ data: {} }))
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].windows.length, 1);
});

test('probeLimitProvider returns no rows for Warp without a key', async () => {
  const rows = await probeLimitProvider('warp', {
    limitProviders: 'warp',
    limitProviderAuthority: 'hub',
    suppressAutoDetectedAccounts: true
  }, {}, {
    fetch: async () => { throw new Error('warp must not be probed without a credential'); }
  });
  assert.deepEqual(rows, []);
});
