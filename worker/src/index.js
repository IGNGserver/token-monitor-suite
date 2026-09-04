import limits from './shared/limits.js';
import subscriptionDisplay from './shared/subscriptionDisplay.js';
import currency from './shared/currency.js';
import usage from './shared/usage.js';
import syncUploadInterval from './shared/syncUploadInterval.js';
import history from './shared/history.js';
import hubBuildIdentity from './shared/hubBuildIdentity.js';
import wireValidation from './shared/wireValidation.js';
import hubAuth from './shared/hubAuth.js';
import hubCapabilitiesContract from './shared/hubCapabilities.js';
import hubRateLimit from './shared/hubRateLimit.js';

const { publicLimits } = limits;
const { aggregateDevices, mergeDeviceRecord, aggregateHistory } = usage;
const { DEFAULT_STALE_AFTER_MS } = syncUploadInterval;
const { deviceHistoryRevision, historyPreview, historyRevision } = history;
const { MAX_JSON_BODY_BYTES, validateDeviceRecordPayload } = wireValidation;
const { ADMIN_SCOPE, INGEST_SCOPE, READ_SCOPE, createHubAuthPolicy } = hubAuth;
const { HUB_API_VERSION, hubCapabilities } = hubCapabilitiesContract;
const { createFixedWindowRateLimiter } = hubRateLimit;
const SSE_WRITE_TIMEOUT_MS = 45 * 1000;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,prefer,x-token-monitor-secret'
};

function jsonResponse(status, payload, extra = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, no-transform', ...CORS_HEADERS, ...extra }
  });
}

function textResponse(status, body, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { 'content-type': contentType, ...CORS_HEADERS } });
}

