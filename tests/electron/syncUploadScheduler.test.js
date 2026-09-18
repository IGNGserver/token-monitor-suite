'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createSyncUploadScheduler,
  normalizeSyncUploadIntervalMs
} = require('../../src/electron/syncUploadScheduler');

function createManualClock() {
  let nowMs = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => nowMs,
    setTimeout(fn, delayMs) {
      const id = nextId++;
      timers.set(id, { fn, dueAt: nowMs + delayMs });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    jump(ms) {
      nowMs += ms;
    },
    async advance(ms) {
      nowMs += ms;
      for (;;) {
        const due = Array.from(timers.entries())
          .filter(([, timer]) => timer.dueAt <= nowMs)
          .sort((a, b) => a[1].dueAt - b[1].dueAt);
        if (due.length === 0) break;
        const [id, timer] = due[0];
        timers.delete(id);
        timer.fn();
        await Promise.resolve();
      }
    },
    timerCount() {
      return timers.size;
    }
  };
}

test('normalizeSyncUploadIntervalMs accepts live and fixed interval choices', () => {
  assert.equal(normalizeSyncUploadIntervalMs(0), 0);
  assert.equal(normalizeSyncUploadIntervalMs('600000'), 600000);
  assert.equal(normalizeSyncUploadIntervalMs(1200000), 1200000);
  assert.equal(normalizeSyncUploadIntervalMs(1800000), 1800000);
  assert.equal(normalizeSyncUploadIntervalMs('bad'), 0);
  assert.equal(normalizeSyncUploadIntervalMs('bad', 1200000), 1200000);
});

test('live upload mode posts every summary immediately', async () => {
  const uploads = [];
  const clock = createManualClock();
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => uploads.push(summary.id)
  });

  await scheduler.enqueue({ id: 'first' });
  await scheduler.enqueue({ id: 'second' });

  assert.deepEqual(uploads, ['first', 'second']);
  assert.equal(clock.timerCount(), 0);
});

test('interval mode uploads the first summary immediately and coalesces later updates', async () => {
  const uploads = [];
  const clock = createManualClock();
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => uploads.push(summary.id)
  });

  await scheduler.enqueue({ id: 'initial' });
  await scheduler.enqueue({ id: 'mid-1' });
  await scheduler.enqueue({ id: 'mid-2' });
  await clock.advance(599999);

  assert.deepEqual(uploads, ['initial']);

  await clock.advance(1);

  assert.deepEqual(uploads, ['initial', 'mid-2']);
  assert.equal(clock.timerCount(), 0);
});

test('interval mode serializes uploads and keeps the latest summary received in flight', async () => {
  const started = [];
  const completed = [];
  const clock = createManualClock();
  let activeUploads = 0;
  let maxActiveUploads = 0;
  let releasePending;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      started.push(summary.id);
      activeUploads += 1;
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
      if (summary.id === 'pending') {
        await new Promise((resolve) => { releasePending = resolve; });
      }
      activeUploads -= 1;
      completed.push(summary.id);
    }
  });

  await scheduler.enqueue({ id: 'initial' });
  await scheduler.enqueue({ id: 'pending' });
  clock.jump(600000);
  const flushPromise = scheduler.flush();
  await Promise.resolve();

  await scheduler.enqueue({ id: 'newer' });
  await scheduler.enqueue({ id: 'newest' });

  assert.deepEqual(started, ['initial', 'pending']);
  assert.equal(maxActiveUploads, 1);

  releasePending();
  await flushPromise;
  assert.deepEqual(completed, ['initial', 'pending']);
  assert.equal(clock.timerCount(), 1);

  await clock.advance(600000);
  await Promise.resolve();

  assert.deepEqual(started, ['initial', 'pending', 'newest']);
  assert.deepEqual(completed, ['initial', 'pending', 'newest']);
  assert.equal(maxActiveUploads, 1);
});

test('flush waits for an active upload and uploads the newest pending summary', async () => {
  const completed = [];
  const clock = createManualClock();
  let releaseActive;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      if (summary.id === 'active') {
        await new Promise((resolve) => { releaseActive = resolve; });
      }
      completed.push(summary.id);
    }
  });

  await scheduler.enqueue({ id: 'initial' });
  await scheduler.enqueue({ id: 'active' });
  clock.jump(600000);
  const activeUpload = scheduler.flush();
  await Promise.resolve();
  await scheduler.enqueue({ id: 'newer' });
  await scheduler.enqueue({ id: 'newest' });

  let flushResolved = false;
  const pendingFlush = scheduler.flush().then(() => { flushResolved = true; });
  await Promise.resolve();
  assert.equal(flushResolved, false);

  releaseActive();
  await Promise.all([activeUpload, pendingFlush]);

  assert.deepEqual(completed, ['initial', 'active', 'newest']);
  assert.equal(clock.timerCount(), 0);
});

