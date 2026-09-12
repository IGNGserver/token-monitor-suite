'use strict';

const { clientsCsvForSetting } = require('../shared/clientTracking');

const MODE_STRUCTURAL_KEYS = Object.freeze([
  'hubMode',
  'hubUrl',
  'allowInsecureHubHttp',
  'secret',
  'hubHostPort',
  'hubHostSecret',
  'deviceId'
]);
const USAGE_STRUCTURAL_KEYS = Object.freeze([
  'clients',
  'allTimeSince',
  'collectionIntervalMs',
  'collectionMode',
  'historyEnabled',
  'historyIntervalMs',
  'sessionUsageArchiveEnabled',
  'projectsEnabled',
  'wslScanEnabled'
]);
const SINK_STRUCTURAL_KEYS = Object.freeze(['syncUploadIntervalMs']);

function equalSetting(left, right) {
  if (left === right) return true;
  if ((left === undefined || left === null) && (right === undefined || right === null)) return true;
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_) { return false; }
}

function changedAny(previous, next, keys) {
  return keys.some((key) => !equalSetting(previous?.[key], next?.[key]));
}

function usageConfigFromSettings(settings = {}, context = {}) {
  return {
    clients: clientsCsvForSetting(settings.clients),
    allTimeSince: settings.allTimeSince || '2024-01-01',
    commandTimeoutMs: Number(context.commandTimeoutMs || 120 * 1000),
    deviceId: settings.deviceId || context.defaultDeviceId,
    agentVersion: context.agentVersion,
    agentRuntime: context.agentRuntime || 'electron-widget',
    intervalMs: context.intervalMs ?? settings.collectionIntervalMs,
    historyEnabled: settings.historyEnabled !== false,
    dailyHistoryArchiveEnabled: settings.sessionUsageArchiveEnabled !== false,
    dailyHistoryArchiveWriteEnabled: context.dailyHistoryArchiveWriteEnabled,
    projectsEnabled: settings.projectsEnabled !== false,
    historyIntervalMs: context.historyIntervalMs ?? settings.historyIntervalMs,
    watchEnabled: context.watchEnabled,
    watchDebounceMs: Number(context.watchDebounceMs || 1500),
    wslScanEnabled: settings.wslScanEnabled !== false,
    onError: context.onError,
    logger: context.logger
  };
}

function envelopeFromSettings(settings = {}, context = {}) {
  return {
    deviceId: settings.deviceId || context.defaultDeviceId,
    agentVersion: context.agentVersion,
    agentRuntime: context.agentRuntime || 'electron-widget'
  };
}

function classifySettingsChange(previous = {}, next = {}) {
  return {
    modeStructural: changedAny(previous, next, MODE_STRUCTURAL_KEYS),
    usageStructural: changedAny(previous, next, USAGE_STRUCTURAL_KEYS),
    sinkStructural: changedAny(previous, next, SINK_STRUCTURAL_KEYS),
    limitsReconfigure: false,
    limitScopes: []
  };
}

module.exports = {
  classifySettingsChange,
  envelopeFromSettings,
  usageConfigFromSettings
};
