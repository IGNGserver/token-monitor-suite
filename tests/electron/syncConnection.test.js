'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyStreamFailure } = require('../../src/electron/syncConnection');

test('eof maps to disconnected', () => {
  assert.deepEqual(classifyStreamFailure({ eof: true }), { reason: 'disconnected', detail: null });
});

test('401 and 403 map to unauthorized', () => {
  assert.deepEqual(classifyStreamFailure({ status: 401 }), { reason: 'unauthorized', detail: null });
  assert.deepEqual(classifyStreamFailure({ status: 403 }), { reason: 'unauthorized', detail: null });
});

test('other HTTP status maps to server_error with the code as detail', () => {
  assert.deepEqual(classifyStreamFailure({ status: 500 }), { reason: 'server_error', detail: '500' });
  assert.deepEqual(classifyStreamFailure({ status: 503 }), { reason: 'server_error', detail: '503' });
});

test('network errnos map to their reason', () => {
  assert.deepEqual(classifyStreamFailure({ errorCode: 'ECONNREFUSED' }), { reason: 'refused', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'ETIMEDOUT' }), { reason: 'timeout', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'request_timeout' }), { reason: 'timeout', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'ENOTFOUND' }), { reason: 'dns', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'EAI_AGAIN' }), { reason: 'dns', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'EHOSTUNREACH' }), { reason: 'unreachable', detail: null });
  assert.deepEqual(classifyStreamFailure({ errorCode: 'ENETUNREACH' }), { reason: 'unreachable', detail: null });
});

test('unknown errno falls back to network with the code as detail', () => {
  assert.deepEqual(classifyStreamFailure({ errorCode: 'ECONNRESET' }), { reason: 'network', detail: 'ECONNRESET' });
});

test('no recognizable signal falls back to network with the message as detail', () => {
  assert.deepEqual(classifyStreamFailure({ message: 'fetch failed' }), { reason: 'network', detail: 'fetch failed' });
  assert.deepEqual(classifyStreamFailure({}), { reason: 'network', detail: null });
});

test('local stats overlays do not clear a disconnected Hub stream state', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../src/electron/renderer/app.js'), 'utf8');
  const statsPush = app.match(/window\.tokenMonitor\.onStatsPush\?\.\(\(payload\) => \{[\s\S]*?\n\}\);/)?.[0] || '';

  assert.match(statsPush, /if \(payload\.data\?\.reason !== 'local' && payload\.data\?\.transport !== 'rest'\) \{\s*state\.streamConnected = true;\s*state\.streamFailure = null;\s*\}/);
});

test('a recovered SSE connection resets the accumulated retry backoff', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  const successPath = main.match(/async function startStatsStream[\s\S]*?if \(!response\.ok \|\| !response\.body\) \{[\s\S]*?sseAttempt = 0;[\s\S]*?sendStatus\(true, \{ state: 'live' \}\);/)?.[0] || '';

  assert.match(successPath, /sseAttempt = 0;/);
  assert.match(successPath, /sseNextRetryAt = null;/);
  assert.match(successPath, /attempt: 0/);
});

test('manual sync recovery reconnects SSE only when the stream is offline', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  const recovery = main.match(/async function recoverNow[\s\S]*?const canRefreshRuntime/)?.[0] || '';

  assert.match(recovery, /const takeStreamReconnectRequest = \(\) => \{/);
  assert.match(recovery, /\(forceStream \|\| !streamConnected\)/);
  assert.match(recovery, /let streamStartPromise = takeStreamReconnectRequest\(\)/);
});

test('resume and network recovery force a half-open SSE reconnect', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  const network = main.match(/function checkSyncNetworkRecovery[\s\S]*?function startSyncNetworkMonitor/)?.[0] || '';
  const lifecycleStart = main.indexOf("powerMonitor?.on?.('resume'");
  const lifecycleEnd = main.indexOf('  startMode();', lifecycleStart);
  const lifecycle = lifecycleStart >= 0 && lifecycleEnd > lifecycleStart
    ? main.slice(lifecycleStart, lifecycleEnd)
    : '';

  assert.match(network, /recoverNow\(\{ forceStream: true \}\)/);
  assert.match(lifecycle, /recoverNow\(\{ forceStream: true \}\)/);
  assert.match(lifecycle, /unlock-screen/);
});

test('client startup launches REST bootstrap alongside the SSE supervisor', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  const startMode = main.slice(main.indexOf('function startMode()'));
  const clientBranch = startMode.match(/if \(settings\.hubMode === 'client'\) \{[\s\S]*?\n {4}\} else \{/)?.[0] || '';

  assert.match(clientBranch, /startSyncCollector\(\);/);
  assert.match(clientBranch, /startClientRestBootstrap\(requestedGeneration\);/);
  assert.match(clientBranch, /startStatsStream\(\{ resetSnapshot: true, resetBackoff: true \}\)/);
  assert.ok(
    clientBranch.indexOf('startClientRestBootstrap(requestedGeneration)')
      < clientBranch.indexOf('startStatsStream({ resetSnapshot: true, resetBackoff: true })')
  );
});

test('initial lifecycle starts only after the IPC surface has been registered', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/electron/main.js'), 'utf8');
  const ready = main.slice(main.indexOf('app.whenReady().then'));
  const startup = ready.lastIndexOf('  startMode();');
  const lastHandler = ready.lastIndexOf("ipcMain.on('dashboard:close'");

  assert.ok(lastHandler >= 0, 'dashboard IPC registration should exist');
  assert.ok(startup > lastHandler, 'collector startup should follow IPC registration');
});
