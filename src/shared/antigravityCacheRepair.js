'use strict';

const fs = require('node:fs');
const path = require('node:path');

function positiveTimestamp(value) {
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) ? numeric : Date.parse(String(value || ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed < 1_000_000_000_000 ? parsed * 1000 : parsed);
}

function cacheSessionTimestamps(cacheDir, fsModule = fs) {
  const manifestPath = path.join(cacheDir, 'manifest.json');
  const sessionsDir = path.join(cacheDir, 'sessions');
  if (!fsModule.existsSync(manifestPath) || !fsModule.existsSync(sessionsDir)) {
    return { patchedEntries: 0, patchedFiles: 0, skippedFiles: 0 };
  }

  let manifest;
  try {
    manifest = JSON.parse(fsModule.readFileSync(manifestPath, 'utf8'));
  } catch (_) {
    return { patchedEntries: 0, patchedFiles: 0, skippedFiles: 0 };
  }

  const timestamps = new Map();
  for (const session of (Array.isArray(manifest?.sessions) ? manifest.sessions : [])) {
    const sessionId = String(session?.sessionId || '').trim();
    const timestamp = positiveTimestamp(session?.lastModifiedMs ?? session?.lastModifiedAt);
    if (sessionId && timestamp > 0) timestamps.set(sessionId, timestamp);
  }
  if (timestamps.size === 0) return { patchedEntries: 0, patchedFiles: 0, skippedFiles: 0 };

  let entries;
  try {
    entries = fsModule.readdirSync(sessionsDir, { withFileTypes: true });
  } catch (_) {
    return { patchedEntries: 0, patchedFiles: 0, skippedFiles: 0 };
  }

  let patchedEntries = 0;
  let patchedFiles = 0;
  let skippedFiles = 0;
  for (const entry of entries) {
    if (!entry || !entry.isFile?.() || !entry.name.endsWith('.jsonl')) continue;
    const filePath = path.join(sessionsDir, entry.name);
    let raw;
    try {
      raw = fsModule.readFileSync(filePath, 'utf8');
    } catch (_) {
      skippedFiles += 1;
      continue;
    }

    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    let filePatchedEntries = 0;
    let changed = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (row?.type !== 'usage' || row.timestamp != null) continue;
      const timestamp = timestamps.get(String(row.sessionId || '').trim());
      if (!timestamp) continue;
      row.timestamp = timestamp;
      lines[index] = JSON.stringify(row);
      filePatchedEntries += 1;
      changed = true;
    }
    if (!changed) continue;

    // Sync has already exited before this function runs. A direct overwrite is
    // deliberate: it keeps the cache path stable for Tokscale on Windows, where
    // rename-over-existing is not portable. A repair failure is isolated to this
    // file and never turns a successful upstream sync into a destructive reset.
    try {
      fsModule.writeFileSync(filePath, lines.join(newline), 'utf8');
      patchedEntries += filePatchedEntries;
      patchedFiles += 1;
    } catch (_) {
      skippedFiles += 1;
    }
  }

  return { patchedEntries, patchedFiles, skippedFiles };
}

module.exports = { cacheSessionTimestamps, positiveTimestamp };
