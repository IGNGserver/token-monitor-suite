'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

let workerModule;

function createState() {
  const values = new Map();
  const storage = {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, structuredClone(value)); },
    async delete(key) { values.delete(key); },
    async list({ prefix } = {}) {
      return new Map([...values.entries()].filter(([key]) => !prefix || key.startsWith(prefix)));
    },
    async transaction(callback) { return callback(storage); }
  };
  return { storage, values };
}

function request(pathname, secret, options = {}) {
  return new Request(`https://hub.example${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      ...(options.headers || {})
    }
  });
}

test('Worker publishes feature capabilities and enforces scoped credentials', async () => {
  workerModule ||= await import(pathToFileURL(path.resolve(__dirname, '../../worker/src/index.js')).href);
  const state = createState();
  const hub = new workerModule.HubDO(state, {
    TOKEN_MONITOR_ADMIN_SECRET: 'admin-token',
    TOKEN_MONITOR_VIEWER_SECRET: 'viewer-token',
    TOKEN_MONITOR_INGEST_CREDENTIALS: JSON.stringify({ 'device-a': 'device-token' })
  });

  const health = await (await hub.fetch(request('/api/health'))).json();
  assert.equal(health.apiVersion, 2);
  assert.equal(health.capabilities.usageRange, false);
  assert.equal(health.capabilities.pricing, false);

  const viewerCapabilities = await (await hub.fetch(request('/api/capabilities', 'viewer-token'))).json();
  assert.deepEqual(viewerCapabilities.scopes, ['read']);
  assert.equal((await hub.fetch(request('/api/devices/device-a', 'viewer-token', { method: 'DELETE' }))).status, 403);

  const ownIngest = await hub.fetch(request('/api/ingest', 'device-token', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ deviceId: 'device-a', today: { totalTokens: 1 }, month: { totalTokens: 1 }, allTime: { totalTokens: 1 } })
  }));
  assert.equal(ownIngest.status, 200);
  assert.deepEqual(await ownIngest.json(), { ok: true, deviceId: 'device-a' });
  const impersonation = await hub.fetch(request('/api/ingest', 'device-token', {
    method: 'POST',
    body: JSON.stringify({ deviceId: 'device-b' })
  }));
  assert.equal(impersonation.status, 403);

  const renamed = await hub.fetch(request('/api/devices/device-a/rename', 'admin-token', {
    method: 'POST',
    body: JSON.stringify({ deviceId: 'device-c' })
  }));
  assert.equal(renamed.status, 200);
  assert.equal(state.values.has('dev:device-a'), false);
  assert.equal(state.values.has('dev:device-c'), true);
});

test('Worker only accepts query credentials for the read-only viewer role', async () => {
  workerModule ||= await import(pathToFileURL(path.resolve(__dirname, '../../worker/src/index.js')).href);
  const hub = new workerModule.HubDO(createState(), {
    TOKEN_MONITOR_ADMIN_SECRET: 'admin-token',
    TOKEN_MONITOR_VIEWER_SECRET: 'viewer-token'
  });
  assert.equal((await hub.fetch(request('/api/stats?secret=viewer-token'))).status, 200);
  assert.equal((await hub.fetch(request('/api/stats?secret=admin-token'))).status, 403);
});
