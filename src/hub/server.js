'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { URL } = require('node:url');
const { aggregateDevices, aggregateHistory, mergeDeviceRecord } = require('../shared/usage');
const { normalizeLimitsSummary } = require('../shared/limits');
const { historyPreview, historyRevision } = require('../shared/history');
const { deviceHistoryRevision } = require('../shared/history');
const {
  emptySubscriptionDocument,
  isStaleSubscriptionWrite,
  subscriptionDocument
} = require('../shared/subscriptionDisplay');
const { CURRENCY_CODES, normalizeCurrency } = require('../shared/currency');
const { currentHubBuild } = require('../shared/hubBuildIdentity');
const { readJsonBody, sendJson, sendText } = require('../shared/http');
const {
  ADMIN_SCOPE,
  INGEST_SCOPE,
  READ_SCOPE,
  createHubAuthPolicy
} = require('../shared/hubAuth');
const { HUB_API_VERSION, hubCapabilities } = require('../shared/hubCapabilities');
const { createFixedWindowRateLimiter } = require('../shared/hubRateLimit');
const { validateDeviceRecordPayload } = require('../shared/wireValidation');
const { loadDotEnv, parseArgs } = require('../shared/config');
const { tryServeStatic } = require('./static');
const { lookupModelPricing, normalizePromaPricing } = require('../shared/collector');
const { createMySqlPool, createRepository } = require('./repository');
const { createCatalogPricingLookup, pricingNotFound } = require('./pricing-upstream');
const { calculateUsageEventDeltas, summarizeSessions } = require('./usage-events');
const { createHubAccountService } = require('./accountService');
const { createOAuthSessionManager } = require('./oauthService');
const { createOutboundFetch } = require('../shared/outboundFetch');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const PRICE_FIELDS = [
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cacheReadPricePerMillion',
  'cacheWritePricePerMillion'
];
const SSE_WRITE_TIMEOUT_MS = 45 * 1000;
const RESERVED_DYNAMIC_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function safeDynamicKey(value, fallback = 'unknown') {
  const key = String(value ?? '').trim();
  return key && !RESERVED_DYNAMIC_KEYS.has(key.toLowerCase()) ? key : fallback;
}

function mapNumber(map, key) {
  return hasOwn(map, key) ? number(map[key]) : 0;
}

function errorMessageForApi(error) {
  return String(error?.message || 'request failed')
    .slice(0, 512)
    .replace(/cookie|token|secret|api[_ -]?key|authorization/gi, '[redacted]');
}

