'use strict';

const DEFAULT_SYNC_UPLOAD_INTERVAL_MS = 0;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 30 * 1000;
const DEFAULT_FLUSH_TIMEOUT_MS = 15 * 1000;
const NON_RETRYABLE_UPLOAD_CODES = new Set([
  'hub_not_configured',
  'hub_transport_unavailable',
  'insecure_hub_transport'
]);

function normalizeSyncUploadIntervalMs(value, fallback = DEFAULT_SYNC_UPLOAD_INTERVAL_MS) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 * 60 * 60 * 1000) return parsed;
  const fallbackParsed = Number(fallback);
  return Number.isFinite(fallbackParsed) && fallbackParsed >= 0 ? fallbackParsed : DEFAULT_SYNC_UPLOAD_INTERVAL_MS;
}

function positiveMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function statusOf(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  const parsed = Number(status);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function retryAfterMsOf(error, now) {
  const direct = Number(error?.retryAfterMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const header = error?.headers?.get?.('retry-after')
    ?? error?.response?.headers?.get?.('retry-after')
    ?? error?.headers?.['retry-after']
    ?? error?.response?.headers?.['retry-after'];
  if (header === undefined || header === null || header === '') return null;
  const seconds = Number(String(header).trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(String(header));
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function isRetryableUploadFailure(error) {
  const code = String(error?.code || error?.cause?.code || '').trim().toLowerCase();
  if (NON_RETRYABLE_UPLOAD_CODES.has(code)) return false;
  const status = statusOf(error);
  if (status === null) return true; // DNS/refused/timeout/transport errors.
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function failureCodeOf(error, status) {
  if (status !== null) {
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 408) return 'request_timeout';
    if (status === 425) return 'too_early';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'hub_server_error';
    if (status >= 400) return 'hub_client_error';
  }
  const code = String(error?.code || '').trim().toLowerCase();
  if (code === 'aborted' || code === 'abort_err' || code === 'aborterror') return 'aborted';
  if (code === 'request_timeout' || code === 'etimedout' || code === 'timeout') return 'request_timeout';
  return code.replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'upload_failed';
}

function fullJitterDelay(attempt, {
  baseMs = DEFAULT_RETRY_BASE_MS,
  maxMs = DEFAULT_RETRY_MAX_MS,
  random = Math.random,
  retryAfterMs = null
} = {}) {
  const safeAttempt = Math.max(1, Math.floor(Number(attempt) || 1));
  const exponential = Math.min(maxMs, baseMs * (2 ** (safeAttempt - 1)));
  const jittered = Math.floor(Math.max(0, Math.min(1, Number(random()) || 0)) * exponential);
  return Math.max(jittered, Math.min(maxMs, Math.max(0, Number(retryAfterMs) || 0)));
}

// The scheduler owns only one latest snapshot. A failed snapshot stays pending
// until a later snapshot replaces it, a bounded flush delivers it, or the
// scheduler is stopped. This is deliberately independent from file-watch events:
// an upload failure must recover even when no new usage event arrives.
function createSyncUploadScheduler(options = {}) {
  const intervalMs = normalizeSyncUploadIntervalMs(options.intervalMs);
  const now = options.now || Date.now;
  const setTimer = options.setTimer || options.setTimeout || setTimeout;
  const clearTimer = options.clearTimer || options.clearTimeout || clearTimeout;
  const upload = options.upload;
  if (typeof upload !== 'function') throw new TypeError('upload must be a function');
  const random = options.random || Math.random;
  const retryBaseMs = positiveMs(options.retryBaseMs, DEFAULT_RETRY_BASE_MS);
  const retryMaxMs = Math.max(retryBaseMs, positiveMs(options.retryMaxMs, DEFAULT_RETRY_MAX_MS));
  const flushTimeoutMs = positiveMs(options.flushTimeoutMs, DEFAULT_FLUSH_TIMEOUT_MS);

  let stopped = false;
  let generation = 1;
  let sequence = 0;
  let pending = null;
  let active = null;
  let timer = null;
  let lastUploadAt = null;
  let lastAttemptAt = null;
  let lastSuccessAt = null;
  let failureCode = null;
  let failureStatus = null;
  let consecutiveFailures = 0;
  let retryAttempt = 0;
  let nextRetryAt = null;
  let failureRetryable = false;
  let state = 'idle';

  function emitError(error) {
    try { options.onError?.(error); } catch (_) {}
  }

  function clearScheduledTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    nextRetryAt = null;
  }

  function updateState() {
    if (stopped) state = 'stopped';
    else if (active) state = 'uploading';
    else if (timer !== null) state = 'waiting';
    else if (failureCode) state = failureRetryable ? 'backoff' : 'failed';
    else state = 'idle';
  }

  function diagnostics() {
    const at = Number(now());
    return {
      state,
      lastAttemptAt,
      lastSuccessAt,
      failureCode,
      status: failureStatus,
      consecutiveFailures,
      nextRetryAt,
      pendingRevision: pending?.revision ?? null,
      inFlightAgeMs: active ? Math.max(0, at - active.startedAt) : 0
    };
  }

  function schedule(delayMs, reason = 'retry') {
    if (stopped || !pending) return;
    clearScheduledTimer();
    const delay = Math.max(0, Number(delayMs) || 0);
    nextRetryAt = new Date(Number(now()) + delay).toISOString();
    timer = setTimer(() => {
      timer = null;
      nextRetryAt = null;
      if (stopped || !pending || active) {
        updateState();
        return;
      }
      void startUpload(pending, reason).catch(() => {});
    }, delay);
    timer?.unref?.();
    updateState();
  }

  function shouldThrottle() {
    return lastUploadAt !== null && Number(now()) - lastUploadAt < intervalMs;
  }

  function replacePending(summary, revision = null) {
    pending = {
      summary,
      revision: revision ?? ++sequence
    };
    return pending;
  }

  function retryDelayFor(error) {
    retryAttempt += 1;
    return fullJitterDelay(retryAttempt, {
      baseMs: retryBaseMs,
      maxMs: retryMaxMs,
      random,
      retryAfterMs: retryAfterMsOf(error, Number(now()))
    });
  }

  async function startUpload(item, reason = 'enqueue') {
    if (stopped || active || !item) return { skipped: true, reason: stopped ? 'stopped' : 'active' };
    if (pending !== item) return { skipped: true, reason: 'superseded' };
    clearScheduledTimer();
    pending = null;
    const controller = new AbortController();
    const startedAt = Number(now());
    const currentGeneration = generation;
    const attemptAt = new Date(startedAt).toISOString();
    lastAttemptAt = attemptAt;
    active = {
      item,
      controller,
      startedAt,
      generation: currentGeneration,
      promise: null
    };
    updateState();
    let attempt;
    try {
      // Invoke the uploader synchronously after reserving the active slot. This
      // keeps a zero-delay retry observable in the same turn while Promise.resolve
      // still normalizes synchronous return values and throws.
      attempt = Promise.resolve(upload(item.summary, {
        signal: controller.signal,
        revision: item.revision,
        reason,
        attempt: retryAttempt + 1
      }));
    } catch (error) {
      attempt = Promise.reject(error);
    }
    active.promise = attempt;
    try {
      const result = await attempt;
      if (stopped || currentGeneration !== generation || controller.signal.aborted) {
        if (active?.item === item) active = null;
        // An uploader may resolve after an abort instead of rejecting it (some
        // fetch-compatible adapters do exactly that). Treat that outcome like
        // the abort path below: clear the active slot and retain the item for a
        // bounded manual retry when this generation is still alive.
        if (!stopped && currentGeneration === generation && !pending) {
          replacePending(item.summary, item.revision);
        }
        updateState();
        return { ok: false, superseded: true, result };
      }
      // A custom uploader may return a Response rather than throw. Treat a
      // non-2xx response exactly like postToHub's normal error path.
      const responseStatus = Number(result?.status ?? result?.response?.status);
      if (Number.isInteger(responseStatus) && (responseStatus < 200 || responseStatus >= 300)) {
        const error = new Error(`upload returned ${responseStatus}`);
        error.status = responseStatus;
        throw error;
      }
      lastUploadAt = Number(now());
      lastSuccessAt = new Date(lastUploadAt).toISOString();
      failureCode = null;
      failureStatus = null;
      consecutiveFailures = 0;
      retryAttempt = 0;
      failureRetryable = false;
      if (active?.item === item) active = null;
      updateState();
      if (pending) {
        if (intervalMs === 0 || !shouldThrottle()) void startUpload(pending, 'trailing').catch(() => {});
        else schedule(intervalMs - (Number(now()) - lastUploadAt), 'trailing');
      }
      return { ok: true, delivered: true, revision: item.revision, result };
    } catch (error) {
      const superseded = stopped || currentGeneration !== generation || controller.signal.aborted;
      if (active?.item === item) active = null;
      if (superseded) {
        // Manual recovery may abort a half-open request without changing the
        // scheduler generation. Keep the item available so retryNow() can
        // immediately issue a bounded replacement attempt. A stopped or
        // superseded generation must still discard its private snapshot.
        if (!stopped && currentGeneration === generation && !pending) {
          replacePending(item.summary, item.revision);
        }
        updateState();
        return { ok: false, superseded: true, error };
      }
      const status = statusOf(error);
      failureStatus = status;
      failureCode = failureCodeOf(error, status);
      failureRetryable = isRetryableUploadFailure(error);
      consecutiveFailures += 1;
      const hadNewerPending = Boolean(pending);
      if (!pending) replacePending(item.summary, item.revision);
      if (failureRetryable) {
        const delay = retryDelayFor(error);
        // A newer snapshot replaces the pending payload, but never cancels the
        // transport backoff. Otherwise a stream of usage updates can turn one
        // 503/network outage into an unbounded burst of POSTs. Retry-After is
        // already folded into `delay` as a floor; manual retryNow() is the
        // explicit escape hatch for an operator who wants to bypass it.
        schedule(delay, hadNewerPending ? 'retry-latest' : 'retry');
      } else {
        clearScheduledTimer();
        updateState();
      }
      emitError(error);
      throw error;
    }
  }

  function enqueue(summary, revision = null) {
    if (stopped) return Promise.reject(Object.assign(new Error('upload scheduler stopped'), { code: 'scheduler_stopped' }));
    if (!summary || typeof summary !== 'object') return Promise.reject(new TypeError('summary must be an object'));
    const item = replacePending(summary, revision);
    // New data is an explicit supersession boundary, but it must not turn a
    // retryable transport failure into a rapid retry loop. Replace the pending
    // payload while preserving the existing backoff; manual retry/flush remains
    // available when an operator wants to attempt delivery immediately.
    const preserveRetryBackoff = failureRetryable && timer !== null;
    if (timer !== null && !preserveRetryBackoff) clearScheduledTimer();
    if (active) {
      updateState();
      return Promise.resolve({ queued: true, revision: item.revision });
    }
    if (preserveRetryBackoff) {
      updateState();
      return Promise.resolve({ queued: true, revision: item.revision });
    }
    const canStartAutomatically = failureCode === null || failureRetryable;
    if (!canStartAutomatically) {
      updateState();
      return Promise.resolve({ queued: true, revision: item.revision });
    }
    if (canStartAutomatically && (lastUploadAt === null || !shouldThrottle() || failureRetryable)) {
      return startUpload(item, 'enqueue');
    }
    schedule(intervalMs - (Number(now()) - lastUploadAt), 'interval');
    return Promise.resolve({ queued: true, revision: item.revision });
  }

  async function waitForActive(timeoutMs) {
    const current = active;
    if (!current) return { ok: true, active: false };
    const deadline = positiveMs(timeoutMs, flushTimeoutMs);
    let timeout;
    const timedOut = new Promise((resolve) => {
      timeout = setTimer(() => resolve({ ok: false, timedOut: true }), deadline);
    });
    try {
      const result = await Promise.race([
        current.promise.then((value) => ({ ok: true, result: value }), (error) => ({ ok: false, error })),
        timedOut
      ]);
      if (result?.timedOut && active === current) {
        try { current.controller.abort(new Error('flush timeout')); } catch (_) {}
        return result;
      }
      return result;
    } finally {
      clearTimer(timeout);
    }
  }

  async function flushLatest(options = {}) {
    if (stopped) return { ok: false, code: 'scheduler_stopped', diagnostics: diagnostics() };
    clearScheduledTimer();
    const activeResult = await waitForActive(options.timeoutMs);
    if (activeResult?.timedOut) {
      updateState();
      return { ok: false, code: 'flush_timeout', ...activeResult, diagnostics: diagnostics() };
    }
    if (pending && !active) {
      try {
        await startUpload(pending, 'flush');
      } catch (_) {
        return { ok: false, code: failureCode || 'upload_failed', status: failureStatus, diagnostics: diagnostics() };
      }
    }
    return {
      ok: !pending && !active && failureCode === null,
      delivered: !pending && !active && lastSuccessAt !== null,
      lastSuccessAt,
      diagnostics: diagnostics()
    };
  }

  async function retryNow(options = {}) {
    clearScheduledTimer();
    if (active && options.abortActive === true) {
      try { active.controller.abort(new Error('manual retry')); } catch (_) {}
    }
    return flushLatest(options);
  }

  function flush() {
    return flushLatest({ timeoutMs: options.flushTimeoutMs });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    generation += 1;
    clearScheduledTimer();
    if (active) {
      try { active.controller.abort(new Error('scheduler stopped')); } catch (_) {}
    }
    pending = null;
    active = null;
    updateState();
  }

  return {
    enqueue,
    flush,
    flushLatest,
    retryNow,
    stop,
    getDiagnostics: diagnostics
  };
}

module.exports = {
  DEFAULT_RETRY_BASE_MS,
  DEFAULT_RETRY_MAX_MS,
  createSyncUploadScheduler,
  fullJitterDelay,
  isRetryableUploadFailure,
  normalizeSyncUploadIntervalMs
};
