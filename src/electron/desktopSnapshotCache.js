'use strict';

// The desktop renderer must remain useful when the Hub is down. This file is
// deliberately a small, versioned snapshot store rather than a second data
// source: the collector and Hub responses remain authoritative whenever they
// are available, while this store only supplies the last known read model.

const fs = require('node:fs');
const { writePrivateJsonAtomic } = require('../shared/credentialStore');

const DESKTOP_SNAPSHOT_CACHE_VERSION = 1;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function cacheable(value) {
  return isRecord(value) ? cloneJson(value) : null;
}

function normalizeEntry(value) {
  if (!isRecord(value) || !isRecord(value.stats)) return null;
  return {
    capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : null,
    stats: cacheable(value.stats),
    device: cacheable(value.device),
    history: cacheable(value.history)
  };
}

function normalizeDesktopSnapshotCache(value) {
  if (!isRecord(value) || value.version !== DESKTOP_SNAPSHOT_CACHE_VERSION) return null;
  return {
    version: DESKTOP_SNAPSHOT_CACHE_VERSION,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    local: normalizeEntry(value.local),
    hub: normalizeEntry(value.hub)
  };
}

function emptyDesktopSnapshotCache() {
  return {
    version: DESKTOP_SNAPSHOT_CACHE_VERSION,
    updatedAt: null,
    local: null,
    hub: null
  };
}

function readDesktopSnapshotCache(filePath, fsApi = fs) {
  try {
    const parsed = JSON.parse(fsApi.readFileSync(filePath, 'utf8'));
    return normalizeDesktopSnapshotCache(parsed);
  } catch (_) {
    // A corrupt or partial cache is non-authoritative. The collector will
    // rebuild it after the next successful tick; startup must still continue.
    return null;
  }
}

function writeDesktopSnapshotCache(filePath, value, fsApi = fs) {
  const normalized = normalizeDesktopSnapshotCache(value) || emptyDesktopSnapshotCache();
  normalized.updatedAt = new Date().toISOString();
  writePrivateJsonAtomic(filePath, normalized, { fs: fsApi });
  return normalized;
}

module.exports = {
  DESKTOP_SNAPSHOT_CACHE_VERSION,
  cacheable,
  emptyDesktopSnapshotCache,
  normalizeDesktopSnapshotCache,
  readDesktopSnapshotCache,
  writeDesktopSnapshotCache
};
