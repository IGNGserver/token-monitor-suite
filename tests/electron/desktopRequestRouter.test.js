'use strict';

// The desktop client serves the shared UI's `/api/*` vocabulary from local data
// or a Hub proxy. These tests pin that mapping, because getting it wrong is
// silent: a view would simply render an empty state that looks like real data.

const assert = require('node:assert/strict');
const test = require('node:test');

const { createRequestRouter, splitPath } = require('../../src/electron/desktopRequestRouter');

function router(overrides = {}) {
  const calls = [];
  const instance = createRequestRouter({
    getStats: () => ({ periods: {}, devices: [] }),
    getHistory: () => ({ daily: [] }),
    getCustomRange: (input) => ({ ok: true, period: { totalTokens: 100, range: input } }),
    getSessionDetail: (args) => ({ sessions: [], args }),
    getCapabilities: () => ({ capabilities: { stats: true } }),
    getRates: () => ({ rates: { USD: 1 } }),
    hubRequest: async (path, options) => {
      calls.push({ path, options });
      return { proxied: path };
    },
    ...overrides
  });
  return { instance, calls };
}

test('splitPath strips the /api prefix and parses the query', () => {
  assert.deepEqual(splitPath('/api/stats'), { path: '/stats', query: new URLSearchParams() });
  assert.equal(splitPath('/api/accounts/abc?x=1').path, '/accounts/abc');
  assert.equal(splitPath('/api/accounts/abc?x=1').query.get('x'), '1');
  // A path with no query must not keep a trailing slash that would miss a match.
  assert.equal(splitPath('/api/history/').path, '/history');
});

test('device-local reads never touch the Hub', async () => {
  const { instance, calls } = router();
  const stats = await instance.route('/api/stats');
  assert.deepEqual(stats, { periods: {}, devices: [] });
  await instance.route('/api/history');
  await instance.route('/api/rates');
  await instance.route('/api/capabilities');
  const health = await instance.route('/api/health');
  assert.equal(health.ok, true);
  assert.equal(health.secretRequired, false);
  assert.deepEqual(calls, [], 'local routes must not be proxied');
});

test('Hub-owned resources are proxied with method and query preserved', async () => {
  const { instance, calls } = router();
  await instance.route('/api/accounts');
  await instance.route('/api/accounts/abc-1', { method: 'PATCH', body: { name: 'x' } });
  await instance.route('/api/subscriptions', { method: 'PUT', body: { subscriptions: [] } });
  await instance.route('/api/pricing/gpt-5', { method: 'PUT', body: {} });
  await instance.route('/api/devices/dev-1/rename', { method: 'POST', body: { deviceId: 'd2' } });

  assert.deepEqual(calls.map((c) => `${c.options.method} ${c.path}`), [
    'GET /api/accounts',
    'PATCH /api/accounts/abc-1',
    'PUT /api/subscriptions',
    'PUT /api/pricing/gpt-5',
    'POST /api/devices/dev-1/rename'
  ]);
});

test('a custom range query is converted into the date+hour parts the collector wants', async () => {
  const { instance } = router();
  const result = await instance.route('/api/usage/range?from=2026-03-04T05:06:07.000Z&to=2026-03-06T08:09:10.000Z');
  assert.equal(result.range.startDate, '2026-03-04');
  assert.equal(result.range.endDate, '2026-03-06');
  // Preserve the selected end hour; widening it to 23 silently changed a
  // precise datetime range into a full-day query.
  assert.equal(result.range.endHour, new Date('2026-03-06T08:09:10.000Z').getHours());
  assert.equal(result.range.startHour, new Date('2026-03-04T05:06:07.000Z').getHours());
});

test('a malformed custom range fails loudly instead of silently widening', async () => {
  const { instance } = router();
  await assert.rejects(
    () => instance.route('/api/usage/range?from=not-a-date&to=2026-03-06T00:00:00.000Z'),
    (error) => error.code === 'invalid-range'
  );
});

test('an unknown route reports not_supported rather than returning undefined', async () => {
  const { instance } = router();
  await assert.rejects(
    () => instance.route('/api/something-new'),
    (error) => error.code === 'not_supported'
  );
});

test('a missing Hub surfaces the configured-code error, not an empty object', async () => {
  const { instance } = router({
    hubRequest: async () => {
      const error = new Error('Hub is not configured');
      error.code = 'hub_not_configured';
      throw error;
    }
  });
  await assert.rejects(
    () => instance.route('/api/accounts'),
    (error) => error.code === 'hub_not_configured'
  );
});
