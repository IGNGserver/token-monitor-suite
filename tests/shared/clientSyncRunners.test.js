'use strict';

// Trae and Warp/Oz read a cache that tokscale itself writes, so the collector has
// to run `tokscale <client> sync`. The load-bearing rule is the credential gate:
// their login is interactive, so an unauthenticated machine must be SKIPPED
// rather than have a doomed subprocess spawned on every tick.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  clientCacheExists,
  hasClientCredentials,
  runClientSync,
  statusShowsCredentials
} = require('../../src/shared/clientSyncRunners');
const { SELF_SYNC_KINDS } = require('../../src/shared/selfSyncThrottle');

test('trae and warp are self-sync kinds so their cache roots stay unwatched', () => {
  assert.ok(SELF_SYNC_KINDS.includes('trae'));
  assert.ok(SELF_SYNC_KINDS.includes('warp'));
});

test('SELF_SYNC_KINDS has no duplicates', () => {
  assert.equal(new Set(SELF_SYNC_KINDS).size, SELF_SYNC_KINDS.length);
});

test('warp credentials come from its hasCredentials flag', () => {
  assert.equal(statusShowsCredentials('warp', { hasCredentials: true }), true);
  assert.equal(statusShowsCredentials('warp', { hasCredentials: false }), false);
  // A cache-less but authenticated account must still sync.
  assert.equal(statusShowsCredentials('warp', { hasCredentials: true, hasCache: false }), true);
});

test('trae credentials come from any true channel flag', () => {
  assert.equal(statusShowsCredentials('trae', { trae: true, 'trae-solo': false }), true);
  assert.equal(statusShowsCredentials('trae', { trae: false, 'trae-solo': true }), true);
  assert.equal(statusShowsCredentials('trae', { trae: false, 'trae-solo': false }), false);
  // Diagnostics is prose, not a channel: a truthy string must not authenticate.
  assert.equal(statusShowsCredentials('trae', { trae: false, diagnostics: ['not authenticated'] }), false);
});

test('unreadable or malformed status is treated as NOT authenticated', () => {
  // Guessing wrong here spawns an interactive-login subprocess on every tick, so
  // the safe direction is "no credentials".
  assert.equal(statusShowsCredentials('trae', null), false);
  assert.equal(statusShowsCredentials('warp', undefined), false);
  assert.equal(statusShowsCredentials('warp', 'not json'), false);
  assert.equal(statusShowsCredentials('warp', {}), false);
});

test('hasClientCredentials returns false when the status command fails', async () => {
  const result = await hasClientCredentials('warp', {
    runStatus: async () => { throw new Error('not logged in'); }
  });
  assert.equal(result, false);
});

test('hasClientCredentials delegates to an injected status probe', async () => {
  assert.equal(await hasClientCredentials('trae', { runStatus: async () => true }), true);
  assert.equal(await hasClientCredentials('trae', { runStatus: async () => false }), false);
});

test('runClientSync reports that it attempted a sync', async () => {
  const seen = [];
  const result = await runClientSync('warp', { runSync: async (client) => { seen.push(client); } });
  assert.deepEqual(seen, ['warp']);
  assert.deepEqual(result, { attempted: true });
});

test('runClientSync surfaces a sync failure to the caller', async () => {
  await assert.rejects(
    () => runClientSync('trae', { runSync: async () => { throw new Error('boom'); } }),
    /boom/
  );
});

test('clientCacheExists is false for a client with no cache yet', () => {
  // The sync CREATES the cache, so absence must not be treated as an error.
  assert.equal(clientCacheExists('warp', { homeDir: '/nonexistent-home-xyz' }), false);
  assert.equal(clientCacheExists('trae', { homeDir: '/nonexistent-home-xyz' }), false);
});
