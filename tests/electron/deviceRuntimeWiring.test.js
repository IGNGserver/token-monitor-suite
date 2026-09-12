'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { runManualDeviceRefresh } = require('../../src/electron/deviceRuntimeCoordinator');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

for (const mode of ['local', 'client']) {
  test(`${mode} manual refresh awaits usage without a local limits refresh`, async () => {
    const usage = deferred();
    const calls = [];
    const runtime = {
      tick(reason, options) {
        calls.push(['usage', reason, options]);
        return usage.promise;
      }
    };

    let completed = false;
    const refresh = runManualDeviceRefresh(runtime, { forceHistory: true }).then(() => { completed = true; });
    await Promise.resolve();
    assert.deepEqual(calls, [['usage', 'manual', { forceHistory: true }]]);
    usage.resolve();
    await refresh;
    assert.equal(completed, true);
  });
}

test('manual refresh does not invoke a local limits failure handler', async () => {
  const runtime = {
    tick: async () => {}
  };
  assert.deepEqual(await runManualDeviceRefresh(runtime), { ok: true });
});

test('manual refresh reports a handled usage tick failure', async () => {
  const runtime = {
    refreshLimits: async () => {},
    tick: async () => false
  };

  assert.deepEqual(await runManualDeviceRefresh(runtime), {
    ok: false,
    code: 'collection_failed'
  });
});
