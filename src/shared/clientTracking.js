'use strict';

// micode (MiMo Code) is intentionally NOT default-tracked: mimocode.db auto-imports
// Claude Code sessions (its claude-import service), so scanning it double-counts the
// `claude` client. tokscale 4.0.5 fixed the scan path but does not dedup imports, and
// the imported rows aren't cleanly separable (MiMo is multi-model). It stays a known
// client — one click to enable in Settings → tools — until tokscale dedups upstream.
const DEFAULT_CLIENTS = 'claude,claude-desktop,codex,hermes,opencode,openclaw,cursor,antigravity,cline,kimi,qwen,grok,copilot,pi,zed,kilocode,commandcode,zcode,kiro,codebuddy,workbuddy,proma,deepseek-harness,reasonix';

// Every wired client id, including opt-in ones kept out of DEFAULT_CLIENTS (micode).
// Display-preference normalization (hide/pin/reorder) keys off this list, so an opt-in
// client's prefs survive a round-trip instead of being silently dropped. Mirror the
// renderer's KNOWN_CLIENTS; add any future opt-in ids here too.
function insertClientBefore(clientsCsv, clientId, beforeClientId) {
  const clients = clientsCsv.split(',');
  const index = clients.indexOf(beforeClientId);
  clients.splice(index >= 0 ? index : clients.length, 0, clientId);
  return clients.join(',');
}

// qodercn is an opt-in local SQLite adapter. Keep it in the known set so saved
// display preferences survive a round-trip without making it part of defaults.
const KNOWN_CLIENTS = insertClientBefore(
  insertClientBefore(DEFAULT_CLIENTS, 'micode', 'zcode'),
  'qodercn',
  'reasonix'
);

// Default-tracked clients introduced after installs may already have an explicit
// `settings.clients` list. Each id is appended once for non-empty saved lists, then
// recorded in `migratedDefaultClients` so a later user disable sticks.
const NEW_DEFAULT_CLIENTS = Object.freeze(['claude-desktop', 'deepseek-harness']);

function normalizeClientsCsv(value) {
  return String(value ?? '').split(',').map((client) => client.trim().toLowerCase()).filter(Boolean).join(',');
}

function clientsCsvForSetting(value, fallback = DEFAULT_CLIENTS) {
  if (value === undefined || value === null) return normalizeClientsCsv(fallback);
  return normalizeClientsCsv(value);
}

/**
 * One-time merge of newly introduced default clients into an explicit tracked list.
 * Empty lists stay empty (user disabled everything). Clients already migrated are
 * never re-added after the user turns them off.
 */
function applyNewDefaultClientMigration(clientsValue, migratedValue) {
  const defaultSet = new Set(DEFAULT_CLIENTS.split(',').filter(Boolean));
  const list = normalizeClientsCsv(clientsValue).split(',').filter(Boolean);
  const migrated = new Set(normalizeClientsCsv(migratedValue).split(',').filter(Boolean));
  const allowAppend = list.length > 0;
  let clientsChanged = false;

  for (const id of NEW_DEFAULT_CLIENTS) {
    if (!defaultSet.has(id)) continue;
    if (migrated.has(id)) continue;
    if (allowAppend && !list.includes(id)) {
      list.push(id);
      clientsChanged = true;
    }
    migrated.add(id);
  }

  const clients = list.join(',');
  const migratedDefaultClients = [...migrated].join(',');
  const migratedChanged = normalizeClientsCsv(migratedValue) !== migratedDefaultClients;
  return {
    clients,
    migratedDefaultClients,
    changed: clientsChanged || migratedChanged
  };
}

module.exports = {
  DEFAULT_CLIENTS,
  KNOWN_CLIENTS,
  NEW_DEFAULT_CLIENTS,
  clientsCsvForSetting,
  normalizeClientsCsv,
  applyNewDefaultClientMigration
};
