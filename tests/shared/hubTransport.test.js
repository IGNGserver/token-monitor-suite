'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectHubTransport, requireSafeHubTransport } = require('../../src/shared/hubTransport');

test('Hub transport accepts HTTPS and loopback HTTP by default', () => {
  assert.equal(inspectHubTransport('https://hub.example').allowedByDefault, true);
  assert.equal(inspectHubTransport('http://127.9.8.7:17321').allowedByDefault, true);
  assert.equal(inspectHubTransport('http://[::1]:17321').allowedByDefault, true);
});

test('remote HTTP requires an explicit opt-in', () => {
  assert.throws(() => requireSafeHubTransport('http://192.168.1.10:17321'), { code: 'insecure_hub_transport' });
  assert.equal(
    requireSafeHubTransport('http://192.168.1.10:17321', { allowInsecureHttp: true }),
    'http://192.168.1.10:17321'
  );
});
