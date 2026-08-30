'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { cacheSessionTimestamps, positiveTimestamp } = require('../../src/shared/antigravityCacheRepair');

function makeCache() {
  // Keep the fixture beside the test so it also works in constrained runners
  // where the system temp volume can be quota-limited.
  const root = fs.mkdtempSync(path.join(__dirname, '.token-monitor-antigravity-'));
  fs.mkdirSync(path.join(root, 'sessions'));
  return root;
}

test('repairs null usage timestamps from the Antigravity manifest without touching other rows', (t) => {
  const root = makeCache();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({
    sessions: [
      { sessionId: 'active', lastModifiedMs: 1_756_560_000_000 },
      { sessionId: 'seconds', lastModifiedAt: '2026-08-30T12:00:00.000Z' }
    ]
  }));
  const rows = [
    { type: 'usage', sessionId: 'active', timestamp: null, input: 10 },
    { type: 'usage', sessionId: 'active', timestamp: 123, input: 20 },
    { type: 'message', sessionId: 'active', timestamp: null, text: 'keep' },
    { type: 'usage', sessionId: 'unknown', input: 30 }
  ];
  const file = path.join(root, 'sessions', 'active.jsonl');
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);

  assert.deepEqual(cacheSessionTimestamps(root), {
    patchedEntries: 1,
    patchedFiles: 1,
    skippedFiles: 0
  });
  const repaired = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(repaired[0].timestamp, 1_756_560_000_000);
  assert.equal(repaired[1].timestamp, 123);
  assert.equal(repaired[2].timestamp, null);
  assert.equal('timestamp' in repaired[3], false);
});

test('converts manifest seconds and accepts a cache without usable metadata', (t) => {
  assert.equal(positiveTimestamp(1_756_560_000), 1_756_560_000_000);
  assert.equal(positiveTimestamp(1_756_560_000_000), 1_756_560_000_000);
  assert.equal(positiveTimestamp('2026-08-30T12:00:00.000Z'), Date.parse('2026-08-30T12:00:00.000Z'));
  assert.equal(positiveTimestamp(0), 0);
  assert.equal(positiveTimestamp('invalid'), 0);

  const root = makeCache();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ sessions: [] }));
  assert.deepEqual(cacheSessionTimestamps(root), {
    patchedEntries: 0,
    patchedFiles: 0,
    skippedFiles: 0
  });
});

test('collector repairs the cache after a successful Antigravity source sync', async (t) => {
  const home = fs.mkdtempSync(path.join(__dirname, '.token-monitor-antigravity-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity'), { recursive: true });
  const cache = path.join(home, '.config', 'tokscale', 'antigravity-cache');
  fs.mkdirSync(path.join(cache, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({
    sessions: [{ sessionId: 'collector-session', lastModifiedMs: 1_756_560_000_000 }]
  }));
  const sessionFile = path.join(cache, 'sessions', 'collector-session.jsonl');
  fs.writeFileSync(sessionFile, `${JSON.stringify({
    type: 'usage', sessionId: 'collector-session', timestamp: null, input: 42
  })}\n`);

  const { collectUsageOnce } = require('../../src/shared/collector');
  await collectUsageOnce({
    clients: 'antigravity',
    allTimeSince: '2024-01-01',
    homeDir: home,
    deviceId: 'test-device',
    agentVersion: 'test',
    historyEnabled: false,
    limitsEnabled: false,
    wslScanEnabled: false,
    runAntigravitySync: async () => {},
    runTokscale: async () => ({ entries: [] })
  });

  const repaired = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  assert.equal(repaired.timestamp, 1_756_560_000_000);
});