function payloadTooLargeError() {
  const error = new Error('Request body too large');
  error.code = 'payload_too_large';
  return error;
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw payloadTooLargeError();
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      bytes += chunk.byteLength;
      if (bytes > MAX_JSON_BODY_BYTES) {
        try { await reader.cancel(payloadTooLargeError()); } catch (_) {}
        throw payloadTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(body);
  if (!text.trim()) return {};
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON body: ${error.message}`, { cause: error }); }
}

const SUBSCRIPTIONS_KEY = 'subscriptions';

function sseFormat(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseWriteTimeoutError() {
  const error = new Error('SSE client write timed out');
  error.code = 'sse_write_timeout';
  return error;
}

async function writeSseWithTimeout(writer, chunk, timeoutMs = SSE_WRITE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(sseWriteTimeoutError()), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => writer.write(chunk)),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return textResponse(204, '');
    const id = env.HUB.idFromName('hub');
    const stub = env.HUB.get(id);
    return stub.fetch(request);
  }
};

export class HubDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sseClients = new Set();
    this.sseStates = new Map();
    this.heartbeatTimer = null;
    this.encoder = new TextEncoder();
    this.auth = createHubAuthPolicy({
      adminSecret: env.TOKEN_MONITOR_ADMIN_SECRET,
      viewerSecret: env.TOKEN_MONITOR_VIEWER_SECRET,
      legacySecret: env.TOKEN_MONITOR_SECRET,
      ingestCredentials: env.TOKEN_MONITOR_INGEST_CREDENTIALS,
      allowLegacyAdmin: env.TOKEN_MONITOR_ALLOW_LEGACY_ADMIN,
      allowLegacyIngest: env.TOKEN_MONITOR_ALLOW_LEGACY_INGEST
    });
    this.capabilities = hubCapabilities('cloudflare-worker', { publicStats: this.publicStatsEnabled });
    this.authFailures = createFixedWindowRateLimiter({ limit: Number(env.AUTH_FAILURES_PER_MINUTE || 30), windowMs: 60_000 });
    this.ingestRequests = createFixedWindowRateLimiter({ limit: Number(env.INGEST_REQUESTS_PER_MINUTE || 240), windowMs: 60_000 });
  }

  get staleAfterMs() {
    return Number(this.env.STALE_AFTER_MS || DEFAULT_STALE_AFTER_MS);
  }

  get publicStatsEnabled() {
    return ['1', 'true', 'yes', 'on'].includes(String(this.env.PUBLIC_STATS_ENABLED || '').trim().toLowerCase());
  }

  // Devices live under the `dev:` prefix; the shared subscription document is a
  // single key outside it, so listDevices() never picks it up.
  async getSubscriptions() {
    const stored = await this.state.storage.get(SUBSCRIPTIONS_KEY);
    return stored || subscriptionDisplay.emptySubscriptionDocument();
  }

  async listDevices() {
    const entries = await this.state.storage.list({ prefix: 'dev:' });
    return Array.from(entries.values());
  }

  async getStats() {
    const devices = await this.listDevices();
    const stats = aggregateDevices(devices, this.staleAfterMs);
    stats.staleAfterMs = this.staleAfterMs;
    const history = aggregateHistory(devices);
    stats.historyPreview = historyPreview(history);
    stats.historyRevision = historyRevision(history);
    stats.deviceHistoryRevision = deviceHistoryRevision(devices);
    stats.apiVersion = HUB_API_VERSION;
    stats.capabilities = this.capabilities;
    return stats;
  }

  authorize(request, scope, options = {}) {
    const result = this.auth.authorize(request, scope, options);
    if (result.ok) {
      if (scope === INGEST_SCOPE && options.consumeRateLimit !== false) {
        const limited = this.ingestRequests.take(result.principal.id);
        if (!limited.ok) {
          return jsonResponse(429, { error: 'rate_limited' }, {
            'retry-after': String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000)))
          });
        }
      }
      return result;
    }
    const peer = String(request.headers.get('cf-connecting-ip') || 'unknown');
    const limited = this.authFailures.take(peer);
    if (!limited.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, {
        'retry-after': String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000)))
      });
    }
    return jsonResponse(result.status, { error: result.error });
  }

  audit(principal, action, target = '') {
    console.info(`[hub-audit] ${JSON.stringify({
      at: new Date().toISOString(),
      principal: principal?.id || 'unknown',
      action,
      target: String(target || '')
    })}`);
  }

  // The version of the shared subscription list, never the list itself. A device
  // compares it against the copy it holds and re-reads only when it has been
  // overtaken, so learning about another device's edit costs nothing in the
  // steady state and does not put what the user pays into every frame.
  //
  // Deliberately not folded into getStats(): /api/public/stats is the one
  // unauthenticated route, it is built by spreading whatever getStats() returns,
  // and the money document is the last thing that should be reached for on that
  // path. Adding it here means the public route neither reads it nor has to
  // remember to drop it back out — every caller below is behind the secret.
  async statsWithSubscriptionVersion() {
    const stats = await this.getStats();
    stats.subscriptionsUpdatedAt = (await this.getSubscriptions())?.updatedAt || '';
    return stats;
  }

  ensureHeartbeat() {
    if (this.heartbeatTimer || this.sseClients.size === 0) return;
    this.heartbeatTimer = setInterval(() => {
      const chunk = this.encoder.encode(': hb\n\n');
      for (const writer of this.sseClients) {
        this.enqueueSse(writer, chunk, 'heartbeat');
      }
      if (this.sseClients.size === 0 && this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }, 30000);
  }

  dropClient(writer) {
    this.sseClients.delete(writer);
    const state = this.sseStates.get(writer);
    if (state) {
      state.pending = null;
      state.pendingKind = null;
    }
    this.sseStates.delete(writer);
    try { writer.close(); } catch (_) {}
    if (this.sseClients.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  enqueueSse(writer, chunk, kind = 'data') {
    const state = this.sseStates.get(writer);
    if (!state || !this.sseClients.has(writer)) return false;
    // A slow client gets at most one frame in flight and one latest pending
    // frame. Replacing pending data keeps repeated snapshots from growing an
    // unbounded promise/write queue while preserving the frame already in flight.
    // Heartbeats are disposable. Never let one replace a pending data frame,
    // because that would silently lose the latest stats update for a slow
    // client. Data frames replace either kind of pending frame, while a
    // heartbeat only fills an empty slot or replaces another heartbeat.
    if (!state.pending || kind === 'data' || state.pendingKind !== 'data') {
      state.pending = chunk;
      state.pendingKind = kind;
    }
    if (state.writing) return true;
    state.writing = true;
    void (async () => {
      try {
        while (this.sseClients.has(writer) && state.pending) {
          const next = state.pending;
          state.pending = null;
          state.pendingKind = null;
          await writeSseWithTimeout(writer, next);
        }
      } catch (_) {
        this.dropClient(writer);
      } finally {
        state.writing = false;
        if (!this.sseClients.has(writer)) this.sseStates.delete(writer);
      }
    })();
    return true;
  }

  async broadcast(reason = 'update', statsOverride = null) {
    if (this.sseClients.size === 0) return;
    const stats = statsOverride || await this.statsWithSubscriptionVersion();
    const payload = this.encoder.encode(sseFormat('stats', {
      type: 'stats', reason, stats, at: new Date().toISOString()
    }));
    for (const writer of this.sseClients) {
      this.enqueueSse(writer, payload);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const devices = await this.listDevices();
      return jsonResponse(200, {
        ok: true,
        role: 'hub',
        runtime: 'cloudflare-worker',
        version: 1,
        apiVersion: HUB_API_VERSION,
        capabilities: this.capabilities,
        hubBuild: hubBuildIdentity.currentHubBuild('cloudflare-worker'),
        deviceCount: devices.length,
        secretRequired: this.auth.secretRequired,
        auth: this.auth.summary,
        now: new Date().toISOString()
      });
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/public/stats') {
      if (!this.publicStatsEnabled) return jsonResponse(404, { error: 'not_found' });
      const stats = await this.getStats();
      const { devices, limits, periods, ...rest } = stats;
      delete rest.deviceHistoryRevision;
      return jsonResponse(200, {
        ok: true,
        source: 'cloudflare-worker',
        deviceCount: devices.length,
        limits: publicLimits(limits),
        periods: publicPeriods(periods),
        ...rest
      }, { 'cache-control': 'public, max-age=15, s-maxage=15' });
    }

    // A Worker is an internet-facing URL with no trusted-LAN fallback, so it must
    // never serve data unauthenticated. Without a secret every data route is refused
    // (health and the opt-in, already-scrubbed /api/public/stats are handled above).
    if (!this.auth.configured) {
      return jsonResponse(503, { error: 'secret_required', message: 'At least one Token Monitor Hub credential must be configured; unauthenticated access is refused.' });
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/capabilities') {
      const result = this.authorize(request, READ_SCOPE);
      if (result instanceof Response) return result;
      return jsonResponse(200, {
        apiVersion: HUB_API_VERSION,
        capabilities: this.capabilities,
        role: result.principal.role,
        scopes: result.principal.scopes
      });
    }

    const readRoute = (request.method === 'GET' || request.method === 'HEAD') && [
      '/api/stats', '/api/devices', '/api/history', '/api/subscriptions', '/api/stats/stream'
    ].includes(url.pathname);
    if (readRoute) {
      const result = this.authorize(request, READ_SCOPE);
      if (result instanceof Response) return result;
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/stats') {
      return jsonResponse(200, await this.statsWithSubscriptionVersion());
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/devices') {
      const devices = await this.listDevices();
      return jsonResponse(200, { devices });
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/history') {
      const devices = await this.listDevices();
      return jsonResponse(200, aggregateHistory(devices));
    }

    if (request.method === 'GET' && url.pathname === '/api/stats/stream') {
      const stats = await this.statsWithSubscriptionVersion();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      this.sseClients.add(writer);
      this.sseStates.set(writer, { pending: null, pendingKind: null, writing: false });
      this.enqueueSse(writer, this.encoder.encode(sseFormat('snapshot', {
        type: 'stats', reason: 'snapshot', stats, at: new Date().toISOString()
      })));
      this.ensureHeartbeat();
      request.signal.addEventListener('abort', () => this.dropClient(writer));
      return new Response(readable, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          'connection': 'keep-alive',
          'x-accel-buffering': 'no',
          ...CORS_HEADERS
        }
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/ingest') {
      const initialAuth = this.authorize(request, INGEST_SCOPE);
      if (initialAuth instanceof Response) return initialAuth;
      let payload;
      try { payload = await readJsonBody(request); }
      catch (error) {
        const status = error.code === 'payload_too_large' ? 413 : 400;
        return jsonResponse(status, { error: error.code || 'bad_request', message: error.message });
      }
      if (!payload || (!payload.deviceId && !payload.id)) return jsonResponse(400, { error: 'deviceId_required' });
      const deviceId = String(payload.deviceId || payload.id).trim();
      const boundAuth = this.authorize(request, INGEST_SCOPE, { deviceId, consumeRateLimit: false });
      if (boundAuth instanceof Response) return boundAuth;
      try { validateDeviceRecordPayload(payload); }
      catch (error) {
        return jsonResponse(400, {
          error: error.code || 'bad_request',
          message: error.message,
          ...(error.field ? { field: error.field } : {}),
          ...(error.maxLength ? { maxLength: error.maxLength } : {}),
          ...(error.maxEntries ? { maxEntries: error.maxEntries } : {})
        });
      }
      const existing = await this.state.storage.get(`dev:${deviceId}`);
      const record = mergeDeviceRecord(existing, { ...payload, receivedAt: new Date().toISOString() });
      await this.state.storage.put(`dev:${record.deviceId}`, record);
      const minimalResponse = /(?:^|,)\s*return=minimal\s*(?:,|$)/i.test(String(request.headers.get('prefer') || ''));
      const stats = !minimalResponse || this.sseClients.size > 0
        ? await this.statsWithSubscriptionVersion()
        : null;
      if (this.sseClients.size > 0) this.broadcast('ingest', stats).catch(() => {});
      return jsonResponse(200, {
        ok: true,
        deviceId: record.deviceId,
        ...(!minimalResponse ? { stats } : {})
      });
    }

    // Shared by every device on this hub rather than owned by one of them, and
    // behind the same secret gate as every other data route: this is the one
    // place the user records money. It is never part of /api/public/stats, which
    // is built from device records alone.
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/api/subscriptions') {
      return jsonResponse(200, { ok: true, ...(await this.getSubscriptions()) });
    }

    if (request.method === 'PUT' && url.pathname === '/api/subscriptions') {
      const result = this.authorize(request, ADMIN_SCOPE);
      if (result instanceof Response) return result;
      let payload;
      try { payload = await readJsonBody(request); }
      catch (error) {
        const status = error.code === 'payload_too_large' ? 413 : 400;
        return jsonResponse(status, { error: error.code || 'bad_request', message: error.message });
      }
      // A non-array would normalize to an empty list and store as a perfectly
      // successful replacement, wiping records that exist nowhere else. An
      // intentional clear still sends [].
      if (!Array.isArray(payload?.subscriptions)) {
        return jsonResponse(400, { error: 'bad_request', message: 'subscriptions must be an array' });
      }
      const stored = await this.getSubscriptions();
      // Staleness first, matching the Node hub: a stale write is exactly the case
      // where the client needs the stored document back to re-base, and answering
      // 400 for a request that is both stale and malformed would withhold it.
      if (subscriptionDisplay.isStaleSubscriptionWrite(stored, payload?.baseUpdatedAt)) {
        return jsonResponse(409, { error: 'stale_write', ...stored });
      }
      // A currency with no exchange rate would be coerced to USD and reported as
      // an amount the user never entered.
      const unsupported = payload.subscriptions.find(
        (entry) => entry?.currency && !currency.CURRENCY_CODES.includes(String(entry.currency).trim().toUpperCase())
      );
      if (unsupported) {
        return jsonResponse(400, {
          error: 'bad_request',
          message: `unsupported currency: ${String(unsupported.currency).trim().toUpperCase()}`
        });
      }
      const next = subscriptionDisplay.subscriptionDocument(payload.subscriptions, {
        previousUpdatedAt: stored?.updatedAt,
        currencyApi: { normalizeCurrency: currency.normalizeCurrency }
      });
      await this.state.storage.put(SUBSCRIPTIONS_KEY, next);
      this.audit(result.principal, 'subscriptions.replace');
      // Same reason ingest broadcasts: the other devices are holding a copy that
      // has just been overtaken, and without this they only find out on their
      // next poll — which is five minutes apart while the stream is up.
      this.broadcast('subscriptions').catch(() => {});
      return jsonResponse(200, { ok: true, ...next });
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/devices/') && url.pathname.endsWith('/rename')) {
      const authResult = this.authorize(request, ADMIN_SCOPE);
      if (authResult instanceof Response) return authResult;
      const previousDeviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length, -'/rename'.length));
      let payload;
      try { payload = await readJsonBody(request); }
      catch (error) {
        const status = error.code === 'payload_too_large' ? 413 : 400;
        return jsonResponse(status, { error: error.code || 'bad_request', message: error.message });
      }
      const nextDeviceId = String(payload?.deviceId || '').trim();
      if (!previousDeviceId || !nextDeviceId) return jsonResponse(400, { error: 'device_id_required' });
      try {
        validateDeviceRecordPayload({ deviceId: previousDeviceId });
        validateDeviceRecordPayload({ deviceId: nextDeviceId });
      } catch (error) {
        return jsonResponse(400, { error: error.code || 'bad_request', message: error.message });
      }
      const rename = async (storage) => {
        const sourceKey = `dev:${previousDeviceId}`;
        const targetKey = `dev:${nextDeviceId}`;
        const [source, target] = await Promise.all([storage.get(sourceKey), storage.get(targetKey)]);
        if (!source) return { status: 404, error: 'not_found' };
        if (target) return { status: 409, error: 'target_exists' };
        await storage.put(targetKey, { ...source, deviceId: nextDeviceId, id: nextDeviceId });
        await storage.delete(sourceKey);
        return { status: 200, ok: true };
      };
      const renamed = typeof this.state.storage.transaction === 'function'
        ? await this.state.storage.transaction(rename)
        : await rename(this.state.storage);
      if (!renamed.ok) return jsonResponse(renamed.status, { error: renamed.error });
      this.audit(authResult.principal, 'device.rename', `${previousDeviceId}->${nextDeviceId}`);
      this.broadcast('rename').catch(() => {});
      return jsonResponse(200, { ok: true, previousDeviceId, deviceId: nextDeviceId });
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/devices/')) {
      const result = this.authorize(request, ADMIN_SCOPE);
      if (result instanceof Response) return result;
      const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
      await this.state.storage.delete(`dev:${deviceId}`);
      this.audit(result.principal, 'device.delete', deviceId);
      this.broadcast('delete').catch(() => {});
      return jsonResponse(200, { ok: true, deviceId });
    }

    return jsonResponse(404, { error: 'not_found' });
  }
}

function publicPeriods(periods) {
  return Object.fromEntries(Object.entries(periods || {}).map(([name, period]) => {
    const safePeriod = { ...(period || {}) };
    delete safePeriod.projects;
    return [name, {
      ...safePeriod,
      sessions: Object.fromEntries(Object.entries(period?.sessions || {}).map(([key, session]) => {
      const { projectId, projectLabel, projectPath, ...safe } = session;
      return [key, safe];
      }))
    }];
  }));
}

export { publicPeriods };
