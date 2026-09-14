'use strict';

const {
  applyArchivedClientUsage,
  captureArchivedClientUsage,
  normalizeArchivedClientUsage
} = require('./clientUsageArchive');
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

  if (options.archivedClientUsage !== undefined) {
    visibleSummary = applyArchivedClientUsage(visibleSummary, options.archivedClientUsage, {
      activeClients: options.activeClients,
      now
    });
  }
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
  let clientArchive = options.initialClientUsageArchive === undefined
    ? null
    : normalizeArchivedClientUsage(options.initialClientUsageArchive);
  let clientArchiveLoaded = clientArchive !== null;
  let sessionArchive = options.initialSessionUsageArchive === undefined
    ? null
    : normalizeSessionUsageArchive(options.initialSessionUsageArchive);
  let sessionArchiveLoaded = sessionArchive !== null;

  function loadClientArchive() {
    if (clientArchiveLoaded) return clientArchive;
    clientArchiveLoaded = true;
    try {
      const loaded = typeof options.readClientUsageArchive === 'function'
        ? options.readClientUsageArchive()
        : resolveOption(options.archivedClientUsage);
      clientArchive = normalizeArchivedClientUsage(loaded);
    } catch (error) {
      clientArchive = normalizeArchivedClientUsage({});
      try { options.onArchiveError?.(error, 'client-read'); } catch (_) {}
    }
    return clientArchive;
  }

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
    let nextClientArchive = loadClientArchive();
    const activeClients = resolveOption(options.activeClients, summary, reason, meta);
    if (options.captureClientUsage === true && meta.preview !== true) {
      const captured = captureArchivedClientUsage(nextClientArchive, summary, activeClients, now);
      const changed = JSON.stringify(captured) !== JSON.stringify(nextClientArchive);
      nextClientArchive = captured;
      clientArchive = captured;
      const writeAllowed = resolveOption(options.canWriteClientUsageArchive, summary, reason, meta) !== false;
      if (changed && writeAllowed) {
        try {
          if (typeof options.writeClientUsageArchive === 'function') options.writeClientUsageArchive(captured);
        } catch (error) {
          try { options.onArchiveError?.(error, 'client-write'); } catch (_) {}
        }
      }
    }
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
      archivedClientUsage: nextClientArchive,
      activeClients,
      sessionUsageArchiveEnabled: archiveEnabled,
      sessionUsageArchive: nextArchive,
      projectsEnabled: resolveOption(options.projectsEnabled, summary, reason, meta),
      now
    });
  }

  return {
    getClientUsageArchive: () => clientArchive,
    getSessionUsageArchive: () => sessionArchive,
    reloadClientUsageArchive() {
      clientArchive = null;
      clientArchiveLoaded = false;
    },
    setClientUsageArchive(value = {}) {
      clientArchive = normalizeArchivedClientUsage(value);
      clientArchiveLoaded = true;
    },
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
