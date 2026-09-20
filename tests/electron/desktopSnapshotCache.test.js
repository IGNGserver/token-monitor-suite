'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  DESKTOP_SNAPSHOT_CACHE_VERSION,
  emptyDesktopSnapshotCache,
  normalizeDesktopSnapshotCache,
  readDesktopSnapshotCache,
  writeDesktopSnapshotCache
} = require('../../src/electron/desktopSnapshotCache');

function sampleStats(totalTokens = 42) {
  return {
    devices: [{ deviceId: 'local', periods: { today: { totalTokens } } }],
    periods: { today: { totalTokens } }
  };
}

test('desktop snapshot cache is versioned and atomically restorable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-cache-'));
  const file = path.join(dir, 'desktop-stats-cache.json');
  try {
    const saved = writeDesktopSnapshotCache(file, {
      version: DESKTOP_SNAPSHOT_CACHE_VERSION,
      local: { capturedAt: '2026-09-20T00:00:00.000Z', stats: sampleStats(), device: { deviceId: 'local' } },
      hub: null
    });
    const restored = readDesktopSnapshotCache(file);
    assert.equal(saved.version, DESKTOP_SNAPSHOT_CACHE_VERSION);
    assert.equal(restored.local.stats.periods.today.totalTokens, 42);
    assert.equal(restored.local.device.deviceId, 'local');
    assert.ok(restored.updatedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid or incomplete snapshots are ignored instead of becoming data', () => {
  assert.equal(normalizeDesktopSnapshotCache({ version: 99 }), null);
  assert.equal(normalizeDesktopSnapshotCache({ version: DESKTOP_SNAPSHOT_CACHE_VERSION, local: { stats: null } }), null);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-cache-'));
  const file = path.join(dir, 'desktop-stats-cache.json');
  try {
    fs.writeFileSync(file, '{broken', 'utf8');
    assert.equal(readDesktopSnapshotCache(file), null);
    assert.deepEqual(emptyDesktopSnapshotCache(), {
      version: DESKTOP_SNAPSHOT_CACHE_VERSION,
      updatedAt: null,
      local: null,
      hub: null
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
