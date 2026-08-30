'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { URL } = require('node:url');
const { aggregateDevices, aggregateHistory, mergeDeviceRecord } = require('../shared/usage');
const { historyPreview, historyRevision } = require('../shared/history');
const { deviceHistoryRevision } = require('../shared/history');
const {
  emptySubscriptionDocument,
  isStaleSubscriptionWrite,
  subscriptionDocument
} = require('../shared/subscriptionDisplay');
const { CURRENCY_CODES, normalizeCurrency } = require('../shared/currency');
const { currentHubBuild } = require('../shared/hubBuildIdentity');
const { isAuthorized, readJsonBody, sendJson, sendText } = require('../shared/http');
const { loadDotEnv, parseArgs } = require('../shared/config');
const { tryServeStatic } = require('./static');
const { lookupModelPricing, normalizePromaPricing } = require('../shared/collector');
const { createMySqlPool, createRepository } = require('./repository');
const { createCatalogPricingLookup, pricingNotFound } = require('./pricing-upstream');
const { calculateUsageEventDeltas, summarizeSessions } = require('./usage-events');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const PRICE_FIELDS = [
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cacheReadPricePerMillion',
  'cacheWritePricePerMillion'
];

// Without a secret the hub cannot tell its own widget from any other caller, so it
// must not expose account identity (email/plan/key) to the network. Binding to
// loopback keeps an unauthenticated hub usable locally while refusing LAN/remote
// reach; set a secret to bind a non-loopback address and accept other devices.
function loadTlsOptions(tls) {
  if (tls && tls.key && tls.cert) {
    return {
      key: tls.key,
      cert: tls.cert,
      ca: tls.ca
    };
  }
  const certPath = String(process.env.TOKEN_MONITOR_TLS_CERT || '').trim();
  const keyPath = String(process.env.TOKEN_MONITOR_TLS_KEY || '').trim();
  const caPath = String(process.env.TOKEN_MONITOR_TLS_CA || '').trim();
  if (!certPath && !keyPath) return null;
  if (!certPath || !keyPath) {
    throw new Error('TOKEN_MONITOR_TLS_CERT and TOKEN_MONITOR_TLS_KEY must be set together');
  }
  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };
  if (caPath) options.ca = fs.readFileSync(caPath);
  return options;
}

