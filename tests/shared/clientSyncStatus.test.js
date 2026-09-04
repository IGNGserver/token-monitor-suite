'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CLIENT_SYNC_DETAIL_CODES,
  MAX_SYNC_DETAIL_INPUT_LENGTH,
  classifyClientSyncDetailCode,
  normalizeClientSyncDetailCode,
  normalizeClientSyncExitCode,
  normalizeClientSyncFailureStage
} = require('../../src/shared/clientSyncStatus');

test('self-sync status normalization exposes only closed path-free values', () => {
  assert.equal(normalizeClientSyncFailureStage('process-exit'), 'process-exit');
  assert.equal(normalizeClientSyncFailureStage('/Users/alice/private'), 'unknown');
  assert.equal(normalizeClientSyncDetailCode('rpc-failed'), 'rpc-failed');
  assert.equal(normalizeClientSyncDetailCode('/Users/alice/private'), 'unknown');
  assert.equal(normalizeClientSyncExitCode(17), 17);
  assert.equal(normalizeClientSyncExitCode('17; rm -rf'), null);
});

test('self-sync error classification is conservative and bounded', () => {
  assert.deepEqual([...CLIENT_SYNC_DETAIL_CODES].sort(), [
    'authentication-failed',
    'cache-write-failed',
    'invalid-response',
    'language-server-not-found',
    'network-failed',
    'network-timeout',
    'permission-denied',
    'rpc-failed',
    'sync-lock',
    'unknown'
  ].sort());
  assert.equal(classifyClientSyncDetailCode({ client: 'antigravity', text: 'Failed to connect to Antigravity RPC' }), 'rpc-failed');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'Cursor API returned status 401' }), 'authentication-failed');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'Invalid response from Cursor API' }), 'invalid-response');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'Permission denied /Users/alice' }), 'permission-denied');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'Failed to write cache manifest' }), 'cache-write-failed');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'Connection refused by Cursor API' }), 'network-failed');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'HTTPS request timed out' }), 'network-timeout');
  assert.equal(classifyClientSyncDetailCode({ client: 'antigravity', text: 'sync.lock already exists' }), 'sync-lock');
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'tokscale cursor sync timed out after 30000ms' }), null);
  assert.equal(classifyClientSyncDetailCode({ client: 'cursor', text: 'new upstream wording' }), null);
  assert.equal(classifyClientSyncDetailCode({
    client: 'cursor',
    text: `${'x'.repeat(MAX_SYNC_DETAIL_INPUT_LENGTH + 1)}connection refused`
  }), null);
});
