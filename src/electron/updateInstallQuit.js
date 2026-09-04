'use strict';

// Coordinates the short window between electron-updater being asked to install
// and Electron confirming that the native updater has taken ownership of exit.
// quitAndInstall() returns void, so without this boundary a failed hand-off can
// leave the normal quit path disabled for the rest of the process.
function createUpdateInstallQuitGuard({
  graceMs,
  singleUseAttempt = false,
  watchdogEnabled = () => true,
  claim,
  release,
  onStalled = () => {},
  onHandoff = () => {},
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  let phase = 'idle';
  let timer = null;

  function clearTimer() {
    if (timer === null) return;
    clearTimeoutFn(timer);
    timer = null;
  }

  const endedPhase = () => (singleUseAttempt ? 'spent' : 'idle');

  function request() {
    if (phase !== 'idle') return false;
    phase = 'requested';
    claim();
    clearTimer();
    // Do not arm a recovery timer when the hand-off signal could not be attached:
    // expiring the claim in that case would leave a late native hand-off racing a
    // forced quit with no listener able to reclaim it.
    if (!watchdogEnabled()) return true;
    timer = setTimeoutFn(() => {
      timer = null;
      if (phase !== 'requested') return;
      phase = endedPhase();
      release();
      onStalled();
    }, graceMs);
    timer?.unref?.();
    return true;
  }

  function noteHandoff() {
    if (phase !== 'requested' && phase !== 'spent') return false;
    const afterStalledReport = phase === 'spent';
    phase = 'handoff';
    clearTimer();
    claim();
    onHandoff(afterStalledReport);
    return true;
  }

  function abort() {
    if (phase !== 'requested' && phase !== 'handoff') return false;
    phase = endedPhase();
    clearTimer();
    release();
    return true;
  }

  return {
    request,
    noteHandoff,
    abort,
    phase: () => phase,
    isInstalling: () => phase === 'requested' || phase === 'handoff',
    isSpent: () => phase === 'spent',
    isOutstanding: () => phase !== 'idle'
  };
}

function observeUpdateInstallHandoff(emitter, onHandoff) {
  if (!emitter || typeof emitter.on !== 'function') return false;
  try {
    emitter.on('before-quit-for-update', onHandoff);
  } catch (_) {
    return false;
  }
  return true;
}

module.exports = { createUpdateInstallQuitGuard, observeUpdateInstallHandoff };
