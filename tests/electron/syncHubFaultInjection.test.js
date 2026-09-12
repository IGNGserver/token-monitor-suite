'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { postSyncPayload } = require('../../src/shared/syncPayload');
const { createSyncUploadScheduler } = require('../../src/electron/syncUploadScheduler');

function waitFor(predicate, timeoutMs = 2000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - startedAt >= timeoutMs) return reject(new Error('condition timed out'));
      setTimeout(check, 5).unref?.();
    };
    check();
  });
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function startFakeHub(handler) {
  const sockets = new Set();
  const server = http.createServer(handler);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

function summary(id) {
  return {
    deviceId: id,
    hostname: 'fake-hub-test',
    platform: 'linux-x64',
    updatedAt: new Date().toISOString(),
    today: { totalTokens: 1, costUsd: 0, clients: { claude: 1 } },
    month: { totalTokens: 1, costUsd: 0, clients: { claude: 1 } },
    allTime: { totalTokens: 1, costUsd: 0, clients: { claude: 1 } }
  };
}

function createNetworkUploader(url, timeoutMs = 500) {
  let active = 0;
  let maxActive = 0;
  const starts = [];
  const upload = async (value, context) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    starts.push(value.deviceId);
    try {
      return await postSyncPayload(fetch, `${url}/api/ingest`, {
        summary: value,
        signal: context.signal,
        timeoutMs,
        headers: { 'content-type': 'application/json' }
      });
    } finally {
      active -= 1;
    }
  };
  return { upload, starts, getMaxActive: () => maxActive };
}

test('a real half-open POST is bounded and manual recovery uploads only the latest summary', async (t) => {
  const requests = [];
  let firstHeadersSent = false;
  const hub = await startFakeHub(async (req, res) => {
    const body = await readRequest(req);
    const parsed = JSON.parse(body);
    requests.push(parsed.deviceId);
    if (requests.length === 1) {
      firstHeadersSent = true;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.flushHeaders();
      await new Promise((resolve) => {
        const done = () => resolve();
        req.once('close', done);
        res.once('close', done);
      });
      return;
    }
    res.end('{}');
  });
  t.after(() => hub.close());

  const network = createNetworkUploader(hub.url, 5000);
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    flushTimeoutMs: 1000,
    upload: network.upload
  });
  t.after(() => scheduler.stop());

  const first = scheduler.enqueue(summary('first'));
  await waitFor(() => firstHeadersSent);
  await scheduler.enqueue(summary('latest'));

  const recovery = scheduler.retryNow({ abortActive: true, timeoutMs: 1000 });
  await Promise.all([first, recovery]);

  assert.deepEqual(requests, ['first', 'latest']);
  assert.deepEqual(network.starts, ['first', 'latest']);
  assert.equal(network.getMaxActive(), 1, 'the scheduler must not overlap POSTs');
  assert.equal(scheduler.getDiagnostics().failureCode, null);
  assert.equal(scheduler.getDiagnostics().pendingRevision, null);
});

test('a fake Hub 503 is retained for retry, then a complete 200 body clears the failure', async (t) => {
  const statuses = [503, 200];
  const requests = [];
  const hub = await startFakeHub(async (req, res) => {
    const body = await readRequest(req);
    requests.push(JSON.parse(body).deviceId);
    const status = statuses.shift() ?? 200;
    res.writeHead(status, {
      'content-type': 'application/json',
      ...(status === 503 ? { 'retry-after': '60' } : {})
    });
    res.end(status === 200 ? '{}' : '{"error":"busy"}');
  });
  t.after(() => hub.close());

  const network = createNetworkUploader(hub.url, 500);
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    retryBaseMs: 1000,
    retryMaxMs: 60_000,
    random: () => 0,
    upload: network.upload
  });
  t.after(() => scheduler.stop());

  await assert.rejects(scheduler.enqueue(summary('retryable')), /upload returned 503/);
  assert.equal(scheduler.getDiagnostics().failureCode, 'hub_server_error');
  assert.equal(scheduler.getDiagnostics().status, 503);
  assert.equal(scheduler.getDiagnostics().pendingRevision, 1);

  const retried = await scheduler.retryNow();
  assert.equal(retried.ok, true);
  assert.deepEqual(requests, ['retryable', 'retryable']);
  assert.equal(scheduler.getDiagnostics().failureCode, null);
  assert.equal(scheduler.getDiagnostics().pendingRevision, null);
});

test('a fake Hub that sends headers but never completes the POST body hits the request deadline', async (t) => {
  let closed = false;
  const hub = await startFakeHub(async (req, res) => {
    await readRequest(req);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.flushHeaders();
    await new Promise((resolve) => {
      const done = () => {
        closed = true;
        resolve();
      };
      req.once('close', done);
      res.once('close', done);
    });
  });
  t.after(() => hub.close());

  await assert.rejects(
    postSyncPayload(fetch, `${hub.url}/api/ingest`, {
      summary: summary('body-timeout'),
      timeoutMs: 50,
      headers: { 'content-type': 'application/json' }
    }),
    (error) => error?.code === 'request_timeout'
  );
  await waitFor(() => closed);
});
