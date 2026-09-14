'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createSyncUploadSink,
  withSyncUploadMetadata
} = require('../../src/shared/syncUploadSink');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

test('shared sync sink adds the same cadence metadata before upload', async () => {
  const sent = [];
  const sink = createSyncUploadSink({
    intervalMs: 600000,
    upload: async (summary) => { sent.push(summary); }
  });

  await sink.enqueue({ deviceId: 'device-1', today: { totalTokens: 1 } }, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].syncUploadIntervalMs, 600000);
  assert.equal(withSyncUploadMetadata(null, 600000), null);
  sink.stop();
});

test('shared sync sink keeps the latest record while an upload is active', async () => {
  const active = deferred();
  const sent = [];
  const sink = createSyncUploadSink({
    upload: async (summary) => {
      sent.push(summary.today.totalTokens);
      if (summary.today.totalTokens === 1) await active.promise;
    }
  });

  const first = sink.enqueue({ today: { totalTokens: 1 } }, 1);
  const latest = sink.enqueue({ today: { totalTokens: 3 } }, 3);
  await new Promise(setImmediate);
  assert.deepEqual(sent, [1]);
  active.resolve();
  await Promise.all([first, latest]);
  assert.deepEqual(sent, [1, 3]);
  sink.stop();
});
