'use strict';

// The diagnostics bundle is the one place the app writes a settings dump to disk
// for someone else to read, so its allowlist is the privacy boundary. These tests
// are deliberately written as "a secret must not appear anywhere in the file":
// a future key added to the allowlist by mistake still fails here if it reads like
// a credential.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DIAGNOSTIC_SETTING_KEYS,
  buildDiagnosticsBundle,
  diagnosticsFileName
} = require('../../src/electron/diagnostics');

function bundle() {
  return buildDiagnosticsBundle({
    appInfo: () => ({ version: '1.2.0-rev.3', platform: 'win32', arch: 'x64', userData: 'C:\\Users\\me\\token-monitor' }),
    settings: () => ({
      hubMode: 'client',
      hubUrl: 'http://192.168.1.20:17321',
      deviceId: 'workstation',
      collectionPaused: true,
      theme: 'dark',
      secret: 'super-secret-hub-token',
      claudeWebCookie: 'session=abc',
      zaiApiKey: 'sk-should-not-appear',
      windowBounds: { x: 10, y: 20 },
      archivedClientUsage: { version: 1, clients: { claude: 1 } }
    }),
    tokscaleStatus: () => ({ supported: true, current: { source: 'bundled', version: '4.14.0' } }),
    syncHealth: () => ({ local: { state: 'paused' }, upload: { state: 'ok', authorization: 'Bearer nope' } }),
    appUpdate: () => ({ currentVersion: '1.2.0-rev.3', hasUpdate: false }),
    snapshotMeta: () => ({ source: 'local-cache' }),
    limitsSummary: () => [{ provider: 'claude', status: 'ok', stale: false, windowCount: 2 }]
  });
}

test('the bundle carries the settings that explain a broken install', () => {
  const serialized = JSON.stringify(bundle());
  assert.match(serialized, /"hubMode":"client"/);
  assert.match(serialized, /"collectionPaused":true/);
  assert.match(serialized, /"state":"paused"/);
  assert.match(serialized, /"source":"bundled","version":"4.14.0"/);
});

test('no credential-shaped value or runtime-state blob reaches the file', () => {
  const serialized = JSON.stringify(bundle());
  for (const leaked of ['super-secret-hub-token', 'session=abc', 'sk-should-not-appear', 'Bearer nope']) {
    assert.ok(!serialized.includes(leaked), `the bundle must not contain ${leaked}`);
  }
  for (const key of ['secret', 'cookie', 'apiKey', 'authorization', 'windowBounds', 'archivedClientUsage']) {
    assert.ok(!new RegExp(`"${key}"\\s*:`).test(serialized), `"${key}" must not appear even as a key`);
  }
});

test('the allowlist itself contains no credential keys', () => {
  const credentialShape = /(^|[^a-z])(secret|cookie|credential|password|authorization|api[-_]?key|token)/i;
  const offenders = DIAGNOSTIC_SETTING_KEYS.filter((key) => credentialShape.test(key));
  assert.deepEqual(offenders, []);
});

test('the file name is safe for any filesystem and names the build', () => {
  const name = diagnosticsFileName('1.2.0-rev.3+build~1');
  assert.match(name, /^token-monitor-diagnostics-1\.2\.0-rev\.3-build-1-\d{8}T\d{6}\.json$/);
  assert.equal(diagnosticsFileName(undefined).includes('-unknown-'), true);
});
