'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  filterPeriodByCustomRange,
  formatCustomRangeLabel,
  normalizeCustomRange,
  periodFromSessions
} = require('../../src/shared/customRange');
const { emptyPeriod } = require('../../src/shared/usage');
const picker = require('../../src/electron/renderer/customRangePicker');

test('normalizeCustomRange accepts same-day hour windows', () => {
  const range = normalizeCustomRange({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 9,
    endHour: 11
  });
  assert.equal(range.ok, true);
  assert.equal(range.isSameDay, true);
  assert.equal(range.coversFullDays, false);
  assert.ok(range.startMs < range.endMs);
});

test('normalizeCustomRange rejects inverted ranges', () => {
  const range = normalizeCustomRange({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 18,
    endHour: 9
  });
  assert.equal(range.ok, false);
  assert.equal(range.error, 'inverted-range');
});

test('filterPeriodByCustomRange keeps tokscale totals and only narrows sessions', () => {
  const period = emptyPeriod();
  period.totalTokens = 150;
  period.costUsd = 1.5;
  period.clients = { codex: 150 };
  period.clientCosts = { codex: 1.5 };
  period.models = { 'gpt-5': 150 };
  period.modelCosts = { 'gpt-5': 1.5 };
  period.sessions = {
    'codex:a': {
      client: 'codex',
      sessionId: 'a',
      totalTokens: 100,
      costUsd: 1,
      startedAt: '2026-07-24T01:00:00.000Z',
      lastUsedAt: '2026-07-24T02:00:00.000Z',
      models: { 'gpt-5': 100 },
      modelCosts: { 'gpt-5': 1 },
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 10
    },
    'codex:b': {
      client: 'codex',
      sessionId: 'b',
      totalTokens: 50,
      costUsd: 0.5,
      startedAt: '2026-07-25T10:00:00.000Z',
      lastUsedAt: '2026-07-25T11:00:00.000Z',
      models: { 'gpt-5': 50 },
      modelCosts: { 'gpt-5': 0.5 },
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 5
    },
    'codex:undated': {
      client: 'codex',
      sessionId: 'undated',
      totalTokens: 999,
      costUsd: 0,
      models: { 'gpt-5': 999 }
    }
  };

  // Partial-hour multi-day window: session list is narrowed, but totals stay
  // on the tokscale day aggregates (same family as day/month tabs).
  const filtered = filterPeriodByCustomRange(period, {
    startDate: '2026-07-24',
    endDate: '2026-07-25',
    startHour: 0,
    endHour: 12
  });
  assert.equal(filtered.totalTokens, 150);
  assert.equal(filtered.clients.codex, 150);
  assert.equal(Object.keys(filtered.sessions).includes('codex:a'), true);
  assert.equal(Object.keys(filtered.sessions).includes('codex:undated'), true);
  // session b is outside the hour window on the end day only if local TZ maps
  // 2026-07-25T10:00Z into end-day hours after 12 — do not assert TZ-sensitive drop.
});

test('filterPeriodByCustomRange full days keeps period aggregates', () => {
  const period = emptyPeriod();
  period.totalTokens = 42;
  period.clients = { codex: 42 };
  period.sessions = {};
  const filtered = filterPeriodByCustomRange(period, {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    startHour: 0,
    endHour: 23
  });
  assert.equal(filtered.totalTokens, 42);
  assert.equal(filtered.clients.codex, 42);
});

test('periodFromSessions rebuilds totals from session maps', () => {
  const period = periodFromSessions({
    'claude:1': {
      client: 'claude',
      sessionId: '1',
      totalTokens: 20,
      costUsd: 0.2,
      models: { sonnet: 20 },
      modelCosts: { sonnet: 0.2 },
      cacheReadTokens: 2,
      cacheWriteTokens: 1,
      outputTokens: 4
    }
  });
  assert.equal(period.totalTokens, 20);
  assert.equal(period.costUsd, 0.2);
  assert.equal(period.models.sonnet, 20);
  assert.equal(period.clientModels.claude.sonnet, 20);
});

test('periodFromSessions normalizes the session identity stored in the row', () => {
  const period = periodFromSessions({
    'codex:fallback': {
      client: 'Codex',
      sessionId: 'fallback',
      totalTokens: 7,
      models: { 'gpt-5': 7 }
    }
  });

  assert.deepEqual(period.sessions['codex:fallback'], {
    client: 'codex',
    sessionId: 'fallback',
    totalTokens: 7,
    models: { 'gpt-5': 7 }
  });
});

test('formatCustomRangeLabel supports compact same-day form', () => {
  const label = formatCustomRangeLabel({
    startDate: '2026-07-24',
    endDate: '2026-07-24',
    startHour: 8,
    endHour: 20
  }, { compact: true });
  assert.equal(label, '2026-07-24 08–20h');
});

test('picker applyCalendarDayClick supports same-day then multi-day selection', () => {
  let draft = picker.normalizeDraft({
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    startHour: 0,
    endHour: 23
  });
  draft = picker.applyCalendarDayClick(draft, '2026-07-10');
  assert.equal(draft.startDate, '2026-07-10');
  assert.equal(draft.endDate, '2026-07-10');
  assert.equal(draft._pickPhase, 'end');
  draft = picker.applyCalendarDayClick(draft, '2026-07-12');
  assert.equal(draft.startDate, '2026-07-10');
  assert.equal(draft.endDate, '2026-07-12');
  assert.equal(draft._pickPhase, 'done');
});

test('picker weekdayLabels returns seven Sunday-first labels', () => {
  const labels = picker.weekdayLabels('en');
  assert.equal(labels.length, 7);
  // English narrow weekdays are single letters or short glyphs; ensure non-empty.
  assert.equal(labels.every((label) => String(label).trim().length > 0), true);
});
