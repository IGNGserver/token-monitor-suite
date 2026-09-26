'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { usageConfigFromSource } = require('../../src/shared/collectorConfig');
const { usageConfigFromSettings } = require('../../src/electron/runtimeConfig');
const { TRACKED_CLIENTS } = require('../../src/shared/clientTracking');
const {
  applySyncSummaryTransform,
  createSyncSummaryTransformer
} = require('../../src/shared/syncSummary');
const { serializeSyncPayload } = require('../../src/shared/syncPayload');

function comparableUsageConfig(value) {
  const copy = { ...value };
  for (const key of ['onError', 'onDiagnosticEvent', 'logger']) delete copy[key];
  return copy;
}

test('Electron and headless usage configuration is built by one shared contract', () => {
  const source = {
    deviceId: 'device-1',
    // A stale/source-provided client subset must be ignored: the tracked set is
    // fixed for both runtimes.
    clients: 'claude,codex',
    allTimeSince: '2025-01-01',
    collectionMode: 'smart',
    collectionIntervalMs: 600000,
    watchEnabled: true,
    watchDebounceMs: 2200,
    historyEnabled: true,
    historyIntervalMs: 900000,
    projectsEnabled: true,
    sessionUsageArchiveEnabled: true,
    wslScanEnabled: false,
    syncUploadIntervalMs: 1200000
  };
  const context = {
    agentVersion: '1.2.3',
    agentRuntime: 'shared-test',
    intervalMs: 600000,
    watchEnabled: true,
    watchDebounceMs: 2200,
    historyIntervalMs: 900000,
    reasonixNativeSessionsEnabled: true,
    anchorPersistenceEnabled: true
  };

  assert.deepEqual(
    comparableUsageConfig(usageConfigFromSource(source, context)),
    comparableUsageConfig(usageConfigFromSettings(source, context))
  );
  assert.equal(usageConfigFromSource(source, context).clients, TRACKED_CLIENTS);
  assert.equal(usageConfigFromSettings(source, context).clients, TRACKED_CLIENTS);
});

test('smart mode uses the configured shared collection interval in both runtimes', () => {
  const source = { collectionMode: 'smart', collectionIntervalMs: 750000 };
  assert.equal(usageConfigFromSource(source).intervalMs, 750000);
  assert.equal(usageConfigFromSettings(source).intervalMs, 750000);
  assert.equal(usageConfigFromSource({ collectionMode: 'smart' }).intervalMs, 600000);
});

test('both modes serialize the same transformed detection snapshot', () => {
  const summary = {
    deviceId: 'device-1',
    updatedAt: '2026-09-13T00:00:00.000Z',
    trackedClients: 'codex',
    projectsEnabled: true,
    today: {
      totalTokens: 4,
      clients: { codex: 4 },
      clientCosts: {},
      models: { 'gpt-5': 4 },
      modelCosts: {},
      sessions: {}
    },
    month: {
      totalTokens: 4,
      clients: { codex: 4 },
      clientCosts: {},
      models: { 'gpt-5': 4 },
      modelCosts: {},
      sessions: {}
    },
    allTime: {
      totalTokens: 4,
      clients: { codex: 4 },
      clientCosts: {},
      models: { 'gpt-5': 4 },
      modelCosts: {},
      sessions: {}
    }
  };
  const options = {
    sessionUsageArchive: { version: 1, days: {} },
    sessionUsageArchiveEnabled: true,
    projectsEnabled: true,
    now: new Date('2026-09-13T00:00:00.000Z')
  };

  const electronTransform = createSyncSummaryTransformer({
    initialSessionUsageArchive: options.sessionUsageArchive,
    sessionUsageArchiveEnabled: options.sessionUsageArchiveEnabled,
    projectsEnabled: options.projectsEnabled
  });
  const headlessTransform = createSyncSummaryTransformer({
    initialSessionUsageArchive: options.sessionUsageArchive,
    sessionUsageArchiveEnabled: options.sessionUsageArchiveEnabled,
    projectsEnabled: options.projectsEnabled
  });
  const electronPayload = serializeSyncPayload(
    electronTransform.transform(summary, 'usage', { preview: false })
  ).payload;
  const headlessPayload = serializeSyncPayload(
    headlessTransform.transform(summary, 'usage', { preview: false })
  ).payload;

  assert.deepEqual(electronPayload, headlessPayload);
  assert.deepEqual(
    applySyncSummaryTransform(summary, options),
    electronTransform.transform(summary, 'usage', { preview: true })
  );
});

test('both entry points are wired to shared config and upload primitives', () => {
  const root = path.resolve(__dirname, '../..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert.match(read('src/electron/runtimeConfig.js'), /usageConfigFromSource/);
  assert.match(read('src/agent/agent.js'), /usageConfigFromSource/);
  assert.match(read('src/electron/main.js'), /createSyncUploadSink/);
  assert.match(read('src/agent/runtime.js'), /createSyncUploadSink/);
});
