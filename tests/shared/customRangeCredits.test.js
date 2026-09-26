'use strict';

// customRange.js rebuilds a period from sessions, and sessions now carry their own
// credits and provenance, so the rollup has to exist for the module to be
// self-consistent. This is deliberately a module-level guarantee and NOT a claim
// about the Yesterday / Week tabs: `collectCustomRangeOnce()` has no Qoder branch,
// so a locally parsed Qoder period never reaches this code today. When that branch
// is added, these are the assertions that make its credits correct.

const assert = require('node:assert/strict');
const test = require('node:test');

const { filterPeriodByCustomRange, periodFromSessions } = require('../../src/shared/customRange');
const { emptyPeriod } = require('../../src/shared/usage');

function qoderSessions() {
  return {
    'qoder:s1': {
      client: 'qoder',
      sessionId: 's1',
      totalTokens: 1200,
      costUsd: 0.03,
      credits: 0.75,
      modelCredits: { 'qwen3.7-plus': 0.5, 'glm-4.7-flash': 0.25 },
      models: { 'qwen3.7-plus': 800, 'glm-4.7-flash': 400 },
      estimated: true,
      startedAt: '2026-09-20T09:00:00.000Z',
      lastUsedAt: '2026-09-20T11:00:00.000Z'
    },
    'qoder:s2': {
      client: 'qoder',
      sessionId: 's2',
      totalTokens: 300,
      costUsd: 0.01,
      credits: 1.5,
      modelCredits: { 'qwen3.7-plus': 1.5 },
      models: { 'qwen3.7-plus': 300 },
      estimated: true,
      startedAt: '2026-09-21T09:00:00.000Z',
      lastUsedAt: '2026-09-21T10:00:00.000Z'
    },
    'claude:c1': {
      client: 'claude',
      sessionId: 'c1',
      totalTokens: 500,
      costUsd: 0.2,
      models: { 'claude-opus-4-8': 500 },
      startedAt: '2026-09-21T09:00:00.000Z',
      lastUsedAt: '2026-09-21T10:00:00.000Z'
    }
  };
}

test('a locally computed range sums credits per client and per client-model', () => {
  const period = periodFromSessions(qoderSessions());

  assert.equal(period.clientCredits.qoder, 2.25);
  assert.deepEqual(period.clientModelCredits.qoder, { 'qwen3.7-plus': 2, 'glm-4.7-flash': 0.25 });
  assert.ok(!('claude' in period.clientCredits), 'a client with no credit meter is absent, not zero');
});

test('a locally computed range keeps the per-client estimate flag', () => {
  const period = periodFromSessions(qoderSessions());

  assert.deepEqual(period.clientEstimated, { qoder: true },
    'the `~` has to survive into the range, or a custom range silently looks exact');
  assert.equal(period.clientEstimated.claude, undefined);
});

test('a sub-day range trims session detail but keeps the scanned totals, credits included', () => {
  // Pins existing behaviour rather than asking for new behaviour. Only the
  // coversFullDays case reuses a whole period as-is, and the sub-day case never
  // re-derives totals from the sessions it kept: its caller is
  // `collectCustomRangeOnce()`, whose period is already bounded by the
  // `--since`/`--until` scan, so trimming detail is all that step does. Credits
  // follow the same rule as costUsd and clients here — which is exactly why
  // wiring Qoder into that scan has to bound the rows, not just relabel them.
  const period = filterPeriodByCustomRange(
    periodFromSessions(qoderSessions()),
    { startDate: '2026-09-20', endDate: '2026-09-20', startHour: 3, endHour: 3 }
  );

  assert.deepEqual(Object.keys(period.sessions), [], 'the window holds none of the sessions');
  assert.equal(period.clientCredits.qoder, 2.25, 'the aggregates are carried, not recomputed');
  assert.equal(period.clientEstimated.qoder, true);
});

test('a full-day range passes the live period through with its credits', () => {
  const live = {
    ...emptyPeriod(),
    totalTokens: 1500,
    clients: { qoder: 1500 },
    clientCredits: { qoder: 2.25 },
    clientEstimated: { qoder: true },
    sessions: qoderSessions()
  };

  const period = filterPeriodByCustomRange(live, { startDate: '2026-09-20', endDate: '2026-09-21', startHour: 0, endHour: 23 });

  assert.equal(period.clientCredits.qoder, 2.25);
  assert.equal(period.clientEstimated.qoder, true);
});

test('a range built from pre-credits sessions reports nothing rather than zero', () => {
  const legacy = {
    'codex:x1': { client: 'codex', sessionId: 'x1', totalTokens: 100, costUsd: 0.1, models: { 'gpt-5': 100 } }
  };
  const period = periodFromSessions(legacy);

  assert.deepEqual(period.clientCredits, {});
  assert.deepEqual(period.clientEstimated, {});
  assert.deepEqual(period.clientModelCredits, {});
});
