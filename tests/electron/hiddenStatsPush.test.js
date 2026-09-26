'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unbalanced ${name}`);
}

function harness() {
  const sent = [];
  const windowState = { visible: false, minimized: false };
  const mainWindow = {
    isDestroyed: () => false,
    isVisible: () => windowState.visible,
    isMinimized: () => windowState.minimized,
    webContents: { send: (channel, payload) => sent.push({ channel, payload }) }
  };
  const context = vm.createContext({
    mainWindow,
    settings: { exportAutoEnabled: false },
    latestStats: null,
    pendingPush: null,
    pendingStatsPush: null,
    pendingPushTimer: null,
    pendingPushHistoryRevision: null,
    statsPushDeferred: false,
    PUSH_COALESCE_MS: 200,
    statsHistoryRevision: () => '',
    injectLocalDeviceStatus: () => {},
    desktopSnapshotMeta: () => ({ source: 'test' }),
    syncHealthSnapshot: () => ({ state: 'live' }),
    clearTimeout,
    setTimeout: () => 1,
    Date
  });
  vm.runInContext([
    functionSource('sendPush'),
    functionSource('flushPush'),
    functionSource('flushPendingPush'),
    functionSource('replayDeferredStatsPush')
  ].join('\n'), context);
  return { context, sent, windowState };
}

test('hidden snapshots stay in main and the latest one is replayed on reveal', () => {
  const { context, sent, windowState } = harness();
  for (let revision = 1; revision <= 100; revision += 1) {
    context.pendingPush = { event: 'stats', data: { stats: { revision } } };
    vm.runInContext('flushPush()', context);
  }
  assert.equal(sent.length, 0);
  assert.equal(context.latestStats.revision, 100);
  assert.equal(context.statsPushDeferred, true);

  windowState.visible = true;
  vm.runInContext('replayDeferredStatsPush()', context);
  assert.deepEqual(sent.map(({ payload }) => payload.event), ['stats', 'sync-health']);
  assert.equal(sent[0].payload.data.stats.revision, 100);
  assert.equal(context.statsPushDeferred, false);
  vm.runInContext('replayDeferredStatsPush()', context);
  assert.equal(sent.length, 2, 'revealing twice must not replay an old snapshot');
});

test('a health event in the same coalescing window cannot replace stats', () => {
  const { context, sent, windowState } = harness();
  windowState.visible = true;
  vm.runInContext(`
    sendPush({ event: 'stats', data: { stats: { revision: 9 } } });
    sendPush({ event: 'sync-health', data: { health: { state: 'live' } } });
    flushPush();
  `, context);
  assert.equal(context.latestStats.revision, 9);
  assert.deepEqual(sent.map(({ payload }) => payload.event), ['stats', 'sync-health']);
});

test('a queued fresh snapshot wins when the window reappears', () => {
  const { context, sent, windowState } = harness();
  context.pendingPush = { event: 'stats', data: { stats: { revision: 1 } } };
  vm.runInContext('flushPush()', context);
  windowState.visible = true;
  context.pendingPush = { event: 'stats', data: { stats: { revision: 2 } } };
  vm.runInContext('replayDeferredStatsPush()', context);
  assert.deepEqual(sent.map(({ payload }) => payload.event), ['stats', 'sync-health']);
  assert.equal(sent[0].payload.data.stats.revision, 2);
});

test('minimized windows defer snapshots and both reveal events are wired', () => {
  const { context, sent, windowState } = harness();
  windowState.visible = true;
  windowState.minimized = true;
  context.pendingPush = { event: 'stats', data: { stats: { revision: 3 } } };
  vm.runInContext('flushPush()', context);
  assert.equal(sent.length, 0);
  windowState.minimized = false;
  vm.runInContext('replayDeferredStatsPush()', context);
  assert.equal(sent[0].payload.data.stats.revision, 3);
  assert.match(source, /win\.on\('show', replayDeferredStatsPush\)/);
  assert.match(source, /win\.on\('restore', replayDeferredStatsPush\)/);
});
