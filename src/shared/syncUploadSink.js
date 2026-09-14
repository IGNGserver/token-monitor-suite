'use strict';

const {
  createSyncUploadScheduler,
  normalizeSyncUploadIntervalMs
} = require('./syncUploadScheduler');

function withSyncUploadMetadata(summary, intervalMs) {
  if (!summary || typeof summary !== 'object') return summary;
  return {
    ...summary,
    syncUploadIntervalMs: normalizeSyncUploadIntervalMs(intervalMs)
  };
}

/**
 * Build the upload sink used by both the Electron client mode and the headless
 * agent. UI code may observe or reject a record in `beforeEnqueue`, but the
 * actual latest-wins, retry, timeout, and flush behaviour stays shared.
 */
function createSyncUploadSink(options = {}) {
  const intervalMs = normalizeSyncUploadIntervalMs(options.intervalMs);
  const scheduler = createSyncUploadScheduler({
    ...options,
    intervalMs,
    upload: typeof options.upload === 'function' ? options.upload : async () => {}
  });

  async function enqueue(summary, revision = null) {
    const visibleSummary = withSyncUploadMetadata(summary, intervalMs);
    if (typeof options.beforeEnqueue === 'function') {
      const allowed = await options.beforeEnqueue(visibleSummary, revision);
      if (allowed === false) {
        return { queued: false, skipped: true, reason: 'before_enqueue', revision };
      }
    }
    return scheduler.enqueue(visibleSummary, revision);
  }

  return {
    enqueue,
    flush: (flushOptions) => scheduler.flush(flushOptions),
    flushLatest: (flushOptions) => scheduler.flushLatest(flushOptions),
    retryNow: (retryOptions) => scheduler.retryNow(retryOptions),
    stop: () => scheduler.stop(),
    getDiagnostics: () => scheduler.getDiagnostics(),
    scheduler
  };
}

module.exports = {
  createSyncUploadSink,
  withSyncUploadMetadata
};
