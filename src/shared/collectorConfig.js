'use strict';

const { parseBoolean } = require('./config');
const { clientsCsvForSetting } = require('./clientTracking');
const { normalizeHistoryIntervalMs } = require('./collector');
const { normalizeSyncUploadIntervalMs } = require('./syncUploadScheduler');

const COLLECTION_MODES = Object.freeze(['live', 'interval', 'smart']);
const COLLECTION_INTERVAL_OPTIONS = Object.freeze([
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000
]);
const DEFAULT_COLLECTION_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_SMART_COLLECTION_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_WATCH_DEBOUNCE_MS = 1500;
const DEFAULT_COMMAND_TIMEOUT_MS = 120 * 1000;
const DEFAULT_SYNC_UPLOAD_TIMEOUT_MS = 15 * 1000;
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

function normalizeCollectionMode(value, fallback = 'live') {
  const next = String(value || '').trim().toLowerCase();
  if (COLLECTION_MODES.includes(next)) return next;
  const fallbackValue = String(fallback || '').trim().toLowerCase();
  return COLLECTION_MODES.includes(fallbackValue) ? fallbackValue : 'live';
}

function normalizeCollectionIntervalMs(value, fallback = DEFAULT_COLLECTION_INTERVAL_MS) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_TIMER_DELAY_MS) return parsed;
  const fallbackParsed = Number(fallback);
  if (Number.isFinite(fallbackParsed) && fallbackParsed > 0 && fallbackParsed <= MAX_TIMER_DELAY_MS) return fallbackParsed;
  return DEFAULT_COLLECTION_INTERVAL_MS;
}

function normalizeWatchDebounceMs(value, fallback = DEFAULT_WATCH_DEBOUNCE_MS) {
  return normalizeCollectionIntervalMs(value, fallback);
}

function usageConfigFromSource(source = {}, context = {}) {
  const mode = normalizeCollectionMode(
    source.collectionMode ?? context.collectionMode,
    context.collectionMode || 'live'
  );
  const configuredInterval = context.intervalMs ?? source.collectionIntervalMs;
  const intervalMs = mode === 'smart'
    ? normalizeCollectionIntervalMs(
      context.smartIntervalMs ?? source.smartIntervalMs ?? configuredInterval,
      DEFAULT_SMART_COLLECTION_INTERVAL_MS
    )
    : normalizeCollectionIntervalMs(configuredInterval, DEFAULT_COLLECTION_INTERVAL_MS);
  const configuredWatch = context.watchEnabled ?? source.watchEnabled;
  const watchEnabled = mode === 'interval'
    ? false
    : configuredWatch === undefined
      ? true
      : parseBoolean(configuredWatch, true);
  const watchTriggersCollection = context.watchTriggersCollection ?? mode === 'live';
  const intervalRequiresActivity = context.intervalRequiresActivity ?? mode === 'smart';

  return {
    clients: clientsCsvForSetting(source.clients),
    allTimeSince: source.allTimeSince || '2024-01-01',
    commandTimeoutMs: Number(context.commandTimeoutMs ?? source.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS),
    deviceId: source.deviceId || context.defaultDeviceId,
    agentVersion: context.agentVersion,
    agentRuntime: context.agentRuntime || 'electron-widget',
    projectsEnabled: parseBoolean(source.projectsEnabled, false),
    reasonixNativeSessionsEnabled: context.reasonixNativeSessionsEnabled ?? source.reasonixNativeSessionsEnabled ?? true,
    historyEnabled: parseBoolean(source.historyEnabled, true),
    historyIntervalMs: context.historyIntervalMs ?? normalizeHistoryIntervalMs(source.historyIntervalMs),
    dailyHistoryArchiveEnabled: parseBoolean(source.sessionUsageArchiveEnabled, true),
    dailyHistoryArchiveWriteEnabled: context.dailyHistoryArchiveWriteEnabled,
    anchorPersistenceEnabled: context.anchorPersistenceEnabled ?? source.anchorPersistenceEnabled,
    intervalMs,
    watchEnabled,
    watchTriggersCollection,
    intervalRequiresActivity,
    watchDebounceMs: normalizeWatchDebounceMs(context.watchDebounceMs ?? source.watchDebounceMs),
    wslScanEnabled: parseBoolean(source.wslScanEnabled, true),
    syncUploadIntervalMs: normalizeSyncUploadIntervalMs(
      context.syncUploadIntervalMs ?? source.syncUploadIntervalMs
    ),
    uploadTimeoutMs: Number(context.uploadTimeoutMs ?? source.uploadTimeoutMs ?? DEFAULT_SYNC_UPLOAD_TIMEOUT_MS),
    onError: context.onError,
    onDiagnosticEvent: context.onDiagnosticEvent,
    logger: context.logger
  };
}

module.exports = {
  COLLECTION_INTERVAL_OPTIONS,
  COLLECTION_MODES,
  DEFAULT_COLLECTION_INTERVAL_MS,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_SMART_COLLECTION_INTERVAL_MS,
  DEFAULT_SYNC_UPLOAD_TIMEOUT_MS,
  DEFAULT_WATCH_DEBOUNCE_MS,
  normalizeCollectionIntervalMs,
  normalizeCollectionMode,
  normalizeWatchDebounceMs,
  usageConfigFromSource
};
