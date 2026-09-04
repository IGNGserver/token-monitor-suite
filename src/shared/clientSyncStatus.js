'use strict';

// Closed, path-free status values for the Cursor/Antigravity self-sync lanes.
// These values stay local to the collector and its logs; they are deliberately
// separate from the removed clientHealth wire document.
const CLIENT_SYNC_FAILURE_STAGES = Object.freeze(['spawn', 'timeout', 'process-exit', 'unknown']);
const CLIENT_SYNC_FAILURE_STAGE_SET = new Set(CLIENT_SYNC_FAILURE_STAGES);
const MAX_SYNC_EXIT_CODE = 2 ** 31 - 1;
const CLIENT_SYNC_DETAIL_CODES = Object.freeze([
  'language-server-not-found',
  'sync-lock',
  'rpc-failed',
  'permission-denied',
  'cache-write-failed',
  'invalid-response',
  'network-timeout',
  'network-failed',
  'authentication-failed',
  'unknown'
]);
const CLIENT_SYNC_DETAIL_CODE_SET = new Set(CLIENT_SYNC_DETAIL_CODES);
const MAX_SYNC_DETAIL_INPUT_LENGTH = 8 * 1024;

function normalizeClientSyncFailureStage(value) {
  const stage = String(value ?? '').trim().toLowerCase();
  if (!stage) return null;
  return CLIENT_SYNC_FAILURE_STAGE_SET.has(stage) ? stage : 'unknown';
}

function normalizeClientSyncExitCode(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const code = Number(raw);
  return Number.isSafeInteger(code) && code >= 0 && code <= MAX_SYNC_EXIT_CODE ? code : null;
}

function normalizeClientSyncDetailCode(value) {
  const code = String(value ?? '').trim().toLowerCase();
  if (!code) return null;
  return CLIENT_SYNC_DETAIL_CODE_SET.has(code) ? code : 'unknown';
}

function boundedSyncDetailText(value) {
  const raw = String(value ?? '');
  if (raw.length <= MAX_SYNC_DETAIL_INPUT_LENGTH) return raw;
  let bounded = '';
  let codePoints = 0;
  for (const character of raw) {
    if (codePoints >= MAX_SYNC_DETAIL_INPUT_LENGTH) break;
    bounded += character;
    codePoints += 1;
  }
  return bounded;
}

function classifyClientSyncDetailCode({ client = '', text = '' } = {}) {
  const message = boundedSyncDetailText(text).trim().toLowerCase();
  if (!message) return null;

  if (/permission denied|access is denied|operation not permitted|\beacces\b|\beperm\b/.test(message)) {
    return 'permission-denied';
  }
  if (/sync[\s._-]*lock|lock at .*already exists|already exists.*lock|another sync is already running/.test(message)) {
    return 'sync-lock';
  }
  if (
    /no space left on device|read-only file system/.test(message)
    || /failed to (?:create|persist|write|save).*(?:cache|artifact|manifest)/.test(message)
    || /(?:cache|artifact|manifest).*(?:write|persist|save).*(?:failed|error)/.test(message)
  ) {
    return 'cache-write-failed';
  }
  if (/session (?:token )?(?:expired|invalid)|invalid (?:api )?token|not authenticated|re-authenticate|unauthorized|forbidden|status\s+(?:401|403)\b/.test(message)) {
    return 'authentication-failed';
  }
  const hasNetworkTimeoutTerm = /\b(?:etimedout|network|https?|request|connect(?:ion)?|socket|tcp|tls|dns)\b/.test(message);
  const hasTimeoutTerm = /\b(?:etimedout|timed out|timeout|deadline exceeded|deadline has elapsed)\b/.test(message);
  if (hasNetworkTimeoutTerm && hasTimeoutTerm) return 'network-timeout';
  if (/malformed.*response|invalid response|expected csv format|failed to parse response|invalid json/.test(message)) {
    return 'invalid-response';
  }
  if (
    client === 'antigravity'
    && /cannot discover .*language servers?|language server.*(?:not found|unavailable)|no .*language servers?/.test(message)
  ) {
    return 'language-server-not-found';
  }
  if (
    client === 'antigravity'
    && (/\brpc\b.*(?:fail|error)|(?:fail|error).*\brpc\b|failed to connect to antigravity rpc/.test(message))
  ) {
    return 'rpc-failed';
  }
  if (/failed to connect|connection refused|connection reset|could not resolve|\bdns\b|\bnetwork\b/.test(message)) {
    return 'network-failed';
  }
  return null;
}

module.exports = {
  CLIENT_SYNC_DETAIL_CODES,
  CLIENT_SYNC_FAILURE_STAGES,
  MAX_SYNC_DETAIL_INPUT_LENGTH,
  classifyClientSyncDetailCode,
  normalizeClientSyncDetailCode,
  normalizeClientSyncExitCode,
  normalizeClientSyncFailureStage
};
