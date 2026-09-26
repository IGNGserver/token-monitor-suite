'use strict';

const { usageConfigFromSource } = require('../shared/collectorConfig');

const MODE_STRUCTURAL_KEYS = Object.freeze([
  'hubMode',
  'hubUrl',
  'allowInsecureHubHttp',
  'secret',
  'deviceId'
]);
const USAGE_STRUCTURAL_KEYS = Object.freeze([
  'allTimeSince',
  'collectionIntervalMs',
  'collectionMode',
  'watchEnabled',
  'watchDebounceMs',
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
  return usageConfigFromSource(settings, context);
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
