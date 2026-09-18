'use strict';

// Reasonix native sessions/projects travel only in summary.nativeSessions /
// nativeProjects (Reasonix is excluded from the ordinary session path).
// aggregateDevices() is a wire-record whitelist and drops both, so every display
// path has to reattach them. Sync mode always did; local mode — the default —
// did not, which left its session/project views empty for Reasonix.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { aggregateDevices } = require('../../src/shared/usage');
const { reattachLocalNativeView } = require('../../src/electron/syncDisplayStats');

const rootDir = path.join(__dirname, '..', '..');

function localDeviceWithNativeView() {
  return {
    deviceId: 'local-dev',
    hostname: 'host',
    updatedAt: '2026-07-18T00:00:00.000Z',
    periods: {
      today: { totalTokens: 5, costUsd: 0.01, clients: { reasonix: 5 }, sessions: {} },
      month: { totalTokens: 5, costUsd: 0.01, clients: { reasonix: 5 }, sessions: {} },
      allTime: { totalTokens: 5, costUsd: 0.01, clients: { reasonix: 5 }, sessions: {} }
    },
    nativeSessions: { today: [{ sessionId: 'r-1', totalTokens: 5 }] },
    nativeProjects: { today: [{ projectId: 'p-1', totalTokens: 5 }] }
  };
}

test('aggregateDevices drops the native view, so reattaching is required', () => {
  const device = localDeviceWithNativeView();
  const stats = aggregateDevices([device], 0);
  assert.equal(stats.nativeSessions, undefined, 'aggregateDevices is expected to drop nativeSessions');
  assert.equal(stats.nativeProjects, undefined, 'aggregateDevices is expected to drop nativeProjects');

  const reattached = reattachLocalNativeView(stats, device);
  assert.deepEqual(reattached.nativeSessions, device.nativeSessions);
  assert.deepEqual(reattached.nativeProjects, device.nativeProjects);
  // The aggregate itself must be untouched.
  assert.equal(stats.nativeSessions, undefined);
});

test('reattaching is a no-op when the collector produced no native view', () => {
  const stats = aggregateDevices([{ deviceId: 'd', periods: {} }], 0);
  assert.equal(reattachLocalNativeView(stats, { deviceId: 'd' }), stats);
  assert.equal(reattachLocalNativeView(stats, null), stats);
});

test('the local collector path reattaches the native view', () => {
  const main = fs.readFileSync(path.join(rootDir, 'src', 'electron', 'main.js'), 'utf8');
  const localStart = main.indexOf('function startLocalCollector(');
  assert.notEqual(localStart, -1);
  const localBody = main.slice(localStart, main.indexOf('\nfunction ', localStart + 10));
  assert.match(
    localBody,
    /reattachLocalNativeView\(/,
    'startLocalCollector must reattach nativeSessions/nativeProjects onto localStats'
  );
});

test('the local native view is never uploaded', () => {
  // These fields are display-only and must stay out of the wire payload.
  const payload = fs.readFileSync(path.join(rootDir, 'src', 'shared', 'syncPayload.js'), 'utf8');
  assert.match(payload, /nativeSessions/, 'syncPayload should still strip native sessions from uploads');
});
