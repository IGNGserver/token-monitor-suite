'use strict';

const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const {
  buildMacWidgetSnapshot,
  macWidgetSnapshotNeedsWrite
} = require('../shared/macWidgetSnapshot');
const {
  DEFAULT_WIDGET_URL_SCHEME,
  normalizeWidgetURLScheme,
  validateAppGroupSyntax
} = require('../shared/macWidgetConfig');

const DEFAULT_WIDGET_KIND = 'com.tokenmonitor.dashboard';
const WIDGET_DEMAND_MARKER = 'widget-demand';
const WIDGET_DEMAND_PROVISIONAL_MARKER = 'widget-demand-provisional';
const DEFAULT_DEMAND_LEASE_MS = 72 * 60 * 60 * 1000;
const DEFAULT_PROVISIONAL_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_RECONCILE_MS = 30 * 1000;
const DEFAULT_RELOAD_INTERVAL_MS = 30 * 1000;

function safeLog(logger, message) {
  try { logger?.(message); } catch (_) {}
}

function resolveSnapshotPath({ platform = process.platform, appGroup, home, snapshotFileName = 'snapshot.json' } = {}) {
  if (platform !== 'darwin') return null;
  const group = String(appGroup || '').trim();
  const root = String(home || '').trim();
  const fileName = String(snapshotFileName || '').trim();
  if (!root || !fileName || path.basename(fileName) !== fileName) return null;
  try { validateAppGroupSyntax(group); } catch (_) { return null; }
  return path.join(root, 'Library', 'Group Containers', group, fileName);
}

function resolveMacWidgetConfiguration(options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'darwin' || options.runtimeSupported === false) return null;
  const readFileSync = options.readFileSync || fsSync.readFileSync;
  let appGroup = String(options.appGroup || '').trim();
  let urlScheme = String(options.urlScheme || DEFAULT_WIDGET_URL_SCHEME).trim();
  let widgetKind = String(options.widgetKind || DEFAULT_WIDGET_KIND).trim();
  let snapshotFileName = 'snapshot.json';
  for (const candidate of options.configCandidates || []) {
    if (appGroup) break;
    try {
      const value = JSON.parse(readFileSync(candidate, 'utf8'));
      appGroup = String(value?.appGroup || '').trim();
      urlScheme = String(value?.urlScheme || urlScheme).trim();
      widgetKind = String(value?.widgetKind || widgetKind).trim();
      snapshotFileName = String(value?.snapshotFileName || snapshotFileName).trim();
    } catch (_) {}
  }
  const snapshotPath = resolveSnapshotPath({
    platform,
    appGroup,
    home: options.home,
    snapshotFileName
  });
  if (!snapshotPath) return null;
  try { urlScheme = normalizeWidgetURLScheme(urlScheme); } catch (_) { urlScheme = DEFAULT_WIDGET_URL_SCHEME; }
  return Object.freeze({
    appGroup,
    snapshotPath,
    urlScheme,
    widgetKind: widgetKind || DEFAULT_WIDGET_KIND
  });
}