test('a retryable failure keeps backoff while newer data replaces the pending summary', async () => {
  const uploads = [];
  const clock = createManualClock();
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    retryBaseMs: 1000,
    retryMaxMs: 1000,
    random: () => 1,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      if (summary.id === 'failed') throw new Error('offline');
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'failed' }), /offline/);
  await scheduler.enqueue({ id: 'retry' });

  assert.deepEqual(uploads, ['failed']);
  assert.equal(clock.timerCount(), 1);
  await clock.advance(999);
  assert.deepEqual(uploads, ['failed']);
  await clock.advance(1);
  await Promise.resolve();
  assert.deepEqual(uploads, ['failed', 'retry']);
  scheduler.stop();
});

test('a failed upload retains the same summary and retries without a newer event', async () => {
  const uploads = [];
  const clock = createManualClock();
  let attempts = 0;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    retryBaseMs: 1000,
    retryMaxMs: 1000,
    random: () => 1,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('offline'), { code: 'ECONNRESET' });
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'same-summary' }), /offline/);
  assert.equal(clock.timerCount(), 1);
  assert.equal(scheduler.getDiagnostics().pendingRevision, 1);
  assert.equal(scheduler.getDiagnostics().state, 'waiting');

  await clock.advance(999);
  assert.deepEqual(uploads, ['same-summary']);
  await clock.advance(1);
  await Promise.resolve();

  assert.deepEqual(uploads, ['same-summary', 'same-summary']);
  assert.equal(scheduler.getDiagnostics().pendingRevision, null);
  assert.equal(scheduler.getDiagnostics().failureCode, null);
  scheduler.stop();
});

test('retry-after is respected and a non-retryable failure falls back to the slow retry cadence', async () => {
  const clock = createManualClock();
  const uploads = [];
  let attempts = 0;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    retryBaseMs: 1000,
    retryMaxMs: 30_000,
    random: () => 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('busy'), { status: 429, retryAfterMs: 5000 });
      if (attempts === 2) throw Object.assign(new Error('denied'), { status: 403 });
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'retry-after' }), /busy/);
  assert.equal(clock.timerCount(), 1);
  await clock.advance(4999);
  assert.deepEqual(uploads, ['retry-after']);
  await clock.advance(1);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(uploads, ['retry-after', 'retry-after']);
  // A 403 is not quickly retryable, so there is no short backoff; the bounded slow
  // retry (15 min by default) keeps the uploader alive instead of wedging it.
  assert.equal(scheduler.getDiagnostics().state, 'waiting');
  assert.equal(clock.timerCount(), 1);
  await clock.advance(5 * 1000);
  assert.deepEqual(uploads, ['retry-after', 'retry-after'], 'the slow cadence must not be a quick retry');

  // Manual retry stays available and delivers immediately.
  await scheduler.retryNow();
  assert.deepEqual(uploads, ['retry-after', 'retry-after', 'retry-after']);
  assert.equal(scheduler.getDiagnostics().state, 'idle');
  scheduler.stop();
});

test('a non-retryable failure does not quick-retry when newer data arrives', async () => {
  const clock = createManualClock();
  const uploads = [];
  let attempts = 0;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('denied'), { status: 403 });
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'first' }), /denied/);
  const queued = await scheduler.enqueue({ id: 'newer' });

  assert.deepEqual(uploads, ['first'], 'arriving data must not trigger an immediate retry');
  assert.equal(queued.queued, true);
  assert.equal(scheduler.getDiagnostics().pendingRevision, 2);
  // A 403 is neither retryable-with-backoff nor a configuration error, so it gets
  // the bounded slow retry rather than stopping the uploader for good.
  assert.equal(scheduler.getDiagnostics().state, 'waiting');
  assert.equal(clock.timerCount(), 1);

  // Let the slow cadence elapse: the pending payload goes out without operator action.
  await clock.advance(16 * 60 * 1000);
  assert.deepEqual(uploads, ['first', 'newer']);
  assert.equal(scheduler.getDiagnostics().failureCode, null);

  scheduler.stop();
});

test('a transient non-retryable response recovers on the slow retry cadence', async () => {
  const clock = createManualClock();
  const uploads = [];
  let attempts = 0;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    terminalRetryMs: 5 * 60 * 1000,
    upload: async (summary) => {
      uploads.push(summary.id);
      attempts += 1;
      // A version-skewed Hub rejecting the body (413) or a proxy injecting a 403.
      if (attempts === 1) throw Object.assign(new Error('payload too large'), { status: 413 });
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'big' }), /too large/);
  assert.deepEqual(uploads, ['big']);
  assert.equal(scheduler.getDiagnostics().state, 'waiting');

  await clock.advance(5 * 60 * 1000);
  assert.deepEqual(uploads, ['big', 'big'], 'the snapshot should be retried automatically');
  assert.equal(scheduler.getDiagnostics().failureCode, null);
  scheduler.stop();
});

test('Hub configuration failures stay blocked until an explicit retry', async () => {
  const clock = createManualClock();
  const uploads = [];
  let attempts = 0;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('Hub is not configured'), { code: 'hub_not_configured' });
    }
  });

  await assert.rejects(scheduler.enqueue({ id: 'blocked' }), /not configured/);
  await scheduler.enqueue({ id: 'newer' });

  assert.deepEqual(uploads, ['blocked']);
  assert.equal(clock.timerCount(), 0);
  assert.equal(scheduler.getDiagnostics().state, 'failed');
  assert.equal(scheduler.getDiagnostics().failureCode, 'hub_not_configured');

  const retried = await scheduler.retryNow();
  assert.equal(retried.ok, true);
  assert.deepEqual(uploads, ['blocked', 'newer']);
  scheduler.stop();
});

