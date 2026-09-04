'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  WIDGET_DEMAND_MARKER,
  createMacWidgetPublisher,
  resolveMacWidgetConfiguration,
  resolveSnapshotPath
} = require('../../src/electron/macWidgetPublisher');

function tempWidget() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'token-monitor-widget-publisher-'));
  const directory = path.join(root, 'Library', 'Group Containers', 'group.com.example.tokenmonitor');
  fs.mkdirSync(directory, { recursive: true });
  return {
    directory,
    root,
    snapshotPath: path.join(directory, 'snapshot.json')
  };
}

function stats(tokens) {
  return {
    updatedAt: '2026-08-28T08:00:00.000Z',
    periods: {
      today: { totalTokens: tokens, costUsd: 1, clients: { codex: tokens }, models: { 'gpt-5': tokens } },
      month: { totalTokens: tokens, costUsd: 1 },
      allTime: { totalTokens: tokens, costUsd: 1 }
    },
    limits: { providers: [] }
  };
}

test('Widget configuration resolves only a valid macOS App Group destination', () => {
  assert.equal(resolveSnapshotPath({ platform: 'linux', appGroup: 'group.com.example.app', home: '/tmp' }), null);
  assert.equal(resolveSnapshotPath({ platform: 'darwin', appGroup: '__proto__', home: '/tmp' }), null);
  assert.equal(resolveMacWidgetConfiguration({
    platform: 'darwin',
    runtimeSupported: true,
    appGroup: 'group.com.example.tokenmonitor',
    home: '/Users/test',
    urlScheme: 'Token-Monitor'
  })?.urlScheme, 'token-monitor');
});

test('publisher does no history or filesystem work without an active Widget demand lease', async () => {
  const fixture = tempWidget();
  let historyCalls = 0;
  const publisher = createMacWidgetPublisher({
    platform: 'darwin',
    snapshotPath: fixture.snapshotPath,
    getHistory: async () => { historyCalls += 1; return {}; }
  });

  assert.equal(publisher.publish(stats(10)), false);
  await publisher.whenIdle();
  assert.equal(historyCalls, 0);
  assert.equal(fs.existsSync(fixture.snapshotPath), false);
});

test('publisher writes a private atomic snapshot and reloads WidgetKit for fresh demand', async () => {
  const fixture = tempWidget();
  fs.writeFileSync(path.join(fixture.directory, WIDGET_DEMAND_MARKER), '');
  const helper = path.join(fixture.root, 'TokenMonitorWidgetReloader');
  fs.writeFileSync(helper, 'helper');
  const launches = [];
  const publisher = createMacWidgetPublisher({
    platform: 'darwin',
    snapshotPath: fixture.snapshotPath,
    widgetKind: 'com.example.widget',
    reloaderCandidates: [helper],
    reloadIntervalMs: 0,
    execFile: (file, args, callback) => { launches.push([file, args]); callback(null); },
    getHistory: async () => ({ daily: [], monthly: [], summary: {} }),
    getPresentation: () => ({ currencyCode: 'USD', currencyRate: 1 })
  });

  assert.equal(publisher.publish(stats(123)), true);
  await publisher.whenIdle();
  const snapshot = JSON.parse(fs.readFileSync(fixture.snapshotPath, 'utf8'));
  assert.equal(snapshot.periods.day.overview.totalTokens, 123);
  assert.equal(fs.statSync(fixture.snapshotPath).mode & 0o777, 0o600);
  assert.deepEqual(launches, [[helper, ['com.example.widget']]]);
  assert.deepEqual(fs.readdirSync(fixture.directory).filter((name) => name.endsWith('.tmp')), []);
});

test('publisher serializes a latest-wins lane across a slow history refresh', async () => {
  const fixture = tempWidget();
  fs.writeFileSync(path.join(fixture.directory, WIDGET_DEMAND_MARKER), '');
  let releaseFirst;
  let historyCalls = 0;
  const publisher = createMacWidgetPublisher({
    platform: 'darwin',
    snapshotPath: fixture.snapshotPath,
    getHistory: async () => {
      historyCalls += 1;
      if (historyCalls === 1) await new Promise((resolve) => { releaseFirst = resolve; });
      return { daily: [], monthly: [], summary: {} };
    }
  });

  publisher.publish(stats(1));
  await new Promise((resolve) => setImmediate(resolve));
  publisher.publish(stats(2));
  releaseFirst();
  await publisher.whenIdle();

  const snapshot = JSON.parse(fs.readFileSync(fixture.snapshotPath, 'utf8'));
  assert.equal(snapshot.periods.day.overview.totalTokens, 2);
  assert.equal(historyCalls, 2);
});

test('Electron main owns the Widget publisher lifecycle and deep-link handoff', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8');
  assert.match(source, /createMacWidgetPublisher/);
  assert.match(source, /scheduleMacWidgetSnapshot\(latestStats\)/);
  assert.match(source, /macWidgetPublisher\?\.stop\(\)/);
  assert.match(source, /app\.on\('open-url'/);
  assert.match(source, /setImmediate\(openMainWindowFromWidget\)/);
});