function createMacWidgetPublisher(options = {}) {
  const platform = options.platform || process.platform;
  const snapshotPath = String(options.snapshotPath || '').trim();
  const directory = snapshotPath ? path.dirname(snapshotPath) : '';
  const fsApi = options.fs || fs;
  const fsSyncApi = options.fsSync || fsSync;
  const now = options.now || Date.now;
  const logger = options.logger;
  const getHistory = options.getHistory || (async () => ({ daily: [], monthly: [], summary: {} }));
  const getPresentation = options.getPresentation || (() => ({}));
  const setIntervalImpl = options.setInterval || setInterval;
  const clearIntervalImpl = options.clearInterval || clearInterval;
  const setTimeoutImpl = options.setTimeout || setTimeout;
  const clearTimeoutImpl = options.clearTimeout || clearTimeout;
  const demandLeaseMs = options.demandLeaseMs || DEFAULT_DEMAND_LEASE_MS;
  const provisionalLeaseMs = options.provisionalLeaseMs || DEFAULT_PROVISIONAL_LEASE_MS;
  const reconcileMs = options.reconcileMs || DEFAULT_RECONCILE_MS;
  const reloadIntervalMs = options.reloadIntervalMs ?? DEFAULT_RELOAD_INTERVAL_MS;

  let latestStats = null;
  let latestSequence = 0;
  let pending = null;
  let running = false;
  let stopped = false;
  let demand = false;
  let watcher = null;
  let reconcileTimer = null;
  let reloadTimer = null;
  let lastReloadAt = Number.NEGATIVE_INFINITY;
  let idleWaiters = [];

  const demandPaths = [
    { file: path.join(directory, WIDGET_DEMAND_MARKER), lease: demandLeaseMs },
    { file: path.join(directory, WIDGET_DEMAND_PROVISIONAL_MARKER), lease: provisionalLeaseMs }
  ];

  function settleIdle() {
    if (running || pending) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }

  function hasDemand() {
    if (!directory) return false;
    let confirmedMissing = true;
    for (const entry of demandPaths) {
      try {
        const stat = fsSyncApi.lstatSync(entry.file);
        confirmedMissing = false;
        if (stat.isFile() && now() - stat.mtimeMs < entry.lease) return true;
      } catch (error) {
        if (error?.code !== 'ENOENT') return true; // fail open on unreadable App Group state
      }
    }
    return !confirmedMissing && false;
  }

  function resolveReloaderPath() {
    for (const candidate of options.reloaderCandidates || []) {
      try { if (candidate && fsSyncApi.existsSync(candidate)) return candidate; } catch (_) {}
    }
    return null;
  }

  function launchReload() {
    if (stopped) return;
    const helper = resolveReloaderPath();
    if (!helper) {
      safeLog(logger, '[mac-widget] reload helper is unavailable');
      return;
    }
    lastReloadAt = now();
    try {
      (options.execFile || execFile)(helper, [String(options.widgetKind || DEFAULT_WIDGET_KIND)], (error) => {
        if (error) safeLog(logger, `[mac-widget] reload helper failed: ${error.message || error}`);
      });
    } catch (error) {
      safeLog(logger, `[mac-widget] reload helper failed: ${error.message || error}`);
    }
  }

  function requestReload() {
    const remaining = lastReloadAt + reloadIntervalMs - now();
    if (remaining <= 0) {
      if (reloadTimer) clearTimeoutImpl(reloadTimer);
      reloadTimer = null;
      launchReload();
      return;
    }
    if (reloadTimer) return;
    reloadTimer = setTimeoutImpl(() => {
      reloadTimer = null;
      launchReload();
    }, remaining);
    reloadTimer?.unref?.();
  }

  async function syncDirectory() {
    let handle;
    try {
      handle = await fsApi.open(directory, 'r');
      await handle.sync();
    } catch (_) {
      // Atomic rename and the file fsync are still valid on filesystems that do
      // not support opening a directory handle.
    } finally {
      try { await handle?.close(); } catch (_) {}
    }
  }

  async function readPreviousSnapshot() {
    try { return JSON.parse(await fsApi.readFile(snapshotPath, 'utf8')); } catch (_) { return null; }
  }

  async function processWork(work) {
    let history;
    try {
      history = await getHistory();
    } catch (error) {
      safeLog(logger, `[mac-widget] history refresh failed: ${error.message || error}`);
      history = work.stats?.history || { daily: [], monthly: [], summary: {} };
    }
    if (stopped || work.sequence !== latestSequence || !hasDemand()) return;
    const generatedAt = new Date(now());
    const snapshot = buildMacWidgetSnapshot(work.stats, {
      history,
      now: generatedAt,
      presentation: getPresentation()
    });
    const previous = await readPreviousSnapshot();
    if (previous && !macWidgetSnapshotNeedsWrite(snapshot, previous, { now: generatedAt })) return;
    await fsApi.mkdir(directory, { recursive: true });
    const tempPath = `${snapshotPath}.${process.pid}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await fsApi.open(tempPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(snapshot)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      if (stopped || work.sequence !== latestSequence || !hasDemand()) {
        await fsApi.unlink(tempPath).catch(() => {});
        return;
      }
      await fsApi.rename(tempPath, snapshotPath);
      await syncDirectory();
      requestReload();
    } catch (error) {
      try { await handle?.close(); } catch (_) {}
      await fsApi.unlink(tempPath).catch(() => {});
      safeLog(logger, `[mac-widget] snapshot write failed: ${error.message || error}`);
    }
  }

  async function drain() {
    try {
      while (pending && !stopped) {
        const work = pending;
        pending = null;
        await processWork(work);
      }
    } finally {
      running = false;
      if (pending && !stopped) startDrain();
      else settleIdle();
    }
  }

  function startDrain() {
    if (running || stopped || !pending) return;
    running = true;
    Promise.resolve().then(drain);
  }

  function publish(stats = latestStats) {
    if (platform !== 'darwin' || stopped || !snapshotPath || !stats) return false;
    latestStats = stats;
    if (!hasDemand()) return false;
    pending = Object.freeze({ stats, sequence: ++latestSequence });
    startDrain();
    return true;
  }

  function refreshDemand() {
    if (stopped) return;
    const next = hasDemand();
    const activated = next && !demand;
    demand = next;
    if (activated && latestStats) publish(latestStats);
  }

  function attachWatcher() {
    if (watcher || stopped || !directory) return;
    try {
      watcher = (options.watch || fsSyncApi.watch.bind(fsSyncApi))(directory, { persistent: false }, refreshDemand);
      watcher?.on?.('error', () => {
        try { watcher?.close?.(); } catch (_) {}
        watcher = null;
      });
    } catch (_) {}
  }

  function start() {
    if (platform !== 'darwin' || stopped || !snapshotPath || reconcileTimer) return false;
    demand = hasDemand();
    void fsApi.mkdir(directory, { recursive: true }).then(attachWatcher).catch((error) => {
      safeLog(logger, `[mac-widget] App Group directory unavailable: ${error.message || error}`);
    });
    reconcileTimer = setIntervalImpl(() => {
      attachWatcher();
      refreshDemand();
    }, reconcileMs);
    reconcileTimer?.unref?.();
    return true;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    latestSequence += 1;
    pending = null;
    try { watcher?.close?.(); } catch (_) {}
    watcher = null;
    if (reconcileTimer) clearIntervalImpl(reconcileTimer);
    reconcileTimer = null;
    if (reloadTimer) clearTimeoutImpl(reloadTimer);
    reloadTimer = null;
    settleIdle();
  }

  function whenIdle() {
    if (!running && !pending) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  return { hasDemand, publish, refreshDemand, start, stop, whenIdle };
}

module.exports = {
  DEFAULT_WIDGET_KIND,
  WIDGET_DEMAND_MARKER,
  WIDGET_DEMAND_PROVISIONAL_MARKER,
  createMacWidgetPublisher,
  resolveMacWidgetConfiguration,
  resolveSnapshotPath
};