test('a failed in-flight upload backs off before retrying the newest pending summary', async () => {
  const uploads = [];
  const clock = createManualClock();
  let rejectActive;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    retryBaseMs: 1000,
    retryMaxMs: 1000,
    random: () => 1,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      if (summary.id === 'failed') {
        await new Promise((_, reject) => {
          rejectActive = () => reject(new Error('offline'));
        });
      }
    }
  });

  const failedUpload = scheduler.enqueue({ id: 'failed' });
  await Promise.resolve();
  await scheduler.enqueue({ id: 'newer' });

  rejectActive();
  await assert.rejects(failedUpload, /offline/);
  assert.equal(clock.timerCount(), 1);

  await clock.advance(999);
  assert.deepEqual(uploads, ['failed']);
  await clock.advance(1);
  await Promise.resolve();

  assert.deepEqual(uploads, ['failed', 'newer']);
  assert.equal(clock.timerCount(), 0);
});

test('Retry-After remains a floor when a newer summary is already pending', async () => {
  const clock = createManualClock();
  const uploads = [];
  let rejectActive;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    retryBaseMs: 1000,
    retryMaxMs: 30_000,
    random: () => 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      if (summary.id === 'failed') {
        await new Promise((_, reject) => { rejectActive = () => reject(Object.assign(new Error('busy'), { status: 429, retryAfterMs: 5000 })); });
      }
    }
  });

  const failed = scheduler.enqueue({ id: 'failed' });
  await Promise.resolve();
  await scheduler.enqueue({ id: 'newer' });
  rejectActive();
  await assert.rejects(failed, /busy/);

  await clock.advance(4999);
  assert.deepEqual(uploads, ['failed']);
  await clock.advance(1);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(uploads, ['failed', 'newer']);
  scheduler.stop();
});

test('flush uploads the pending summary without waiting for the interval', async () => {
  const uploads = [];
  const clock = createManualClock();
  const scheduler = createSyncUploadScheduler({
    intervalMs: 1200000,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => uploads.push(summary.id)
  });

  await scheduler.enqueue({ id: 'initial' });
  await scheduler.enqueue({ id: 'pending' });
  await scheduler.flush();
  await clock.advance(1200000);

  assert.deepEqual(uploads, ['initial', 'pending']);
  assert.equal(clock.timerCount(), 0);
});

test('manual retry aborts a half-open upload without losing its latest summary', async () => {
  const uploads = [];
  const clock = createManualClock();
  let releaseFirst;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary, context) => {
      uploads.push(summary.id);
      if (uploads.length === 1) {
        await new Promise((resolve) => { releaseFirst = resolve; });
        if (context.signal.aborted) throw Object.assign(new Error('aborted'), { code: 'ABORT_ERR' });
      }
    }
  });

  const first = scheduler.enqueue({ id: 'half-open' });
  await Promise.resolve();
  const retry = scheduler.retryNow({ abortActive: true });
  releaseFirst();
  await Promise.all([first, retry]);

  assert.deepEqual(uploads, ['half-open', 'half-open']);
  assert.equal(scheduler.getDiagnostics().pendingRevision, null);
  assert.equal(scheduler.getDiagnostics().failureCode, null);
  scheduler.stop();
});

test('manual retry clears an upload that resolves after abort and replays its summary', async () => {
  const uploads = [];
  const clock = createManualClock();
  let releaseFirst;
  const scheduler = createSyncUploadScheduler({
    intervalMs: 0,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => {
      uploads.push(summary.id);
      if (uploads.length === 1) await new Promise((resolve) => { releaseFirst = resolve; });
      // Deliberately resolve after retryNow() aborts the signal. This models a
      // fetch-compatible transport that cannot cancel its underlying request.
    }
  });

  const first = scheduler.enqueue({ id: 'abort-then-resolve' });
  await Promise.resolve();
  const retry = scheduler.retryNow({ abortActive: true });
  releaseFirst();
  await Promise.all([first, retry]);

  assert.deepEqual(uploads, ['abort-then-resolve', 'abort-then-resolve']);
  assert.equal(scheduler.getDiagnostics().state, 'idle');
  assert.equal(scheduler.getDiagnostics().pendingRevision, null);
  scheduler.stop();
});

test('stop clears a pending interval upload', async () => {
  const uploads = [];
  const clock = createManualClock();
  const scheduler = createSyncUploadScheduler({
    intervalMs: 600000,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    upload: async (summary) => uploads.push(summary.id)
  });

  await scheduler.enqueue({ id: 'initial' });
  await scheduler.enqueue({ id: 'pending' });
  scheduler.stop();
  await clock.advance(600000);

  assert.deepEqual(uploads, ['initial']);
  assert.equal(clock.timerCount(), 0);
});
