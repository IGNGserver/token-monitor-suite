const STORAGE_SECRET = 'token-monitor.hub.secret';
const STORAGE_SECRET_SESSION = 'token-monitor.hub.secret.session';
const STORAGE_PREFS = 'token-monitor.hub.prefs';

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFS) || '{}') || {};
  } catch {
    return {};
  }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  localStorage.setItem(STORAGE_PREFS, JSON.stringify(next));
  return next;
}

export function loadSecret() {
  return sessionStorage.getItem(STORAGE_SECRET_SESSION)
    || localStorage.getItem(STORAGE_SECRET)
    || '';
}

export function saveSecret(secret, remember) {
  const value = String(secret || '').trim();
  sessionStorage.removeItem(STORAGE_SECRET_SESSION);
  localStorage.removeItem(STORAGE_SECRET);
  if (!value) return;
  if (remember) localStorage.setItem(STORAGE_SECRET, value);
  else sessionStorage.setItem(STORAGE_SECRET_SESSION, value);
}

export function clearSecret() {
  sessionStorage.removeItem(STORAGE_SECRET_SESSION);
  localStorage.removeItem(STORAGE_SECRET);
}

function authHeaders(secret, extra = {}) {
  const headers = { ...extra };
  const value = String(secret || '').trim();
  if (value) headers.authorization = `Bearer ${value}`;
  return headers;
}

export async function fetchHealth() {
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(`health_${res.status}`);
  return res.json();
}

export async function fetchJson(path, { secret, method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    signal,
    cache: 'no-store',
    headers: authHeaders(secret, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  }
  if (!res.ok) {
    let payload = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const detail = payload?.message || payload?.error || '';
    const error = new Error(detail || `http_${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

// A half-open socket leaves reader.read() pending forever, so the UI would keep
// showing stale numbers under a "live" badge. The widget solved this with an idle
// watchdog plus a request deadline; mirror that here.
const SSE_IDLE_TIMEOUT_MS = 90_000;
const SSE_CONNECT_TIMEOUT_MS = 15_000;

export function openStatsStream({ secret, onStats, onStatus, onRetry }) {
  const controller = new AbortController();
  let closed = false;
  let retryTimer = null;
  let retryResolve = null;
  let retryAttempt = 0;
  // Timestamp of the last frame the server sent. Reported so the UI can show how
  // old the displayed data is instead of implying it is current.
  let lastEventAt = null;

  function retryDelay(attempt) {
    return Math.min(30_000, 1_000 * (2 ** Math.min(attempt, 5)));
  }

  /** Abort the current socket after `timeoutMs` without progress. */
  function watchdog(timeoutMs, arm) {
    let timer = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const reset = () => {
      clear();
      if (!closed) timer = setTimeout(() => arm(clear), timeoutMs);
    };
    reset();
    return { reset, clear };
  }

  async function run() {
    while (!closed) {
      onStatus?.(retryAttempt ? 'retrying' : 'connecting');
      try {
        // Bound the handshake too: a proxy that accepts the TCP connection but
        // never responds would otherwise hang here forever with the UI stuck on
        // "connecting".
        const attempt = new AbortController();
        const abortAttempt = () => { try { attempt.abort(); } catch { /* ignore */ } };
        const connectTimer = setTimeout(abortAttempt, SSE_CONNECT_TIMEOUT_MS);
        const onOuterAbort = () => abortAttempt();
        controller.signal.addEventListener('abort', onOuterAbort, { once: true });
        let res;
        try {
          res = await fetch('/api/stats/stream', {
            headers: authHeaders(secret, { accept: 'text/event-stream' }),
            signal: attempt.signal,
            cache: 'no-store'
          });
        } finally {
          clearTimeout(connectTimer);
          controller.signal.removeEventListener('abort', onOuterAbort);
        }
        if (res.status === 401) {
          onStatus?.('unauthorized');
          return;
        }
        if (!res.ok || !res.body) {
          const error = new Error(`stream_${res.status}`);
          error.status = res.status;
          throw error;
        }
        retryAttempt = 0;
        lastEventAt = Date.now();
        // Status is only 'live' once a frame has actually arrived: the old code
        // announced live on the response headers alone.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const idle = watchdog(SSE_IDLE_TIMEOUT_MS, (clear) => {
          clear();
          onStatus?.('idle-timeout', { lastEventAt });
          try { reader.cancel(); } catch { /* already closed */ }
          try { controller.abort(new Error('stream idle timeout')); } catch { /* ignore */ }
        });
        try {
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          idle.reset();
          lastEventAt = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            let event = 'message';
            const dataLines = [];
            for (const line of lines) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            if (!dataLines.length) continue;
            // A heartbeat proves the socket is alive but carries no data, so it
            // must not be mistaken for freshness.
            if (event === 'heartbeat') continue;
            try {
              const payload = JSON.parse(dataLines.join('\n'));
              if (event === 'snapshot' || event === 'stats' || payload?.stats) {
                onStats?.(payload.stats || payload, event, { at: payload.at || null, lastEventAt });
                onStatus?.('live', { lastEventAt });
              }
            } catch {
              /* ignore malformed frames */
            }
          }
        }
        } finally {
          idle.clear();
        }
        if (closed) return;
        onStatus?.('disconnected');
      } catch (error) {
        if (closed || controller.signal.aborted) return;
        onStatus?.(error?.status === 401 ? 'unauthorized' : 'error');
        if (error?.status === 401) return;
      }

      if (closed) return;
      const delay = retryDelay(retryAttempt);
      retryAttempt += 1;
      onRetry?.(delay);
      await new Promise((resolve) => {
        retryResolve = resolve;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          retryResolve = null;
          resolve();
        }, delay);
      });
    }
  }

  run();
  return () => {
    closed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
      retryResolve?.();
      retryResolve = null;
    }
    controller.abort();
  };
}
