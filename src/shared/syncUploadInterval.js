'use strict';

const SYNC_UPLOAD_INTERVAL_OPTIONS = Object.freeze([
  0,
  10 * 60 * 1000,
  20 * 60 * 1000,
  30 * 60 * 1000
]);
const DEFAULT_STALE_AFTER_MS = 10 * 60 * 1000;
const DEFAULT_SYNC_UPLOAD_INTERVAL_MS = 0;
// Matches the producer-side ceiling in syncUploadScheduler.js.
const MAX_SYNC_UPLOAD_INTERVAL_MS = 24 * 60 * 60 * 1000;

function normalizeSyncUploadIntervalMs(value, fallback = DEFAULT_SYNC_UPLOAD_INTERVAL_MS) {
  // Accept anything the producer accepts (syncUploadScheduler.js: any finite
  // value from 0 through 24h). This used to be a four-value whitelist, so a device
  // configured for e.g. 15 minutes stamped 900000 on the wire and the Hub
  // normalized it back to 0 — losing the interval and then judging the device
  // stale after the 10-minute base while it was uploading exactly as configured.
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_SYNC_UPLOAD_INTERVAL_MS) return parsed;
  const fallbackParsed = Number(fallback);
  if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0 && fallbackParsed <= MAX_SYNC_UPLOAD_INTERVAL_MS) {
    return fallbackParsed;
  }
  return DEFAULT_SYNC_UPLOAD_INTERVAL_MS;
}

function staleAfterMsForSyncUpload(value, staleAfterMs = 0) {
  const numericStaleAfterMs = Number(staleAfterMs);
  const baseStaleAfterMs = Number.isFinite(numericStaleAfterMs) && numericStaleAfterMs > 0
    ? numericStaleAfterMs
    : 0;
  if (baseStaleAfterMs <= 0) return 0;
  const intervalMs = normalizeSyncUploadIntervalMs(value);
  return intervalMs > 0 ? Math.max(baseStaleAfterMs, intervalMs * 2) : baseStaleAfterMs;
}

module.exports = {
  DEFAULT_STALE_AFTER_MS,
  DEFAULT_SYNC_UPLOAD_INTERVAL_MS,
  SYNC_UPLOAD_INTERVAL_OPTIONS,
  normalizeSyncUploadIntervalMs,
  staleAfterMsForSyncUpload
};
