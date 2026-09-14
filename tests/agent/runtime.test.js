'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { runAgent, runAgentOnce } = require('../../src/agent/runtime');

function runtimeHarness() {
  let usageOptions;
  let limitsFactoryCalls = 0;
  const deps = {
    deviceRuntimeDeps: {
      createUsageRuntime(options) {
        usageOptions = options;
        return {
          stop() {},
          tick() {},
          refreshClient() {}
        };
      },
      createLimitsRuntime() {
        limitsFactoryCalls += 1;
        throw new Error('agent limits runtime must not be constructed');
      }
    }
  };
  return {
    deps,
    limitsFactoryCalls: () => limitsFactoryCalls,
    usageError: (error) => usageOptions.onError(error, 'startup'),
    usageUpdate: (summary) => usageOptions.onUpdate(summary, 'startup')
  };
}

function usageSummary(tokens = 1) {
  return {
    deviceId: 'device-1',
    updatedAt: 'usage-time',
    today: { totalTokens: tokens },
    month: { totalTokens: tokens },
    allTime: { totalTokens: tokens }
  };
}

test('long-running agent posts usage without starting a local limits collector', async () => {
  const harness = runtimeHarness();
  const firstSend = new Promise((resolve) => { harness.releaseFirstSend = resolve; });
  const delivered = [];
  let active = 0;
  let maxActive = 0;
  const runtime = runAgent({
    envelope: { deviceId: 'device-1' },
    limitsOptions: {},
    async deliver(record) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      delivered.push(record);
      if (delivered.length === 1) await firstSend;
      active -= 1;
    }
  }, harness.deps);

  harness.usageUpdate(usageSummary(10));
  await new Promise(setImmediate);
  assert.equal(delivered.length, 1);
  assert.equal(harness.limitsFactoryCalls(), 0);
  harness.releaseFirstSend();
  await runtime.flush();

  assert.equal(delivered[0].today.totalTokens, 10);
  assert.equal(Object.hasOwn(delivered[0], 'limits'), false);
  assert.equal(maxActive, 1);
  runtime.stop();
});
test('long-running agent reports one owned error for a failed delivery', async () => {
  const harness = runtimeHarness();
  const expected = new Error('post failed');
  const errors = [];
  const runtime = runAgent({
    envelope: { deviceId: 'device-1' },
    deliver: async () => { throw expected; },
    onError: (...args) => errors.push(args)
  }, harness.deps);

  harness.usageUpdate(usageSummary(9));
  await runtime.flush();
  assert.deepEqual(errors, [[expected, 'sink']]);
  runtime.stop();
});

test('normal once posts exactly one usage record', async () => {
  const harness = runtimeHarness();
  const delivered = [];
  const running = runAgentOnce({
    envelope: { deviceId: 'device-1' },
    deliver: async (record) => delivered.push(record)
  }, harness.deps);

  harness.usageUpdate(usageSummary(11));
  const final = await running;

  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].today.totalTokens, 11);
  assert.equal(Object.hasOwn(delivered[0], 'limits'), false);
  assert.deepEqual(final, delivered[0]);
});

test('once rejects when the final Hub upload fails', async () => {
  const harness = runtimeHarness();
  const failure = Object.assign(new Error('Hub unavailable'), { status: 503 });
  const running = runAgentOnce({
    envelope: { deviceId: 'device-1' },
    deliver: async () => { throw failure; }
  }, harness.deps);

  harness.usageUpdate(usageSummary(13));
  await assert.rejects(running, (error) => (
    error.message === 'headless upload failed (hub_server_error)'
      && error.status === 503
      && error.code === 'hub_server_error'
  ));
});

test('dry-run once waits for usage and emits one final JSON record', async () => {
  const harness = runtimeHarness();
  const delivered = [];
  const running = runAgentOnce({
    dryRun: true,
    envelope: { deviceId: 'device-1' },
    deliver: async (record) => delivered.push(record)
  }, harness.deps);

  const resultPromise = running;
  await new Promise(setImmediate);
  assert.deepEqual(delivered, []);
  harness.usageUpdate(usageSummary(12));
  const result = await resultPromise;

  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].today.totalTokens, 12);
  assert.equal(Object.hasOwn(delivered[0], 'limits'), false);
  assert.deepEqual(result, delivered[0]);
});

test('once rejects and stops when the initial usage collection fails', async () => {
  const harness = runtimeHarness();
  const running = runAgentOnce({
    envelope: { deviceId: 'device-1' },
    deliver: async () => {}
  }, harness.deps);
  harness.usageError(new Error('usage failed'));
  await assert.rejects(running, /usage failed/);
});