function redactViewerAccount(account) {
  const limits = account?.limits;
  const safeLimits = limits && typeof limits === 'object'
    ? (({
      accountId,
      accountKey,
      webAccountKey,
      accountKeyAliases,
      accountEmail,
      accountName,
      accountLabel,
      planLabel,
      ...safe
    }) => safe)(limits)
    : limits;
  return {
    id: account?.id || '',
    provider: account?.provider || '',
    enabled: account?.enabled !== false,
    status: account?.status || 'notConfigured',
    lastErrorCode: account?.lastErrorCode || '',
    lastErrorMessage: account?.lastErrorMessage || '',
    lastAttemptAt: account?.lastAttemptAt || null,
    lastSuccessAt: account?.lastSuccessAt || null,
    nextRefreshAt: account?.nextRefreshAt || null,
    createdAt: account?.createdAt || null,
    updatedAt: account?.updatedAt || null,
    limits: safeLimits
  };
}

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
  const id = safeDynamicKey(key);
  mapTokens[id] = mapNumber(mapTokens, id) + tokens;
  mapCosts[id] = mapNumber(mapCosts, id) + cost;
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
  adminSecret = '',
  viewerSecret = '',
  ingestCredentials = null,
  allowLegacyAdmin = false,
  allowLegacyIngest = false,
  authPolicy = null,
  staleAfterMs = 10 * 60 * 1000,
  sseHeartbeatMs = 30000,
  repository = null,
  pool = null,
  lookupPricing = lookupModelPricing,
  fallbackPricing = createCatalogPricingLookup(),
  webRoot,
  tls = null,
  allowInsecureHttp = false,
  trustProxy = false,
  authFailureLimit = 30,
  ingestRateLimit = 240,
  accountsEnabled = true,
  accountCredentialKey = '',
  accountRefreshMs = 5 * 60 * 1000,
  accountConcurrency = 4,
  accountProbe,
  logger = console
} = {}) {
  const ownedPool = !repository && !pool;
  const activePool = pool || (repository ? null : createMySqlPool());
  const store = repository || createRepository(activePool);
  const unifiedSecret = !String(adminSecret || '').trim() ? secret : '';
  let auth = authPolicy || createHubAuthPolicy({
    unifiedSecret,
    adminSecret,
    viewerSecret,
    legacySecret: secret,
    ingestCredentials,
    allowLegacyAdmin,
    allowLegacyIngest
  });
  const resolvedAccountCredentialKey = String(
    accountCredentialKey
      || process.env.TOKEN_MONITOR_HUB_CREDENTIAL_KEY
      || secret
      || adminSecret
      || ''
  ).trim();
    const outboundFetch = createOutboundFetch(process.env);
    const accountService = accountsEnabled !== false
    && resolvedAccountCredentialKey
    && typeof store.listHubAccounts === 'function'
    ? createHubAccountService({
      store,
      credentialKey: resolvedAccountCredentialKey,
      refreshMs: accountRefreshMs,
      concurrency: accountConcurrency,
      probe: accountProbe,
      oauthFetch: accountProbe ? undefined : outboundFetch,
      logger,
      onUpdate: () => { void broadcastStats('account-update'); }
    })
    : null;
  const oauthManager = createOAuthSessionManager();
  const capabilities = hubCapabilities('node-hub', { hubAccounts: Boolean(accountService) });
  const authFailures = createFixedWindowRateLimiter({ limit: authFailureLimit, windowMs: 60_000 });
  const ingestRequests = createFixedWindowRateLimiter({ limit: ingestRateLimit, windowMs: 60_000 });
  const bindHost = resolveBindHost(host, auth.configured ? 'configured' : '');
  const tlsOptions = loadTlsOptions(tls);
  const protocol = tlsOptions ? 'https' : 'http';
  const insecureHttpAllowed = allowInsecureHttp === true
    || ['1', 'true', 'yes', 'on'].includes(String(allowInsecureHttp || '').trim().toLowerCase());
  const isTrustProxy = trustProxy === true
    || ['1', 'true', 'yes', 'on'].includes(String(process.env.TOKEN_MONITOR_TRUST_PROXY || '').trim().toLowerCase());
  if (!tlsOptions && !LOOPBACK_HOSTS.has(bindHost) && !insecureHttpAllowed) {
    const error = new Error('A non-loopback Hub must use TLS. Set TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1 only for a trusted LAN or VPN.');
    error.code = 'insecure_hub_transport';
    throw error;
  }
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
    const centralLimits = accountService
      ? await accountService.getLimitsSummary()
      : normalizeLimitsSummary({});
    for (const device of stats.devices) delete device.limits;
    stats.limits = centralLimits;
    stats.limitsAuthority = accountService ? 'hub' : 'none';
    stats.staleAfterMs = staleAfterMs;
    const history = aggregateHistory(records);
    stats.historyPreview = historyPreview(history);
    stats.historyRevision = historyRevision(history);
    stats.deviceHistoryRevision = deviceHistoryRevision(records);
    stats.subscriptionsUpdatedAt = (await getSubscriptions()).updatedAt || '';
    stats.apiVersion = HUB_API_VERSION;
    stats.capabilities = capabilities;
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
  const sseHeartbeats = new Map();
  const sseStates = new Map();
  const statsListeners = new Set();

  function sseFormat(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  function dropSseClient(res) {
    sseClients.delete(res);
    const heartbeat = sseHeartbeats.get(res);
    if (heartbeat) clearInterval(heartbeat);
    sseHeartbeats.delete(res);
    const state = sseStates.get(res);
    if (state?.drainTimer) clearTimeout(state.drainTimer);
    if (state?.drainHandler) res.off('drain', state.drainHandler);
    sseStates.delete(res);
    try { res.end(); } catch (_) { /* the socket may already be closed */ }
  }

  function queueLatestSse(state, payload, kind) {
    // Data frames replace either kind of pending frame. Heartbeats are
    // disposable and never replace a pending data snapshot.
    if (!state.pending || kind === 'data' || state.pendingKind !== 'data') {
      state.pending = payload;
      state.pendingKind = kind;
    }
  }

  function writeSse(res, payload, kind = 'data') {
    const state = sseStates.get(res);
    if (!state || !sseClients.has(res)) return false;
    if (state.backpressured) {
      queueLatestSse(state, payload, kind);
      return true;
    }
    try {
      if (res.write(payload)) return true;
    } catch (_) {
      dropSseClient(res);
      return false;
    }
    // `false` means Node reached the writable high-water mark, not that the
    // client is dead. A large but healthy first snapshot commonly crosses it.
    // Wait for drain while keeping only one latest pending frame; only a socket
    // that cannot drain within the bound is removed.
    state.backpressured = true;
    const onDrain = () => {
      if (sseStates.get(res) !== state) return;
      if (state.drainTimer) clearTimeout(state.drainTimer);
      state.drainTimer = null;
      state.drainHandler = null;
      state.backpressured = false;
      const pending = state.pending;
      const pendingKind = state.pendingKind;
      state.pending = null;
      state.pendingKind = null;
      if (pending) writeSse(res, pending, pendingKind);
    };
    state.drainHandler = onDrain;
    res.once('drain', onDrain);
    state.drainTimer = setTimeout(() => dropSseClient(res), SSE_WRITE_TIMEOUT_MS);
    state.drainTimer.unref?.();
    return true;
  }

  async function broadcastStats(reason = 'update', statsOverride = null) {
    if (sseClients.size === 0 && statsListeners.size === 0) return;
    const stats = statsOverride || await getStats();
    const at = new Date().toISOString();
    if (sseClients.size > 0) {
      const payload = sseFormat('stats', { type: 'stats', reason, stats, at });
      for (const res of sseClients) {
        writeSse(res, payload);
      }
    }
    for (const listener of statsListeners) {
      try { listener(stats, reason, at); } catch (_) { /* listener errors must not break ingest */ }
    }
  }

  async function ingest(payload, { includeStats = false } = {}) {
    if (!payload || (!payload.deviceId && !payload.id)) {
      throw new Error('deviceId_required');
    }
    const usagePayload = { ...payload };
    delete usagePayload.limits;
    delete usagePayload.limitsOnly;
    validateDeviceRecordPayload(usagePayload);
    const record = await store.transaction(async (connection) => {
      const deviceId = String(usagePayload.deviceId || usagePayload.id);
      const existing = await store.getDeviceRecord(deviceId, connection);
      const merged = mergeDeviceRecord(existing, { ...usagePayload, receivedAt: new Date().toISOString() });
      merged.limits = normalizeLimitsSummary({});
      const { candidates, events } = calculateUsageEventDeltas(existing, merged);
      const pricingByModel = await store.getPricing(events.map((event) => event.model), connection);
      const pricedEvents = events.map((event) => priceSnapshot(event, pricingByModel.get(event.model)));
      await store.saveDevice(merged, connection);
      await store.insertUsageEvents(merged.deviceId, pricedEvents, connection);
      await store.replaceSessions(merged.deviceId, summarizeSessions(candidates), connection);
      return merged;
    });
    statsCache = null;
    let stats = null;
    if (includeStats || sseClients.size > 0 || statsListeners.size > 0) {
      stats = await getStats();
      await broadcastStats('ingest', stats);
    }
    return includeStats ? { record, stats } : record;
  }

  async function recordAccountAudit(principal, action, accountId = '', details = null) {
    logger.info?.(`[hub-audit] ${principal?.id || 'unknown'} ${action}${accountId ? ` ${accountId}` : ''}`);
    if (typeof store.appendHubAccountAudit !== 'function') return;
    try {
      await store.appendHubAccountAudit(accountId, action, principal?.id || '', details);
    } catch (error) {
      logger.warn?.(`[hub-account-audit] ${error.message}`);
    }
  }

  function accountErrorStatus(error) {
    if (error?.code === 'account_duplicate') return 409;
    if (error?.code === 'account_not_found') return 404;
    if (['provider_unsupported', 'provider_manual_login_unavailable', 'credential_required', 'credential_invalid', 'credential_too_large'].includes(error?.code)) return 400;
    if (['unauthorized', 'notConfigured', 'rateLimited', 'sourceRateLimited'].includes(error?.code)) return 422;
    if (error?.code === 'unavailable') return 502;
    return 400;
  }

  function accountUnavailable(res) {
    return sendJson(res, 503, {
      error: 'hub_accounts_not_configured',
      message: 'Set TOKEN_MONITOR_SECRET and run the Hub account migration first.'
    });
  }

  async function deleteDevice(deviceId) {
    const deleted = await store.transaction((connection) => store.deleteDevice(deviceId, connection));
    statsCache = null;
    await broadcastStats('delete');
    return deleted;
  }

  async function renameDevice(previousDeviceId, nextDeviceId) {
    const result = await store.transaction((connection) => (
      store.renameDevice(previousDeviceId, nextDeviceId, connection)
    ));
    if (result?.renamed) {
      statsCache = null;
      await broadcastStats('rename');
    }
    return result;
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
        apiVersion: HUB_API_VERSION,
        capabilities,
        hubBuild: currentHubBuild('node-hub'),
        deviceCount: await store.countDevices(),
        secretRequired: auth.secretRequired,
        auth: auth.summary,
        now: new Date().toISOString()
      });
    }

    // Web UI / PWA assets share the hub port so Docker only needs one publish.
    // Static files stay unauthenticated; every /api/* route still requires the secret.
    if (await tryServeStatic(req, res, webRoot ? { webRoot } : {})) return;

    const authorize = (scope, options = {}) => {
      const result = auth.authorize(req, scope, options);
      if (result.ok) {
        if (scope === INGEST_SCOPE && options.consumeRateLimit !== false) {
          const limited = ingestRequests.take(result.principal.id);
          if (!limited.ok) {
            sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))) });
            return null;
          }
        }
        return result;
      }
      let peer = String(req.socket?.remoteAddress || 'unknown');
      if (isTrustProxy) {
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
          const clientIp = xForwardedFor.split(',')[0].trim();
          if (clientIp) peer = clientIp;
        } else if (typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip'].trim()) {
          peer = req.headers['x-real-ip'].trim();
        } else if (typeof req.headers['cf-connecting-ip'] === 'string' && req.headers['cf-connecting-ip'].trim()) {
          peer = req.headers['cf-connecting-ip'].trim();
        }
      } else if (typeof req.headers['cf-connecting-ip'] === 'string' && req.headers['cf-connecting-ip'].trim()) {
        peer = req.headers['cf-connecting-ip'].trim();
      }
      const limited = authFailures.take(peer);
      if (!limited.ok) {
        sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.max(1, Math.ceil(limited.retryAfterMs / 1000))) });
        return null;
      }
      sendJson(res, result.status, { error: result.error });
      return null;
    };
    const audit = (principal, action, target = '') => {
      logger.info?.(`[hub-audit] ${JSON.stringify({
        at: new Date().toISOString(),
        principal: principal?.id || 'unknown',
        action,
        target: String(target || '')
      })}`);
    };
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/capabilities') {
      const result = authorize(READ_SCOPE);
      if (!result) return;
      return sendJson(res, 200, {
        apiVersion: HUB_API_VERSION,
        capabilities,
        role: result.principal.role,
        scopes: result.principal.scopes
      });
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/accounts') {
      const result = authorize(READ_SCOPE);
      if (!result) return;
      if (!accountService) return accountUnavailable(res);
      const isAdmin = result.principal.scopes.includes(ADMIN_SCOPE);
      const accounts = await accountService.listAccounts({ includeCredentialMetadata: isAdmin });
      return sendJson(res, 200, {
        ok: true,
        authority: 'hub',
        providers: accountService.supportedProviders(),
        accounts: isAdmin ? accounts : accounts.map(redactViewerAccount)
      });
    }
    const readRoute = (req.method === 'GET' || req.method === 'HEAD') && (
      ['/api/stats', '/api/devices', '/api/history', '/api/subscriptions', '/api/usage/range', '/api/pricing', '/api/stats/stream'].includes(url.pathname)
    );
    if (readRoute && !authorize(READ_SCOPE)) return;

    if (req.method === 'GET' && url.pathname === '/api/stats') return sendJson(res, 200, await getStats());
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      // Keep this endpoint on the same normalized/staleness boundary as
      // /api/stats. Returning raw ingest snapshots here exposes top-level
      // today/month/allTime fields, which the Android DTO intentionally does
      // not consume, and lets an old snapshot masquerade as today's usage.
      const stats = await getStats();
      return sendJson(res, 200, { devices: stats.devices });
    }
    if (req.method === 'GET' && url.pathname === '/api/history') return sendJson(res, 200, await getHistory());
    if (req.method === 'GET' && url.pathname === '/api/subscriptions') {
      return sendJson(res, 200, { ok: true, ...(await getSubscriptions()) });
    }
    if (req.method === 'PUT' && url.pathname === '/api/subscriptions') {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      try {
        const payload = await readJsonBody(req);
        const stored = await setSubscriptions(payload?.subscriptions, payload?.baseUpdatedAt);
        audit(admin.principal, 'subscriptions.replace');
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

    if (req.method === 'POST' && url.pathname === '/api/accounts') {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      if (!accountService) return accountUnavailable(res);
      try {
        const body = await readJsonBody(req);
        const account = await accountService.addAccount({
          provider: body?.provider,
          name: body?.name,
          label: body?.label,
          credential: body?.credential
        });
        await recordAccountAudit(admin.principal, 'account.add', account.id, { provider: account.provider });
        return sendJson(res, 201, { ok: true, account });
      } catch (error) {
        return sendJson(res, accountErrorStatus(error), {
          error: error.code || 'account_add_failed',
          message: errorMessageForApi(error)
        });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/accounts/oauth/start') {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      if (!accountService) return accountUnavailable(res);
      try {
        const body = await readJsonBody(req);
        const provider = String(body?.provider || '').trim().toLowerCase();
        const session = oauthManager.startSession(provider);
        return sendJson(res, 200, { ok: true, ...session });
      } catch (error) {
        return sendJson(res, 400, { error: error.code || 'oauth_start_failed', message: error.message });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/accounts/oauth/exchange') {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      if (!accountService) return accountUnavailable(res);
      try {
        const body = await readJsonBody(req);
        const sessionId = String(body?.sessionId || '').trim();
        const redirectUrl = String(body?.redirectUrl || '').trim();
        const name = String(body?.name || '').trim();
        const label = String(body?.label || '').trim();
        if (!sessionId || !redirectUrl) {
          return sendJson(res, 400, { error: 'invalid_params', message: 'sessionId and redirectUrl are required' });
        }
        const exchanged = await oauthManager.exchangeSession(sessionId, redirectUrl, {
          fetch: accountProbe ? undefined : outboundFetch
        });
        const account = await accountService.addAccount({
          provider: exchanged.provider,
          name: name || `${exchanged.provider}-${Date.now().toString(36)}`,
          label,
          credential: exchanged.credential
        });
        await recordAccountAudit(admin.principal, 'account.add_oauth', account.id, { provider: account.provider });
        return sendJson(res, 201, { ok: true, account });
      } catch (error) {
        return sendJson(res, accountErrorStatus(error), {
          error: error.code || 'oauth_exchange_failed',
          message: errorMessageForApi(error)
        });
      }
    }

    if (url.pathname.startsWith('/api/accounts/')) {
      const suffix = url.pathname.slice('/api/accounts/'.length);
      const refreshSuffix = '/refresh';
      const isRefresh = suffix.endsWith(refreshSuffix);
      const accountId = decodeURIComponent(isRefresh ? suffix.slice(0, -refreshSuffix.length) : suffix);
      if (!accountId) return sendJson(res, 400, { error: 'account_id_required' });
      if (req.method === 'POST' && isRefresh) {
        const admin = authorize(ADMIN_SCOPE);
        if (!admin) return;
        if (!accountService) return accountUnavailable(res);
        try {
          const account = await accountService.refreshAccount(accountId);
          if (!account) return sendJson(res, 404, { error: 'account_not_found' });
          await recordAccountAudit(admin.principal, 'account.refresh', accountId);
          return sendJson(res, 200, { ok: true, account: (await accountService.listAccounts()).find((item) => item.id === accountId) || null });
        } catch (error) {
          return sendJson(res, accountErrorStatus(error), {
            error: error.code || 'account_refresh_failed',
            message: errorMessageForApi(error)
          });
        }
      }
      if (req.method === 'PATCH') {
        const admin = authorize(ADMIN_SCOPE);
        if (!admin) return;
        if (!accountService) return accountUnavailable(res);
        try {
          const body = await readJsonBody(req);
          const account = await accountService.updateAccount(accountId, {
            name: body?.name,
            label: body?.label,
            enabled: body?.enabled,
            credentialMode: body?.credentialMode,
            ...(Object.prototype.hasOwnProperty.call(body || {}, 'credential') ? { credential: body.credential } : {})
          });
          if (!account) return sendJson(res, 404, { error: 'account_not_found' });
          await recordAccountAudit(admin.principal, 'account.update', accountId, {
            provider: account.provider,
            credentialReplaced: Object.prototype.hasOwnProperty.call(body || {}, 'credential')
          });
          return sendJson(res, 200, { ok: true, account });
        } catch (error) {
          return sendJson(res, accountErrorStatus(error), {
            error: error.code || 'account_update_failed',
            message: errorMessageForApi(error)
          });
        }
      }
      if (req.method === 'DELETE') {
        const admin = authorize(ADMIN_SCOPE);
        if (!admin) return;
        if (!accountService) return accountUnavailable(res);
        try {
          const deleted = await accountService.deleteAccount(accountId);
          if (!deleted) return sendJson(res, 404, { error: 'account_not_found' });
          await recordAccountAudit(admin.principal, 'account.delete', accountId);
          return sendJson(res, 200, { ok: true, accountId });
        } catch (error) {
          return sendJson(res, accountErrorStatus(error), {
            error: error.code || 'account_delete_failed',
            message: errorMessageForApi(error)
          });
        }
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/stats/stream') {
      const snapshot = await getStats();
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no'
      });
      sseClients.add(res);
      sseStates.set(res, {
        backpressured: false,
        pending: null,
        pendingKind: null,
        drainHandler: null,
        drainTimer: null
      });
      if (!writeSse(res, sseFormat('snapshot', { type: 'stats', reason: 'snapshot', stats: snapshot, at: new Date().toISOString() }))) return;
      // Heartbeats intentionally do not query MySQL. Slow reads therefore never
      // delay the fixed 30-second SSE keepalive cadence.
      const heartbeat = setInterval(() => { writeSse(res, ': hb\n\n', 'heartbeat'); }, sseHeartbeatMs);
      sseHeartbeats.set(res, heartbeat);
      const cleanup = () => dropSseClient(res);
      req.on('close', cleanup);
      req.on('error', cleanup);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest') {
      if (!authorize(INGEST_SCOPE)) return;
      try {
        const payload = await readJsonBody(req);
        const deviceId = String(payload?.deviceId || payload?.id || '').trim();
        if (!authorize(INGEST_SCOPE, { deviceId, consumeRateLimit: false })) return;
        const minimalResponse = /(?:^|,)\s*return=minimal\s*(?:,|$)/i.test(String(req.headers.prefer || ''));
        const result = await ingest(payload, { includeStats: !minimalResponse });
        if (minimalResponse) return sendJson(res, 200, { ok: true, deviceId: result.deviceId });
        return sendJson(res, 200, { ok: true, deviceId: result.record.deviceId, stats: result.stats });
      } catch (error) {
        if (error.message === 'deviceId_required') return sendJson(res, 400, { error: 'deviceId_required' });
        if (error.code === 'field_too_long' || error.code === 'too_many_entries' || error.code === 'invalid_payload') {
          return sendJson(res, 400, {
            error: error.code,
            message: error.message,
            ...(error.field ? { field: error.field } : {}),
            ...(error.maxLength ? { maxLength: error.maxLength } : {}),
            ...(error.maxEntries ? { maxEntries: error.maxEntries } : {})
          });
        }
        if (error.code === 'payload_too_large') {
          res.shouldKeepAlive = false;
          return sendJson(res, 413, { error: 'payload_too_large', message: error.message }, { connection: 'close' });
        }
        return sendJson(res, 400, { error: 'bad_request', message: error.message });
      }
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/pricing/')) {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      try {
        const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length));
        if (!model) return sendJson(res, 400, { error: 'model_required' });
        const pricing = await setPricing(model, normalizePrices(await readJsonBody(req)));
        audit(admin.principal, 'pricing.replace', model);
        return sendJson(res, 200, { ok: true, pricing });
      } catch (error) {
        return sendJson(res, 400, { error: error.code || 'bad_request', message: error.message });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/pricing/fetch-upstream-all') {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      const results = await fetchAllUpstreamPricing();
      audit(admin.principal, 'pricing.refresh_all');
      return sendJson(res, 200, { results });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/pricing/') && url.pathname.endsWith('/fetch-upstream')) {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      const model = decodeURIComponent(url.pathname.slice('/api/pricing/'.length, -'/fetch-upstream'.length));
      try {
        const pricing = await fetchUpstreamPricing(model);
        audit(admin.principal, 'pricing.refresh', model);
        return sendJson(res, 200, { ok: true, pricing });
      } catch (error) {
        const status = error.code === 'pricing_not_found' || error.code === 'model_required' ? 422 : 502;
        return sendJson(res, status, { error: error.code || 'pricing_lookup_failed', message: error.message });
      }
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/devices/') && url.pathname.endsWith('/rename')) {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      const previousDeviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length, -'/rename'.length));
      try {
        const body = await readJsonBody(req);
        const nextDeviceId = String(body?.deviceId || '').trim();
        if (!previousDeviceId || !nextDeviceId) return sendJson(res, 400, { error: 'device_id_required' });
        validateDeviceRecordPayload({ deviceId: previousDeviceId });
        validateDeviceRecordPayload({ deviceId: nextDeviceId });
        const result = await renameDevice(previousDeviceId, nextDeviceId);
        if (result?.reason === 'not_found' || result?.reason === 'baseline_missing') {
          return sendJson(res, 404, { error: result.reason });
        }
        if (result?.reason === 'target_exists') return sendJson(res, 409, { error: 'target_exists' });
        if (!result?.renamed) return sendJson(res, 400, { error: result?.reason || 'rename_failed' });
        audit(admin.principal, 'device.rename', `${previousDeviceId}->${nextDeviceId}`);
        return sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        if (error.code === 'field_too_long') {
          return sendJson(res, 400, { error: error.code, message: error.message, field: error.field, maxLength: error.maxLength });
        }
        if (error.code === 'payload_too_large') return sendJson(res, 413, { error: error.code, message: error.message });
        return sendJson(res, 400, { error: error.code || 'bad_request', message: error.message });
      }
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/devices/')) {
      const admin = authorize(ADMIN_SCOPE);
      if (!admin) return;
      const deviceId = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
      await deleteDevice(deviceId);
      audit(admin.principal, 'device.delete', deviceId);
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
    if (accountService) await store.listHubAccounts();
    return new Promise((resolve, reject) => {
      const onError = (err) => { server.off('listening', onListening); reject(err); };
      const onListening = () => {
        server.off('error', onError);
        accountService?.start();
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, bindHost);
    });
  }

  async function stop() {
    await accountService?.stop();
    for (const res of [...sseClients]) dropSseClient(res);
    sseClients.clear();
    for (const heartbeat of sseHeartbeats.values()) clearInterval(heartbeat);
    sseHeartbeats.clear();
    sseStates.clear();
    // Drop keep-alive / half-drained sockets so close() cannot hang (e.g. fetch
    // clients that never read a static body, or browsers that linger).
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(() => resolve()));
    if (ownedPool && activePool) await activePool.end();
  }

  function replaceAuthPolicy(nextAuthPolicy) {
    if (!nextAuthPolicy || typeof nextAuthPolicy.authorize !== 'function') {
      throw new TypeError('next Hub auth policy must provide authorize()');
    }
    // Binding safety is decided before listen(). Do not permit a live public
    // server to transition between configured and unauthenticated states.
    if (Boolean(nextAuthPolicy.configured) !== Boolean(auth.configured)) {
      throw new Error('live Hub auth replacement must preserve configured state');
    }
    auth = nextAuthPolicy;
    return auth.summary;
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
    renameDevice,
    deleteDevice,
    onStats,
    setPricing,
    setSubscriptions,
    fetchUpstreamPricing,
    fetchAllUpstreamPricing,
    accountService,
    replaceAuthPolicy,
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
  const adminSecret = String(args.adminSecret || process.env.TOKEN_MONITOR_ADMIN_SECRET || '').trim();
  const viewerSecret = String(args.viewerSecret || process.env.TOKEN_MONITOR_VIEWER_SECRET || '').trim();
  const ingestCredentials = args.ingestCredentials || process.env.TOKEN_MONITOR_INGEST_CREDENTIALS || '';
  const staleAfterMs = Number(args.staleAfterMs || process.env.TOKEN_MONITOR_STALE_AFTER_MS || 10 * 60 * 1000);
  const hub = createHub({
    port,
    host,
    secret,
    adminSecret,
    viewerSecret,
    ingestCredentials,
    allowLegacyAdmin: args.allowLegacyAdmin || process.env.TOKEN_MONITOR_ALLOW_LEGACY_ADMIN,
    allowLegacyIngest: args.allowLegacyIngest || process.env.TOKEN_MONITOR_ALLOW_LEGACY_INGEST,
    accountCredentialKey: args.accountCredentialKey
      || args['account-credential-key']
      || process.env.TOKEN_MONITOR_HUB_CREDENTIAL_KEY
      || '',
    accountRefreshMs: Number(args.accountRefreshMs
      || args['account-refresh-ms']
      || process.env.TOKEN_MONITOR_HUB_REFRESH_MS
      || 5 * 60 * 1000),
    accountConcurrency: Number(args.accountConcurrency
      || args['account-concurrency']
      || process.env.TOKEN_MONITOR_HUB_ACCOUNT_CONCURRENCY
      || 4),
    allowInsecureHttp: args.allowInsecureHttp || args['allow-insecure-http'] || process.env.TOKEN_MONITOR_ALLOW_INSECURE_HTTP,
    trustProxy: args.trustProxy || args['trust-proxy'] || process.env.TOKEN_MONITOR_TRUST_PROXY,
    staleAfterMs
  });
  hub.start()
    .then(() => {
      console.log(`Token Monitor hub listening on ${hub.protocol}://${hub.bindHost}:${port}`);

      // Global uncaught exception and unhandled rejection protection
      process.on('uncaughtException', (err) => {
        console.error(`[hub-fatal] uncaughtException: ${err?.message || err}`);
        if (err?.stack) console.error(err.stack);
      });

      process.on('unhandledRejection', (reason) => {
        console.error(`[hub-warn] unhandledRejection: ${reason?.message || reason}`);
        if (reason?.stack) console.error(reason.stack);
      });

      // Graceful shutdown on SIGTERM / SIGINT
      let shuttingDown = false;
      const gracefulShutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`Received ${signal}, shutting down gracefully...`);
        try {
          await hub.stop();
          console.log('Hub stopped cleanly.');
          process.exit(0);
        } catch (stopErr) {
          console.error(`Error stopping hub: ${stopErr?.message || stopErr}`);
          process.exit(1);
        }
      };

      process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
    })
    .catch((error) => { console.error(`Could not start hub: ${error.message}`); process.exitCode = 1; });
}

module.exports = { createHub, normalizePrices, priceSnapshot, resolveBindHost, loadTlsOptions, upstreamPrices, aggregateHistoryRange, emptyUsageRangePayload };
