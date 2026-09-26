'use strict';

const {
  applySessionUsageArchive,
  captureSessionUsageArchive,
  normalizeSessionUsageArchive,
  readSessionUsageArchive,
  sessionUsageArchiveDate,
  writeSessionUsageArchive
} = require('./sessionUsageArchive');
const { applyProjectRollups } = require('./usage');

function resolveOption(value, ...args) {
  return typeof value === 'function' ? value(...args) : value;
}

function applySyncSummaryTransform(summary, options = {}) {
  if (!summary || typeof summary !== 'object') return summary;
  const now = options.now || sessionUsageArchiveDate(summary);
  let visibleSummary = summary;

  if (options.sessionUsageArchiveEnabled !== false) {
    visibleSummary = applySessionUsageArchive(
      visibleSummary,
      options.sessionUsageArchive || {},
      { now }
    );
  }
  if (options.projectsEnabled !== false) applyProjectRollups(visibleSummary);
  return visibleSummary;
}

/**
 * Create the same historical-summary transform for Electron and headless.
 * Persistence and UI ownership are callbacks; the order and data semantics are
 * deliberately shared so an entry point cannot accidentally omit an archive.
 */
function createSyncSummaryTransformer(options = {}) {
  let sessionArchive = options.initialSessionUsageArchive === undefined
    ? null
    : normalizeSessionUsageArchive(options.initialSessionUsageArchive);
  let sessionArchiveLoaded = sessionArchive !== null;

  function loadSessionArchive() {
    if (sessionArchiveLoaded) return sessionArchive;
    sessionArchiveLoaded = true;
    try {
      const loaded = typeof options.readSessionUsageArchive === 'function'
        ? options.readSessionUsageArchive()
        : readSessionUsageArchive(options.archivePath ? { path: options.archivePath } : {});
      sessionArchive = normalizeSessionUsageArchive(loaded);
    } catch (error) {
      sessionArchive = normalizeSessionUsageArchive({});
      try { options.onArchiveError?.(error, 'read'); } catch (_) {}
    }
    return sessionArchive;
  }

  function transform(summary, reason = 'usage', meta = {}) {
    if (!summary || typeof summary !== 'object') return summary;
    const now = sessionUsageArchiveDate(summary);
    let nextArchive = loadSessionArchive();
    const archiveEnabled = resolveOption(options.sessionUsageArchiveEnabled, summary, reason, meta) !== false;
    if (archiveEnabled) {
      nextArchive = captureSessionUsageArchive(nextArchive, summary, now);
      const changed = JSON.stringify(nextArchive) !== JSON.stringify(sessionArchive);
      sessionArchive = nextArchive;
      const writeAllowed = resolveOption(options.canWriteSessionUsageArchive, summary, reason, meta) !== false;
      if (changed && writeAllowed && meta.preview !== true) {
        try {
          if (typeof options.writeSessionUsageArchive === 'function') {
            options.writeSessionUsageArchive(nextArchive);
          } else {
            writeSessionUsageArchive(nextArchive, options.archivePath ? { path: options.archivePath } : {});
          }
        } catch (error) {
          try { options.onArchiveError?.(error, 'write'); } catch (_) {}
        }
      }
    }

    return applySyncSummaryTransform(summary, {
      sessionUsageArchiveEnabled: archiveEnabled,
      sessionUsageArchive: nextArchive,
      projectsEnabled: resolveOption(options.projectsEnabled, summary, reason, meta),
      now
    });
  }

  return {
    getSessionUsageArchive: () => sessionArchive,
    resetSessionUsageArchive(value = {}) {
      sessionArchive = normalizeSessionUsageArchive(value);
      sessionArchiveLoaded = true;
    },
    reloadSessionUsageArchive() {
      sessionArchive = null;
      sessionArchiveLoaded = false;
    },
    transform
  };
}

module.exports = {
  applySyncSummaryTransform,
  createSyncSummaryTransformer
};