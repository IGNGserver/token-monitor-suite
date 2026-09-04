'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createUpdateInstallQuitGuard,
  observeUpdateInstallHandoff
} = require('../../src/electron/updateInstallQuit');
const {
  installFailureErrorKind,
  updateInstallQuitPolicy
} = require('../../src/shared/appUpdater');

function harness(options = {}) {
  const events = [];
  const timers = [];
  const guard = createUpdateInstallQuitGuard({
    graceMs: 100,
    singleUseAttempt: true,
    watchdogEnabled: () => true,
    claim: () => events.push('claim'),
    release: () => events.push('release'),
    onStalled: () => events.push('stalled'),
    onHandoff: (afterStalledReport) => events.push(afterStalledReport ? 'late-handoff' : 'handoff'),
    setTimeoutFn: (callback, delay) => {
      const timer = { callback, delay, cleared: false, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => { timer.cleared = true; },
    ...options
  });
  return {
    guard,
    events,
    timers,
    fire() {
      const timer = timers.at(-1);
      assert.ok(timer);
      timer.callback();
    }
  };
}

test('install guard claims once, confirms hand-off, and releases on abort', () => {
  const { guard, events, timers } = harness({ singleUseAttempt: false });
  assert.equal(guard.request(), true);
  assert.equal(guard.request(), false);
  assert.equal(guard.isInstalling(), true);
  assert.equal(guard.isOutstanding(), true);
  assert.equal(guard.noteHandoff(), true);
  assert.equal(guard.phase(), 'handoff');
  assert.equal(timers[0].cleared, true);
  assert.deepEqual(events, ['claim', 'claim', 'handoff']);
  assert.equal(guard.abort(), true);
  assert.equal(guard.phase(), 'idle');
  assert.deepEqual(events, ['claim', 'claim', 'handoff', 'release']);
});

test('a stalled single-use install releases quit and blocks a second attempt', () => {
  const { guard, events, fire } = harness();
  assert.equal(guard.request(), true);
  fire();
  assert.equal(guard.phase(), 'spent');
  assert.equal(guard.isInstalling(), false);
  assert.equal(guard.isOutstanding(), true);
  assert.equal(guard.request(), false);
  assert.deepEqual(events, ['claim', 'release', 'stalled']);
});

test('a late hand-off reclaims a spent attempt and clears the stall report', () => {
  const { guard, events, fire } = harness();
  guard.request();
  fire();
  assert.equal(guard.noteHandoff(), true);
  assert.equal(guard.phase(), 'handoff');
  assert.deepEqual(events, ['claim', 'release', 'stalled', 'claim', 'late-handoff']);
});

test('a missing hand-off observer disables the watchdog without changing install ownership', () => {
  const { guard, events, timers } = harness({ watchdogEnabled: () => false });
  guard.request();
  assert.equal(timers.length, 0);
  assert.equal(guard.phase(), 'requested');
  assert.equal(guard.abort(), true);
  assert.deepEqual(events, ['claim', 'release']);
});

test('handoff observer only reports a successful event registration', () => {
  const attached = [];
  const listener = () => {};
  assert.equal(observeUpdateInstallHandoff(null, listener), false);
  assert.equal(observeUpdateInstallHandoff({ on: 'not a function' }, listener), false);
  assert.equal(observeUpdateInstallHandoff({ on() { throw new Error('unsupported'); } }, listener), false);
  assert.equal(observeUpdateInstallHandoff({ on: (...args) => attached.push(args) }, listener), true);
  assert.deepEqual(attached, [['before-quit-for-update', listener]]);
});

test('updater policies keep macOS retry safety separate from repeatable installs', () => {
  assert.equal(updateInstallQuitPolicy('darwin').singleUseAttempt, true);
  assert.ok(updateInstallQuitPolicy('darwin').graceMs >= 2 * 60 * 1000);
  assert.equal(updateInstallQuitPolicy('win32').singleUseAttempt, false);
  assert.ok(updateInstallQuitPolicy('win32').graceMs >= 5 * 1000);
  assert.equal(installFailureErrorKind({ spent: true, stalled: true }), 'installer-did-not-start-spent');
});

test('main wires the guard around quitAndInstall and preserves the normal quit path', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'main.js'), 'utf8');
  assert.match(main, /createUpdateInstallQuitGuard\(\{/);
  assert.match(main, /updateHandoffObserved = observeUpdateInstallHandoff\(/);
  assert.match(main, /if \(!updateInstallQuit\.request\(\)\)/);
  assert.match(main, /autoUpdater\.quitAndInstall\(true, true\)/);
  assert.match(main, /if \(skipForcedQuit\) return;/);
  assert.match(main, /function performQuit\(\)/);
  assert.match(main, /if \(updateInstallQuit\.isOutstanding\(\)\) return deriveAppUpdateState\(\);/);
});
