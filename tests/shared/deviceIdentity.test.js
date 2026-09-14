'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeDeviceIdentity,
  readDeviceIdentity,
  renameDeviceOnHub,
  writeDeviceIdentity
} = require('../../src/shared/deviceIdentity');

test('device identity is normalized and persisted in a shared state file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-identity-'));
  const identityPath = path.join(tempDir, 'device-identity.json');

  try {
    assert.deepEqual(normalizeDeviceIdentity({ deviceId: '  old-device  ' }), {
      version: 1,
      lastPostedDeviceId: 'old-device'
    });
    assert.deepEqual(readDeviceIdentity({ path: identityPath }), {
      version: 1,
      lastPostedDeviceId: ''
    });
    writeDeviceIdentity(' new-device ', { path: identityPath });
    assert.deepEqual(readDeviceIdentity({ path: identityPath }), {
      version: 1,
      lastPostedDeviceId: 'new-device'
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('shared device rename moves the old Hub identity before the next ingest', async () => {
  const requests = [];
  const fetchFn = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/api/devices')) {
      return new Response(JSON.stringify({ devices: [{ deviceId: 'old-device' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response('', { status: 200 });
  };

  assert.equal(
    await renameDeviceOnHub(fetchFn, 'https://hub.example.test', 'secret', 'old-device', 'new-device'),
    true
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://hub.example.test/api/devices');
  assert.equal(requests[1].url, 'https://hub.example.test/api/devices/old-device/rename');
  assert.equal(requests[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body), { deviceId: 'new-device' });
  assert.equal(requests[1].options.headers.authorization, 'Bearer secret');
});

test('shared device rename reports forbidden admin migration explicitly', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/api/devices')) {
      return new Response(JSON.stringify({ devices: [{ deviceId: 'old-device' }] }), { status: 200 });
    }
    return new Response('', { status: 403 });
  };

  await assert.rejects(
    renameDeviceOnHub(fetchFn, 'https://hub.example.test', '', 'old-device', 'new-device'),
    (error) => error.code === 'forbidden' && error.status === 403
  );
});
