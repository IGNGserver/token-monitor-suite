'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

let workerModule;

function stateFor() {
  const values = new Map();
  return {
    storage: {
      async get(key) { return values.get(key); },
      async put(key, value) { values.set(key, structuredClone(value)); },
      async delete(key) { values.delete(key); },
      async list({ prefix } = {}) {
        return new Map([...values.entries()].filter(([key]) => !prefix || key.startsWith(prefix)));
      }
    },
    values
  };
}

async function hubFor() {
  workerModule ||= await import(pathToFileURL(path.resolve(__dirname, '../../worker/src/index.js')).href);
  const state = stateFor();
  return { hub: new workerModule.HubDO(state, { TOKEN_MONITOR_ADMIN_SECRET: 'shh' }), state };
}

function ingestRequest(body) {
  return new Request('https://hub.example/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer shh' },
    body: JSON.stringify(body)
  });
}

test('Worker rejects an oversized ingest body before normalizing it', async () => {
  const { hub, state } = await hubFor();
  const response = await hub.fetch(ingestRequest({ deviceId: 'too-large', padding: 'x'.repeat(1024 * 1024) }));
  const body = await response.json();
  assert.equal(response.status, 413);
  assert.equal(body.error, 'payload_too_large');
  assert.equal(state.values.size, 0);
});

test('Worker cancels an oversized streaming ingest as soon as the shared limit is crossed', async () => {
  const { hub, state } = await hubFor();
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024 + 1));
    },
    cancel() { cancelled = true; }
  });
  const request = new Request('https://hub.example/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer shh' },
    body: stream,
    duplex: 'half'
  });

  const response = await hub.fetch(request);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(state.values.size, 0);
});

test('Worker rejects identifiers beyond the shared SQL wire limits', async () => {
  const { hub, state } = await hubFor();
  const response = await hub.fetch(ingestRequest({ deviceId: 'd'.repeat(192) }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'field_too_long');
  assert.equal(body.field, 'deviceId');
  assert.equal(state.values.size, 0);
});
