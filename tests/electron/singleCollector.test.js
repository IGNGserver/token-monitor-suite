'use strict';

// Guards the single-collector invariant.
//
// When a headless agent is running on the same machine it already collects and
// posts this device's usage. The widget's client-mode sync collector used to
// start anyway: its beforeEnqueue() refused every upload, but the runtime still
// spawned a full tokscale scan set plus a chokidar watch over the same trees, so
// two collectors ran concurrently. Measured on a real install that was ~170% of
// one core for two processes that should have been one collector plus one relay.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const rootDir = path.join(__dirname, '..', '..');
const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];
const mainSource = fs.readFileSync(path.join(rootDir, 'src', 'electron', 'main.js'), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  // Walk braces so the body is captured even with nested functions/templates.
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the sync collector refuses to start while an external agent is active', () => {
  const body = functionBody(mainSource, 'startSyncCollector');
  assert.match(
    body,
    /if \(isExternalAgentActive\(\)\)/,
    'startSyncCollector must consult isExternalAgentActive() before building a runtime'
  );
  // The gate has to come before the runtime is constructed, otherwise the scans
  // still start and only the upload is suppressed.
  const gateIndex = body.indexOf('if (isExternalAgentActive())');
  const runtimeIndex = body.indexOf('createDeviceRuntime(');
  const sinkIndex = body.indexOf('createSyncUploadSink(');
  assert.notEqual(runtimeIndex, -1, 'the runtime should still be created on the normal path');
  assert.ok(
    gateIndex < runtimeIndex,
    'the agent gate must run before createDeviceRuntime(), not after'
  );
  assert.ok(
    gateIndex < sinkIndex,
    'the agent gate must run before createSyncUploadSink(), not after'
  );
  // Returning early is what actually prevents the second collector.
  const gateBody = body.slice(gateIndex, gateIndex + 320);
  assert.match(gateBody, /return;/, 'the gated branch must return instead of falling through');
  assert.match(gateBody, /publishSyncHealth\(\)/, 'the relay state should still be published to the renderer');
});

test('the relay state is a known sync-health state in every locale', async () => {
  // The mapping moved into the shared UI, which both hosts render, so the guard
  // points there now. It stays a named map because a state the main process can
  // publish must never render as a raw slug.
  const mappingPath = path.join(rootDir, 'src', 'shared-ui', 'core', 'syncHealth.js');
  const { SYNC_HEALTH_STATE_KEYS, KNOWN_SYNC_HEALTH_STATES } = await import(pathToFileURL(mappingPath));
  assert.ok(SYNC_HEALTH_STATE_KEYS.relay, "the shared UI must map the 'relay' state to a translation key");
  assert.ok(KNOWN_SYNC_HEALTH_STATES.includes('relay'));

  // The dictionaries are module-private, so assert the key literal appears once
  // per locale block rather than re-implementing the parser here.
  const relayKey = SYNC_HEALTH_STATE_KEYS.relay;
  const source = fs.readFileSync(path.join(rootDir, 'src', 'shared-ui', 'core', 'i18n.js'), 'utf8');
  const occurrences = (source.match(new RegExp(`'${relayKey.replace(/\./g, '\\.')}'`, 'g')) || []).length;
  assert.ok(
    occurrences >= LOCALES.length,
    `every locale needs ${relayKey} (found ${occurrences}, need >= ${LOCALES.length})`
  );
});

test('every sync-health state the main process can set is renderable', () => {
  const mappingSource = fs.readFileSync(path.join(rootDir, 'src', 'shared-ui', 'core', 'syncHealth.js'), 'utf8');
  const mapping = mappingSource.match(/SYNC_HEALTH_STATE_KEYS = Object\.freeze\(\{([\s\S]*?)\n\}\);/)[1];
  const known = new Set([...mapping.matchAll(/^\s*'?([a-z_-]+)'?:/gm)].map((match) => match[1]));

  // Collect the state literals assigned through updateSyncHealth({ state: ... })
  // plus the initial syncHealth literal, so a new state cannot silently render
  // as "unknown".
  const assigned = new Set();
  for (const match of mainSource.matchAll(/state:\s*'([a-z-]+)'/g)) assigned.add(match[1]);
  for (const match of mainSource.matchAll(/state:\s*([a-z]+)\s*\?/g)) assigned.add(match[1]);

  const unknown = [...assigned].filter((state) => !known.has(state));
  assert.deepEqual(unknown, [], `sync-health states with no renderer label: ${unknown.join(', ')}`);
});

test('stats pushes are coalesced instead of broadcast per tick', () => {
  // Each push cloned the record three times and serialized a ~1.3 MB IPC message,
  // and the producer runs on every collector tick (watch ticks re-arm every 1.5s).
  const sendBody = functionBody(mainSource, 'sendPush');
  assert.match(sendBody, /PUSH_COALESCE_MS/, 'the push must go through the coalescing window');
  assert.match(sendBody, /pendingPush = payload;/, 'only the newest payload should be kept');
  assert.match(
    sendBody,
    /if \(pendingPushTimer !== null\) return;/,
    'a queued push must not schedule a second timer'
  );
  assert.doesNotMatch(
    sendBody,
    /mainWindow\.webContents\.send/,
    'sendPush must not broadcast synchronously; the flush does that'
  );

  const flushBody = functionBody(mainSource, 'flushPush');
  // Tray presentation is independent of the stats push; only the window
  // broadcast belongs in this coalesced renderer path.
  assert.match(flushBody, /mainWindow\.webContents\.send\('stats:push'/, 'the flush performs the broadcast');
  // The history revision is still computed across the whole coalesced window. It
  // used to gate a notification to the standalone trends window; that window is
  // gone (the trends view renders in the main window from the same push), so the
  // revision is retained for the read path rather than a second-window send.
  // It is captured when the push is queued, so the revision reflects the window
  // boundary rather than whichever tick happened to flush last.
  assert.match(sendBody, /pendingPushHistoryRevision \?\?= statsHistoryRevision\(latestStats\)/);
  assert.doesNotMatch(flushBody, /dashboardWindow/, 'the removed trends window must not linger here');

  // A queued push must still reach the consumers on the read path and on quit.
  assert.match(mainSource, /function flushPendingPush\(\)/);
  // A plain slice: the brace-walker above is not string/template aware and these
  // bodies contain literals with braces.
  const fetchStart = mainSource.indexOf('async function fetchStats(');
  assert.notEqual(fetchStart, -1, 'fetchStats should exist');
  assert.match(
    mainSource.slice(fetchStart, fetchStart + 300),
    /flushPendingPush\(\)/,
    'fetchStats should not report a stale snapshot'
  );
  // The quit path flushes before tearing down, so a queued snapshot is not lost.
  // The macOS Widget publisher that used to be stopped alongside it is gone with
  // the widget, so only the flush is pinned here.
  const quitStart = mainSource.indexOf("app.on('before-quit'");
  assert.notEqual(quitStart, -1, 'the before-quit handler should exist');
  const quitBody = mainSource.slice(quitStart, quitStart + 400);
  assert.match(quitBody, /flushPendingPush\(\)/, 'quit must flush a queued snapshot');
});
