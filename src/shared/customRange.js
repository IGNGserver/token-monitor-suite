'use strict';

const {
  emptyPeriod,
  normalizeClientName,
  normalizeModelNameForClient,
  projectRollupFromSessions
} = require('./usage');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function clampHour(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

function parseDateParts(value) {
  const match = DATE_RE.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return { year, month, day, key: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function localDateTimeMs(dateKey, hour, endOfHour = false) {
  const parts = parseDateParts(dateKey);
  if (!parts) return NaN;
  const h = clampHour(hour);
  if (endOfHour) return new Date(parts.year, parts.month - 1, parts.day, h, 59, 59, 999).getTime();
  return new Date(parts.year, parts.month - 1, parts.day, h, 0, 0, 0).getTime();
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function mapNumber(map, key) {
  return hasOwn(map, key) ? Number(map[key]) || 0 : 0;
}

function compareDateHour(aDate, aHour, bDate, bHour) {
  if (aDate < bDate) return -1;
  if (aDate > bDate) return 1;
  return clampHour(aHour) - clampHour(bHour);
}

function normalizeCustomRange(input = {}) {
  const startParts = parseDateParts(input.startDate || input.fromDate || input.since);
  const endParts = parseDateParts(input.endDate || input.toDate || input.until) || startParts;
  if (!startParts || !endParts) {
    return { ok: false, error: 'invalid-date' };
  }
  const startDate = startParts.key;
  const endDate = endParts.key;
  const startHour = clampHour(input.startHour ?? input.fromHour ?? 0);
  const endHour = clampHour(input.endHour ?? input.toHour ?? 23);
  if (compareDateHour(startDate, startHour, endDate, endHour) > 0) {
    return { ok: false, error: 'inverted-range' };
  }
  const startMs = localDateTimeMs(startDate, startHour, false);
  const endMs = localDateTimeMs(endDate, endHour, true);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return { ok: false, error: 'invalid-range' };
  }
  return {
    ok: true,
    startDate,
    endDate,
    startHour,
    endHour,
    startMs,
    endMs,
    since: startDate,
    until: endDate,
    isSameDay: startDate === endDate,
    coversFullDays: startHour === 0 && endHour === 23
  };
}

function sessionOverlapsRange(session, startMs, endMs) {
  const started = timestampMs(session?.startedAt);
  const lastUsed = timestampMs(session?.lastUsedAt);
  if (!started && !lastUsed) return null;
  const left = started || lastUsed;
  const right = lastUsed || started;
  return left <= endMs && right >= startMs;
}

function addSessionIntoPeriod(period, session) {
  const client = normalizeClientName(session?.client);
  const sessionId = String(session?.sessionId || '').trim();
  if (!client || !sessionId) return;
  const normalizedSession = client === session.client && sessionId === session.sessionId
    ? session
    : { ...session, client, sessionId };
  const key = `${client}:${sessionId}`;
  period.sessions[key] = normalizedSession;
  const tokens = Math.max(0, Math.round(Number(session.totalTokens) || 0));
  const cost = Number(session.costUsd) || 0;
  const cacheRead = Math.max(0, Math.round(Number(session.cacheReadTokens) || 0));
  const cacheWrite = Math.max(0, Math.round(Number(session.cacheWriteTokens) || 0));
  const output = Math.max(0, Math.round(Number(session.outputTokens) || 0));
  period.totalTokens += tokens;
  period.costUsd += cost;
  period.cacheReadTokens += cacheRead;
  period.cacheWriteTokens += cacheWrite;
  period.outputTokens += output;
  if (tokens > 0) {
    period.clients[client] = mapNumber(period.clients, client) + tokens;
    if (cacheRead > 0) period.clientCacheReads[client] = mapNumber(period.clientCacheReads, client) + cacheRead;
    if (cacheWrite > 0) period.clientCacheWrites[client] = mapNumber(period.clientCacheWrites, client) + cacheWrite;
    if (output > 0) period.clientOutputs[client] = mapNumber(period.clientOutputs, client) + output;
  }
  if (cost > 0) period.clientCosts[client] = mapNumber(period.clientCosts, client) + cost;
  for (const [model, modelTokens] of Object.entries(session.models || {})) {
    const modelKey = normalizeModelNameForClient(model, client);
    if (!modelKey) continue;
    const t = Math.max(0, Math.round(Number(modelTokens) || 0));
    if (!t) continue;
    period.models[modelKey] = mapNumber(period.models, modelKey) + t;
    if (!hasOwn(period.clientModels, client) || !period.clientModels[client] || typeof period.clientModels[client] !== 'object') {
      period.clientModels[client] = {};
    }
    period.clientModels[client][modelKey] = mapNumber(period.clientModels[client], modelKey) + t;
  }
  for (const [model, modelCost] of Object.entries(session.modelCosts || {})) {
    const modelKey = normalizeModelNameForClient(model, client);
    if (!modelKey) continue;
    const c = Number(modelCost) || 0;
    if (!c) continue;
    period.modelCosts[modelKey] = mapNumber(period.modelCosts, modelKey) + c;
    if (!hasOwn(period.clientModelCosts, client) || !period.clientModelCosts[client] || typeof period.clientModelCosts[client] !== 'object') {
      period.clientModelCosts[client] = {};
    }
    period.clientModelCosts[client][modelKey] = mapNumber(period.clientModelCosts[client], modelKey) + c;
  }
}

function periodFromSessions(sessions, options = {}) {
  const period = emptyPeriod();
  for (const session of Object.values(sessions || {})) {
    addSessionIntoPeriod(period, session);
  }
  period.projects = options.projectsEnabled === false
    ? Object.create(null)
    : projectRollupFromSessions(period.sessions);
  return period;
}

function filterSessionsByCustomRange(sessions, range) {
  const kept = Object.create(null);
  let missingTimestamp = 0;
  let sourceSessions = 0;
  for (const [key, session] of Object.entries(sessions || {})) {
    sourceSessions += 1;
    const overlap = sessionOverlapsRange(session, range.startMs, range.endMs);
    if (overlap === null) {
      missingTimestamp += 1;
      // Keep undated sessions when we only have day-level tokscale totals; dropping
      // them made multi-day custom ranges undercount vs the month/day tabs.
      kept[key] = session;
      continue;
    }
    if (overlap) kept[key] = session;
  }
  return {
    sessions: kept,
    meta: {
      sourceSessions,
      keptSessions: Object.keys(kept).length,
      missingTimestamp
    }
  };
}

function withProjects(period, options = {}) {
  if (!period || typeof period !== 'object') return emptyPeriod();
  const projects = options.projectsEnabled === false
    ? Object.create(null)
    : (period.projects && Object.keys(period.projects).length
      ? period.projects
      : projectRollupFromSessions(period.sessions || {}));
  return { ...period, projects };
}

// Custom-range totals must match the day/month tabs: trust tokscale's
// --since/--until (or hub history daily) aggregates. Session timestamps are only
// used to narrow the session list for display, never to rebuild totals — many
// clients lack reliable startedAt/lastUsedAt and that path undercounted badly.
function filterPeriodByCustomRange(period, rangeInput, options = {}) {
  const range = rangeInput?.ok === true ? rangeInput : normalizeCustomRange(rangeInput);
  if (!range.ok) return emptyPeriod();
  if (!period || typeof period !== 'object') return emptyPeriod();

  if (range.coversFullDays) {
    return withProjects(period, options);
  }

  const filtered = filterSessionsByCustomRange(period.sessions || {}, range);
  const next = withProjects({
    ...period,
    sessions: filtered.sessions
  }, options);
  next.projects = options.projectsEnabled === false
    ? Object.create(null)
    : projectRollupFromSessions(filtered.sessions);
  next._meta = filtered.meta;
  return next;
}

function formatCustomRangeLabel(rangeInput, options = {}) {
  const range = rangeInput?.ok === true ? rangeInput : normalizeCustomRange(rangeInput);
  if (!range.ok) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${range.startDate} ${pad(range.startHour)}:00`;
  const end = `${range.endDate} ${pad(range.endHour)}:00`;
  if (options.compact && range.isSameDay) {
    return `${range.startDate} ${pad(range.startHour)}–${pad(range.endHour)}h`;
  }
  return `${start} → ${end}`;
}

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultCustomRange(now = new Date()) {
  return normalizeCustomRange({
    startDate: localDayKey(now),
    endDate: localDayKey(now),
    startHour: 0,
    endHour: Math.min(23, now.getHours())
  });
}

module.exports = {
  clampHour,
  compareDateHour,
  defaultCustomRange,
  filterPeriodByCustomRange,
  filterSessionsByCustomRange,
  formatCustomRangeLabel,
  localDateTimeMs,
  localDayKey,
  normalizeCustomRange,
  parseDateParts,
  periodFromSessions,
  sessionOverlapsRange
};