function resolveBindHost(host, secret) {
  const requested = String(host || '').trim() || '0.0.0.0';
  if (secret) return requested;
  return LOOPBACK_HOSTS.has(requested.toLowerCase()) ? requested : '127.0.0.1';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyUsageRangePayload() {
  return {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    clientModels: {},
    clientModelCosts: {}
  };
}

function addRangeTokenCost(mapTokens, mapCosts, key, tokens, cost) {
  const id = String(key || '').trim() || 'unknown';
  mapTokens[id] = (mapTokens[id] || 0) + tokens;
  mapCosts[id] = (mapCosts[id] || 0) + cost;
}

// Sum tokscale graph daily history for inclusive calendar day keys.
// History dates are local calendar days (YYYY-MM-DD), same family as the day/month
// tabs — never UTC-shift them. Hour precision is intentionally day-rounded so hub
// custom ranges match desktop tokscale --since/--until totals.
function aggregateHistoryRange(history, from, to, options = {}) {
  const result = emptyUsageRangePayload();
  let startDate = String(options.startDate || '').slice(0, 10);
  let endDate = String(options.endDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    // Legacy from/to Instant bounds: map to inclusive local calendar days on the hub host.
    const fromDate = from instanceof Date ? from : new Date(from);
    const toDate = to instanceof Date ? to : new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return result;
    const pad = (n) => String(n).padStart(2, '0');
    const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    startDate = keyOf(fromDate);
    // `to` is exclusive in the ISO API; the last included local day is the calendar
    // day of (to - 1ms), so a full-day [00:00, next-day 00:00) keeps one day key.
    const lastInclusive = new Date(Math.max(fromDate.getTime(), toDate.getTime() - 1));
    endDate = keyOf(lastInclusive);
    if (startDate > endDate) return result;
  }
  result.matchedDays = 0;
  for (const day of history?.daily || []) {
    const dayKey = String(day?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    if (dayKey < startDate || dayKey > endDate) continue;
    result.matchedDays += 1;
    const tokens = Math.round(number(day.tokens));
    const cost = number(day.cost);
    result.totalTokens += tokens;
    result.costUsd += cost;
    for (const [client, value] of Object.entries(day.perClient || {})) {
      addRangeTokenCost(result.clients, result.clientCosts, client, Math.round(number(value?.tokens ?? value)), number(value?.cost));
    }
    for (const [model, value] of Object.entries(day.perModel || {})) {
      addRangeTokenCost(result.models, result.modelCosts, model, Math.round(number(value?.tokens ?? value)), number(value?.cost));
    }
  }
  return result;
}

function parseRangeBound(raw, name) {
  const text = String(raw || '').trim();
  if (!text) {
    const error = new Error(`${name}_required`);
    error.code = 'invalid_range';
    throw error;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${name}_invalid`);
    error.code = 'invalid_range';
    throw error;
  }
  return parsed;
}

function priceSnapshot(event, pricing) {
  if (!pricing) {
    // A missing catalog entry must not turn a known tokscale cost into a false
    // zero. No price exists to snapshot, so the event carries its payload cost
    // and marks the provenance explicitly.
    return {
      ...event,
      priceInputPerMillion: null,
      priceOutputPerMillion: null,
      priceCacheReadPerMillion: null,
      priceCacheWritePerMillion: null,
      pricingSource: 'payload_fallback',
      pricingSnapshotAt: null,
      costUsd: number(event.payloadCostUsd)
    };
  }
  const input = number(pricing.inputPricePerMillion);
  const output = number(pricing.outputPricePerMillion);
  const cacheRead = number(pricing.cacheReadPricePerMillion);
  const cacheWrite = number(pricing.cacheWritePricePerMillion);
  return {
    ...event,
    priceInputPerMillion: input,
    priceOutputPerMillion: output,
    priceCacheReadPerMillion: cacheRead,
    priceCacheWritePerMillion: cacheWrite,
    pricingSource: pricing.source,
    pricingSnapshotAt: pricing.updatedAt,
    costUsd: ((number(event.inputTokens) * input)
      + (number(event.outputTokens) * output)
      + (number(event.cacheReadTokens) * cacheRead)
      + (number(event.cacheWriteTokens) * cacheWrite)) / 1_000_000
  };
}

function normalizePrices(body) {
  const aliases = {
    inputPricePerMillion: ['inputPricePerMillion', 'input_price_per_million'],
    outputPricePerMillion: ['outputPricePerMillion', 'output_price_per_million'],
    cacheReadPricePerMillion: ['cacheReadPricePerMillion', 'cache_read_price_per_million'],
    cacheWritePricePerMillion: ['cacheWritePricePerMillion', 'cache_write_price_per_million']
  };
  const prices = {};
  for (const field of PRICE_FIELDS) {
    const value = aliases[field].map((key) => body?.[key]).find((candidate) => candidate !== undefined);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      const error = new Error(`${field}_must_be_a_non_negative_number`);
      error.code = 'invalid_pricing';
      throw error;
    }
    prices[field] = parsed;
  }
  return prices;
}

function upstreamPrices(result) {
  const pricing = normalizePromaPricing(result);
  if (!pricing) return null;
  return {
    inputPricePerMillion: number(pricing.inputCostPerToken) * 1_000_000,
    outputPricePerMillion: number(pricing.outputCostPerToken) * 1_000_000,
    cacheReadPricePerMillion: number(pricing.cacheReadInputTokenCost) * 1_000_000,
    cacheWritePricePerMillion: number(pricing.cacheCreationInputTokenCost) * 1_000_000
  };
}

function isMissingPricingError(error) {
  return /not found|unknown model|no pricing|unsupported model/i.test(String(error?.message || ''));
}

function createHub({
  port = 17321,
  host = '0.0.0.0',
  secret = '',
  staleAfterMs = 10 * 60 * 1000,
  sseHeartbeatMs = 30000,
  repository = null,
  pool = null,
  lookupPricing = lookupModelPricing,
  fallbackPricing = createCatalogPricingLookup(),
  webRoot,
  tls = null,
  logger = console
} = {}) {
  const ownedPool = !repository && !pool;
  const activePool = pool || (repository ? null : createMySqlPool());
  const store = repository || createRepository(activePool);
  const bindHost = resolveBindHost(host, secret);
  const tlsOptions = loadTlsOptions(tls);
  const protocol = tlsOptions ? 'https' : 'http';
  let statsCache = null;
  let subscriptionsCache = emptySubscriptionDocument();

  async function getSubscriptions() {
    if (typeof store.getSubscriptions === 'function') {
      subscriptionsCache = await store.getSubscriptions();
    }
    return subscriptionsCache;
  }

  async function getStats() {
    const records = await store.listDeviceRecords();
    const stats = aggregateDevices(records, staleAfterMs);
    stats.staleAfterMs = staleAfterMs;
    const history = aggregateHistory(records);
    stats.historyPreview = historyPreview(history);
    stats.historyRevision = historyRevision(history);
    stats.deviceHistoryRevision = deviceHistoryRevision(records);
    stats.subscriptionsUpdatedAt = (await getSubscriptions()).updatedAt || '';
    statsCache = stats;
    return stats;
  }

  async function getHistory() {
    return aggregateHistory(await store.listDeviceRecords());
  }

  async function setSubscriptions(subscriptions, baseUpdatedAt) {
    if (!Array.isArray(subscriptions)) {
      const error = new Error('subscriptions must be an array');
      error.code = 'bad_subscriptions';
      throw error;
    }
    const current = await getSubscriptions();
    if (isStaleSubscriptionWrite(current, baseUpdatedAt)) {
      const error = new Error('stale_write');
      error.code = 'stale_write';
      error.current = current;
      throw error;
    }
    const unsupported = subscriptions.find(
      (entry) => entry?.currency && !CURRENCY_CODES.includes(String(entry.currency).trim().toUpperCase())
    );
    if (unsupported) {
      const error = new Error(`unsupported currency: ${String(unsupported.currency).trim().toUpperCase()}`);
      error.code = 'bad_subscriptions';
      throw error;
    }
    const next = subscriptionDocument(subscriptions, {
      previousUpdatedAt: current.updatedAt,
      currencyApi: { normalizeCurrency }
    });
    if (typeof store.setSubscriptions === 'function') {
      await store.setSubscriptions(next, current.updatedAt);
    }
    subscriptionsCache = next;
    await broadcastStats('subscriptions');
    return subscriptionsCache;
  }

  function localDayKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function localMonthKey(date = new Date()) {
    return localDayKey(date).slice(0, 7);
  }

  function periodToUsageRangePayload(period) {
    return {
      totalTokens: Math.round(number(period?.totalTokens)),
      costUsd: number(period?.costUsd),
      clients: { ...(period?.clients || {}) },
      clientCosts: { ...(period?.clientCosts || {}) },
      models: { ...(period?.models || {}) },
      modelCosts: { ...(period?.modelCosts || {}) },
      clientModels: period?.clientModels && typeof period.clientModels === 'object' ? period.clientModels : {},
      clientModelCosts: period?.clientModelCosts && typeof period.clientModelCosts === 'object' ? period.clientModelCosts : {}
    };
  }

  async function liveUsageRangeFromDevices(range) {
    const empty = { ...emptyUsageRangePayload(), source: 'live_periods' };
    if (!range?.ok) return empty;
    const todayKey = localDayKey();
    const monthKey = localMonthKey();
    let periodName = null;
    let source = 'live_periods';
    if (range.isSameDay && range.startDate === todayKey) {
      periodName = 'today';
      source = 'live_today';
    } else if (
      range.coversFullDays
      && String(range.startDate || '').startsWith(`${monthKey}-`)
      && String(range.endDate || '').startsWith(`${monthKey}-`)
      && String(range.startDate || '').slice(8) === '01'
      && String(range.endDate || '') === todayKey
    ) {
      // Full-day span from the first of this month through today ≈ live month window.
      periodName = 'month';
      source = 'live_month';
    }
    if (!periodName) return empty;
    const stats = await getStats();
    const period = stats?.periods?.[periodName];
    if (!period || number(period.totalTokens) <= 0) return empty;
    return { ...periodToUsageRangePayload(period), source };
  }
  async function getUsageRange(query = {}) {
    const params = query && typeof query === 'object' && !Array.isArray(query)
      ? query
      : {};
    const { normalizeCustomRange } = require('../shared/customRange');
    let range;
    let from;
    let to;

    if (params.startDate || params.endDate || params.since || params.until) {
      range = normalizeCustomRange({
        startDate: params.startDate || params.since,
        endDate: params.endDate || params.until,
        startHour: params.startHour ?? 0,
        endHour: params.endHour ?? 23
      });
      if (!range.ok) {
        const error = new Error(range.error || 'invalid_range');
        error.code = 'invalid_range';
        throw error;
      }
      from = new Date(range.startMs);
      to = new Date(range.endMs + 1);
    } else {
      from = parseRangeBound(params.from, 'from');
      to = parseRangeBound(params.to, 'to');
      if (!(from.getTime() < to.getTime())) {
        const error = new Error('from_must_be_before_to');
        error.code = 'invalid_range';
        throw error;
      }
      const pad = (n) => String(n).padStart(2, '0');
      const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const startDate = keyOf(from);
      const lastInclusive = new Date(Math.max(from.getTime(), to.getTime() - 1));
      const endDate = keyOf(lastInclusive);
      range = normalizeCustomRange({
        startDate,
        endDate,
        startHour: 0,
        endHour: 23
      });
      if (!range.ok) {
        const error = new Error(range.error || 'invalid_range');
        error.code = 'invalid_range';
        throw error;
      }
    }

    // Prefer tokscale graph daily history (same scan family as day/month tabs and
    // Home trends). usage_events attribute deltas by lastUsedAt and can dump
    // all-time counters into recent windows on first ingest / counter reset.
    const historyAgg = aggregateHistoryRange(await getHistory(), from, to, {
      startDate: range.startDate,
      endDate: range.endDate
    });
    if (number(historyAgg.matchedDays) > 0 || number(historyAgg.totalTokens) > 0) {
      const { matchedDays, ...payload } = historyAgg;
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        startDate: range.startDate,
        endDate: range.endDate,
        startHour: range.startHour,
        endHour: range.endHour,
        source: 'history_daily',
        ...payload
      };
    }

    const eventsAgg = typeof store.aggregateUsageRange === 'function'
      ? await store.aggregateUsageRange({ from, to })
      : { ...emptyUsageRangePayload(), eventCount: 0 };
    if (number(eventsAgg.eventCount) > 0) {
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        startDate: range.startDate,
        endDate: range.endDate,
        startHour: range.startHour,
        endHour: range.endHour,
        source: 'usage_events',
        totalTokens: Math.round(number(eventsAgg.totalTokens)),
        costUsd: number(eventsAgg.costUsd),
        clients: eventsAgg.clients || {},
        clientCosts: eventsAgg.clientCosts || {},
        models: eventsAgg.models || {},
        modelCosts: eventsAgg.modelCosts || {},
        clientModels: eventsAgg.clientModels || {},
        clientModelCosts: eventsAgg.clientModelCosts || {}
      };
    }

    // Graph history and usage_events can both be empty while live device
    // snapshots still have today/month totals (cold start, history disabled,
    // or first ingest). Reuse those periods for matching full-day windows so
    // custom-range surfaces do not go blank while Day/Month tabs still work.
    const live = await liveUsageRangeFromDevices(range);
    if (number(live.totalTokens) > 0) {
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        startDate: range.startDate,
        endDate: range.endDate,
        startHour: range.startHour,
        endHour: range.endHour,
        source: live.source,
        totalTokens: live.totalTokens,
        costUsd: live.costUsd,
        clients: live.clients,
        clientCosts: live.clientCosts,
        models: live.models,
        modelCosts: live.modelCosts,
        clientModels: live.clientModels,
        clientModelCosts: live.clientModelCosts
      };
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      startDate: range.startDate,
      endDate: range.endDate,
      startHour: range.startHour,
      endHour: range.endHour,
      source: 'history_daily',
      ...emptyUsageRangePayload()
    };
  }

  const sseClients = new Set();
  const statsListeners = new Set();

  function sseFormat(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  async function broadcastStats(reason = 'update') {
    if (sseClients.size === 0 && statsListeners.size === 0) return;
    const stats = await getStats();
    const at = new Date().toISOString();
    if (sseClients.size > 0) {
      const payload = sseFormat('stats', { type: 'stats', reason, stats, at });
      for (const res of sseClients) {
        try { res.write(payload); } catch (_) { sseClients.delete(res); }
      }
    }
    for (const listener of statsListeners) {
      try { listener(stats, reason, at); } catch (_) { /* listener errors must not break ingest */ }
    }
  }

  async function ingest(payload) {
    if (!payload || (!payload.deviceId && !payload.id)) {
      throw new Error('deviceId_required');
    }
    const record = await store.transaction(async (connection) => {
      const deviceId = String(payload.deviceId || payload.id);
      const existing = await store.getDeviceRecord(deviceId, connection);
      const merged = mergeDeviceRecord(existing, { ...payload, receivedAt: new Date().toISOString() });
      const { candidates, events } = calculateUsageEventDeltas(existing, merged);
      const pricingByModel = await store.getPricing(events.map((event) => event.model), connection);
      const pricedEvents = events.map((event) => priceSnapshot(event, pricingByModel.get(event.model)));
      await store.saveDevice(merged, connection);
      await store.insertUsageEvents(merged.deviceId, pricedEvents, connection);
      await store.replaceSessions(merged.deviceId, summarizeSessions(candidates), connection);
      return merged;
    });
    statsCache = null;
    await broadcastStats('ingest');
    return record;
  }

  async function deleteDevice(deviceId) {
    const deleted = await store.transaction((connection) => store.deleteDevice(deviceId, connection));
    statsCache = null;
    await broadcastStats('delete');
    return deleted;
  }

  async function setPricing(model, prices, source = 'manual') {
    const item = await store.upsertPricing(model, prices, source);
    return item;
  }

  async function fetchUpstreamPricing(model) {
    const modelId = String(model || '').trim();
    if (!modelId) {
      const error = new Error('model_required');
      error.code = 'model_required';
      throw error;
    }
    let result;
    let primaryError = null;
    try {
      result = await lookupPricing(modelId);
    } catch (error) {
      primaryError = error;
    }
    let prices = upstreamPrices(result);
    if (!prices) {
      try {
        // tokscale itself reads this public model catalog. Keep its CLI as the
        // primary source, but survive hosts where raw.githubusercontent.com is
        // blocked while models.dev remains reachable.
        prices = upstreamPrices(await fallbackPricing(modelId));
      } catch (fallbackError) {
        if (fallbackError.code === 'pricing_not_found' || isMissingPricingError(fallbackError)) {
          throw pricingNotFound(modelId);
        }
        const error = new Error(`Could not retrieve upstream pricing for ${modelId}: ${primaryError?.message || fallbackError.message}`);
        error.code = 'pricing_lookup_failed';
        throw error;
      }
    }
    if (!prices) {
      throw pricingNotFound(modelId);
    }
    return setPricing(modelId, prices, 'tokscale_upstream');
  }

  async function fetchAllUpstreamPricing() {
    const models = await store.listKnownModels();
    const results = [];
    for (const model of models) {
      try {
        results.push({ model, ok: true, pricing: await fetchUpstreamPricing(model) });
      } catch (error) {
        results.push({ model, ok: false, error: error.code || 'pricing_lookup_failed', message: error.message });
      }
    }
    return results;
  }

  function onStats(listener) {
    statsListeners.add(listener);
    return () => statsListeners.delete(listener);
  }

  async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') return sendText(res, 204, '');
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        role: 'hub',
        runtime: 'node-hub',
        version: 1,
        hubBuild: currentHubBuild('node-hub'),
        deviceCount: await store.countDevices(),
        secretRequired: Boolean(secret),
        now: new Date().toISOString()
      });
    }

    // Web UI / PWA assets share the hub port so Docker only needs one publish.
    // Static files stay unauthenticated; every /api/* route still requires the secret.
    if (await tryServeStatic(req, res, webRoot ? { webRoot } : {})) return;

    if (!isAuthorized(req, secret)) return sendJson(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && url.pathname === '/api/stats') return sendJson(res, 200, await getStats());
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      // Mobile clients consume the normalized `periods` shape. Returning raw
      // ingest snapshots here exposes top-level today/month/allTime fields and
      // makes them silently render zero usage.
      return sendJson(res, 200, { devices: (await getStats()).devices });
    }
    if (req.method === 'GET' && url.pathname === '/api/history') return sendJson(res, 200, await getHistory());
    if (req.method === 'GET' && url.pathname === '/api/subscriptions') {
      return sendJson(res, 200, { ok: true, ...(await getSubscriptions()) });
    }
    if (req.method === 'PUT' && url.pathname === '/api/subscriptions') {
      try {
        const payload = await readJsonBody(req);
        const stored = await setSubscriptions(payload?.subscriptions, payload?.baseUpdatedAt);
        return sendJson(res, 200, { ok: true, ...stored });
      } catch (error) {
        if (error.code === 'stale_write') return sendJson(res, 409, { error: 'stale_write', ...error.current });
        if (error.code === 'bad_subscriptions') return sendJson(res, 400, { error: 'bad_request', message: error.message });
        if (error.code === 'payload_too_large') {
          res.shouldKeepAlive = false;
          return sendJson(res, 413, { error: 'payload_too_large', message: error.message }, { connection: 'close' });
        }
        return sendJson(res, 400, { error: 'bad_request', message: error.message });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/usage/range') {
      try {
        return sendJson(res, 200, await getUsageRange({
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
          startDate: url.searchParams.get('startDate') || url.searchParams.get('since'),
          endDate: url.searchParams.get('endDate') || url.searchParams.get('until'),
          startHour: url.searchParams.get('startHour'),
          endHour: url.searchParams.get('endHour')
        }));
      } catch (error) {
        const status = error.code === 'invalid_range' ? 400 : 500;
        return sendJson(res, status, { error: error.code || 'bad_request', message: error.message });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/pricing') return sendJson(res, 200, { pricing: await store.listPricing() });

    if (req.method === 'GET' && url.pathname === '/api/stats/stream') {
      const snapshot = await getStats();
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no'
      });
      res.write(sseFormat('snapshot', { type: 'stats', reason: 'snapshot', stats: snapshot, at: new Date().toISOString() }));
      sseClients.add(res);
      // Heartbeats intentionally do not query MySQL. Slow reads therefore never
      // delay the fixed 30-second SSE keepalive cadence.
      const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch (_) {} }, sseHeartbeatMs);
      const cleanup = () => { clearInterval(heartbeat); sseClients.delete(res); };
      req.on('close', cleanup);
      req.on('error', cleanup);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest') {
      try {
        const payload = await readJsonBody(req);
        const record = await ingest(payload);
        return sendJson(res, 200, { ok: true, deviceId: record.deviceId, stats: await getStats() });
      } catch (error) {
        if (error.message === 'deviceId_required') return sendJson(res, 400, { error: 'deviceId_required' });
        if (error.code === 'payload_too_large') {
          res.shouldKeepAlive = false;
          return sendJson(res, 413, { error: 'payload_too_large', message: error.message }, { connection: 'close' });
        }
        return sendJson(res, 400, { error: 'bad_request', message: error.message });
      }
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/pricing/')) {
      try {
        const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length));
        if (!model) return sendJson(res, 400, { error: 'model_required' });
        const pricing = await setPricing(model, normalizePrices(await readJsonBody(req)));
        return sendJson(res, 200, { ok: true, pricing });
      } catch (error) {
        return sendJson(res, 400, { error: error.code || 'bad_request', message: error.message });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/pricing/fetch-upstream-all') {
      return sendJson(res, 200, { results: await fetchAllUpstreamPricing() });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/pricing/') && url.pathname.endsWith('/fetch-upstream')) {
      const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length, -'/fetch-upstream'.length));
      try {
        return sendJson(res, 200, { ok: true, pricing: await fetchUpstreamPricing(model) });
      } catch (error) {
        const status = error.code === 'pricing_not_found' || error.code === 'model_required' ? 422 : 502;
        return sendJson(res, status, { error: error.code || 'pricing_lookup_failed', message: error.message });
      }
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/devices/')) {
      const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
      await deleteDevice(deviceId);
      return sendJson(res, 200, { ok: true, deviceId });
    }

    return sendJson(res, 404, { error: 'not_found' });
  }

  const requestListener = (req, res) => {
    handleRequest(req, res).catch((error) => {
      (logger.error || console.error)(error);
      sendJson(res, 500, { error: 'internal_error', message: error.message });
    });
  };
  const server = tlsOptions
    ? https.createServer(tlsOptions, requestListener)
    : http.createServer(requestListener);

  async function start() {
    // Fail before opening the listening socket when migrations have not run or
    // MySQL credentials are unusable. The Docker entrypoint runs migrations first.
    await store.countDevices();
    return new Promise((resolve, reject) => {
      const onError = (err) => { server.off('listening', onListening); reject(err); };
      const onListening = () => { server.off('error', onError); resolve(); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, bindHost);
    });
  }

  async function stop() {
    for (const res of sseClients) { try { res.end(); } catch (_) {} }
    sseClients.clear();
    // Drop keep-alive / half-drained sockets so close() cannot hang (e.g. fetch
    // clients that never read a static body, or browsers that linger).
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(() => resolve()));
    if (ownedPool && activePool) await activePool.end();
  }

  return {
    start,
    stop,
    server,
    getStats,
    getHistory,
    getSubscriptions,
    getUsageRange,
    ingest,
    deleteDevice,
    onStats,
    setPricing,
    setSubscriptions,
    fetchUpstreamPricing,
    fetchAllUpstreamPricing,
    bindHost,
    protocol,
    getCachedStats: () => statsCache
  };
}

if (require.main === module) {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.TOKEN_MONITOR_PORT || 17321);
  const host = String(args.host || process.env.TOKEN_MONITOR_HOST || '0.0.0.0');
  const secret = String(args.secret || process.env.TOKEN_MONITOR_SECRET || '').trim();
  const staleAfterMs = Number(args.staleAfterMs || process.env.TOKEN_MONITOR_STALE_AFTER_MS || 10 * 60 * 1000);
  const hub = createHub({ port, host, secret, staleAfterMs });
  hub.start()
    .then(() => console.log(`Token Monitor hub listening on ${hub.protocol}://${hub.bindHost}:${port}`))
    .catch((error) => { console.error(`Could not start hub: ${error.message}`); process.exitCode = 1; });
}

module.exports = { createHub, normalizePrices, priceSnapshot, resolveBindHost, loadTlsOptions, upstreamPrices, aggregateHistoryRange, emptyUsageRangePayload };
