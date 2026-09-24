'use strict';

// An SSE client that disconnects while the initial `getStats()` is still running
// must not stay registered. Node emits 'close' exactly once, and the handler used
// to be attached only after that await, so every such disconnect leaked a dead
// response plus its heartbeat interval for the process lifetime. Because the leak
// rate is proportional to getStats() latency, a busy Hub leaked fastest and could
// only recover by restarting.

const assert = require('node:assert/strict');
const test = require('node:test');

const { createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

function createMemoryHub(options = {}) {
  const repository = options.repository || new MemoryRepository();
  return {
    repository,
    hub: createHub({
      port: 0,
      host: '127.0.0.1',
      secret: '',
      repository,
      logger: { error() {}, warn() {} },
      ...options
    })
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function payload(totalTokens, deviceId = 'dev-a') {
  return {
    deviceId,
    updatedAt: '2026-07-18T00:00:00.000Z',
    allTime: { totalTokens, clients: { codex: totalTokens }, models: { 'gpt-5': totalTokens } },
    today: { totalTokens },
    month: { totalTokens }
  };
}

test('clients that disconnect during the initial getStats are not retained', async () => {
  const { hub, repository } = createMemoryHub();
  const original = repository.listDeviceRecords.bind(repository);
  const gate = deferred();
  let delayReads = true;
  repository.listDeviceRecords = async (...args) => {
    if (delayReads) await gate.promise;
    return original(...args);
  };

  await hub.start();
  const { port } = hub.server.address();
  const controllers = [];
  const waitFor = async (predicate, label) => {
    const deadline = Date.now() + 3000;
    while (!predicate() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(predicate(), label);
  };

  try {
    // Open several streams. They all await the same in-flight stats computation
    // (concurrent readers coalesce onto one recompute), so every one of them is
    // registered before any snapshot exists.
    const settled = [];
    for (let index = 0; index < 5; index += 1) {
      const controller = new AbortController();
      controllers.push(controller);
      settled.push(
        fetch(`http://127.0.0.1:${port}/api/stats/stream`, { signal: controller.signal }).catch(() => {})
      );
    }
    await waitFor(() => hub.getSseClientCount() === 5, 'all five streams should register before the snapshot is ready');

    // Abort them all mid-await, then let the shared stats computation finish.
    for (const controller of controllers) controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 30));
    delayReads = false;
    gate.resolve();

    await waitFor(() => hub.getSseClientCount() === 0, 'aborted streams must be dropped from the registry');
    await Promise.allSettled(settled);
  } finally {
    delayReads = false;
    gate.resolve();
    await hub.stop();
  }
});

test('a live stream still receives its snapshot and later broadcasts', async () => {
  const { hub } = createMemoryHub({ sseHeartbeatMs: 50 });
  await hub.start();
  const controller = new AbortController();
  try {
    const { port } = hub.server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/stats/stream`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const deadline = Date.now() + 2000;
    while (!text.includes('event: stats') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    assert.match(text, /event: snapshot/, 'the first frame should be the snapshot');
    assert.equal(hub.getSseClientCount(), 1);

    await hub.ingest(payload(7));
    text = '';
    const ingestDeadline = Date.now() + 2000;
    while (!text.includes('event: stats') && Date.now() < ingestDeadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    assert.match(text, /event: stats/);
    assert.match(text, /"totalTokens":7/);
    await reader.cancel();
  } finally {
    controller.abort();
    await hub.stop();
  }
});

test('a broadcast during the initial getStats does not break the SSE content type', async () => {
  // The stream is registered before its snapshot is ready. If a broadcast wrote to
  // it in that window, Node would emit an implicit writeHead() with the default
  // content type and the client would stop parsing SSE frames. writeSse() must
  // skip frames until the handler has written the SSE headers.
  const { hub, repository } = createMemoryHub();
  const original = repository.listDeviceRecords.bind(repository);
  const gate = deferred();
  let delayReads = true;
  repository.listDeviceRecords = async (...args) => {
    if (delayReads) await gate.promise;
    return original(...args);
  };

  await hub.start();
  const { port } = hub.server.address();
  const controller = new AbortController();
  try {
    const responsePromise = fetch(`http://127.0.0.1:${port}/api/stats/stream`, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(hub.getSseClientCount(), 1, 'the stream registers before its snapshot is ready');

    // Release the gate so the parked handler can finish and write its headers.
    delayReads = false;
    gate.resolve();

    const response = await responsePromise;
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-type') || '',
      /text\/event-stream/,
      'the stream must negotiate the SSE content type even when a frame was skipped'
    );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const deadline = Date.now() + 2000;
    while (!text.includes('event: snapshot') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    assert.match(text, /event: snapshot/, 'the snapshot must arrive once the stream is ready');
    await reader.cancel();
    controller.abort();
  } finally {
    delayReads = false;
    gate.resolve();
    await hub.stop();
  }
});

test('rotating cf-connecting-ip cannot bypass the auth-failure limiter', async () => {
  // The forwarded-header branch used to run even with trustProxy off, so an
  // unauthenticated caller chose its own limiter bucket per request.
  const { hub } = createMemoryHub({ secret: 'correct-secret', authFailureLimit: 3 });
  await hub.start();
  const { port } = hub.server.address();
  try {
    let sawRateLimit = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/api/stats`, {
        headers: { authorization: 'Bearer wrong-secret', 'cf-connecting-ip': `10.0.0.${attempt}` }
      });
      if (response.status === 429) { sawRateLimit = true; break; }
      assert.equal(response.status, 401, 'a bad secret should be unauthorized');
    }
    assert.ok(sawRateLimit, 'spoofing cf-connecting-ip must not evade the auth-failure limit');
  } finally {
    await hub.stop();
  }
});

test('a trusted proxy still gets per-client buckets', async () => {
  const { hub } = createMemoryHub({
    secret: 'correct-secret',
    authFailureLimit: 2,
    trustProxy: true
  });
  await hub.start();
  const { port } = hub.server.address();
  try {
    const attempt = (ip) => fetch(`http://127.0.0.1:${port}/api/stats`, {
      headers: { authorization: 'Bearer wrong-secret', 'cf-connecting-ip': ip }
    });
    // Two failures for each of two distinct forwarded clients: each pair stays
    // within its own bucket, so neither should see a 429 yet.
    assert.equal((await attempt('203.0.113.1')).status, 401);
    assert.equal((await attempt('203.0.113.2')).status, 401);
    assert.equal((await attempt('203.0.113.1')).status, 401);
    // The first client's third failure now exceeds its bucket.
    assert.equal((await attempt('203.0.113.1')).status, 429);
  } finally {
    await hub.stop();
  }
});

test('the SSE registry refuses new streams past its cap', async () => {
  // A read-credential holder could otherwise open unbounded long-lived sockets,
  // each costing a descriptor, a heartbeat interval and a share of every broadcast.
  const { hub } = createMemoryHub({ maxSseClients: 2 });
  await hub.start();
  const { port } = hub.server.address();
  const controllers = [];
  const activeResponses = [];
  try {
    const open = () => {
      const controller = new AbortController();
      controllers.push(controller);
      return fetch(`http://127.0.0.1:${port}/api/stats/stream`, { signal: controller.signal });
    };
    activeResponses.push(await open(), await open());
    assert.deepEqual(activeResponses.map((response) => response.status), [200, 200]);
    // The third stream is refused rather than evicting a live one.
    const refused = await open();
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).error, 'too_many_streams');
    assert.equal(hub.getSseClientCount(), 2, 'existing streams must survive');
  } finally {
    for (const controller of controllers) controller.abort();
    await hub.stop();
  }
});
