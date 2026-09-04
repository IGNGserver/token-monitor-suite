'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

function fakeState() {
  return { storage: { async list() { return new Map(); } } };
}

test('Worker SSE keeps only one in-flight write and the latest pending frame', async () => {
  const worker = await import(pathToFileURL(path.resolve(__dirname, '../../worker/src/index.js')).href);
  const hub = new worker.HubDO(fakeState(), { TOKEN_MONITOR_SECRET: 'shh' });
  const writes = [];
  const resolvers = [];
  const writer = {
    write(chunk) {
      writes.push(chunk);
      return new Promise((resolve) => resolvers.push(resolve));
    },
    close() {}
  };
  hub.sseClients.add(writer);
  hub.sseStates.set(writer, { pending: null, pendingKind: null, writing: false });

  try {
    hub.enqueueSse(writer, 'first');
    hub.enqueueSse(writer, 'heartbeat', 'heartbeat');
    hub.enqueueSse(writer, 'stale');
    hub.enqueueSse(writer, 'latest');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(writes, ['first']);

    resolvers.shift()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(writes, ['first', 'latest']);
    resolvers.shift()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(hub.sseClients.has(writer), true);
  } finally {
    hub.dropClient(writer);
    for (const resolve of resolvers) resolve();
  }
});

test('Worker SSE never lets a heartbeat replace a pending data frame', async () => {
  const worker = await import(pathToFileURL(path.resolve(__dirname, '../../worker/src/index.js')).href);
  const hub = new worker.HubDO(fakeState(), { TOKEN_MONITOR_SECRET: 'shh' });
  const writes = [];
  const resolvers = [];
  const writer = {
    write(chunk) {
      writes.push(chunk);
      return new Promise((resolve) => resolvers.push(resolve));
    },
    close() {}
  };
  hub.sseClients.add(writer);
  hub.sseStates.set(writer, { pending: null, pendingKind: null, writing: false });

  try {
    hub.enqueueSse(writer, 'first');
    hub.enqueueSse(writer, 'pending-data');
    await new Promise((resolve) => setImmediate(resolve));
    hub.enqueueSse(writer, 'heartbeat', 'heartbeat');
    assert.deepEqual(writes, ['first']);

    resolvers.shift()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(writes, ['first', 'pending-data']);
    resolvers.shift()();
  } finally {
    hub.dropClient(writer);
    for (const resolve of resolvers) resolve();
  }
});
