'use strict';

// Qoder publishes its own credit meter instead of token counts, and it is the
// only exact number in that client's record (its token totals are content
// estimates). These tests pin both halves of that story on the wire: the exact
// `period.clientCredits` map, and the per-client `period.clientEstimated` flag
// that lets the UI mark one client's guess without branding every other
// client's exact total as one too. Credits are deliberately a separate per-client
// map rather than part of costUsd, so everything here asserts the two stay apart.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addPeriodInto,
  aggregateDevices,
  applyPeriodDelta,
  emptyPeriod,
  extractUsageFromTokscale,
  mergePeriods,
  normalizeDeviceRecord,
  normalizePeriod
} = require('../../src/shared/usage');

function period(overrides = {}) {
  return { ...emptyPeriod(), ...overrides };
}

// One tokscale-shaped entry, in the shape the Qoder adapter emits.
function entry(overrides = {}) {
  return {
    client: 'qoder',
    provider: 'qoder',
    sessionId: 'qoder:cn:session-1',
    model: 'Qwen3.7-Plus',
    input: 1000,
    output: 200,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    messageCount: 1,
    cost: 0.02,
    credits: 0.323132128,
    startedAt: '2026-09-01T10:00:00.000Z',
    lastUsedAt: '2026-09-01T10:00:05.000Z',
    estimated: true,
    ...overrides
  };
}

function json(entries) {
  return { groupBy: 'client,session,model', entries };
}

test('an entry credits its client without touching the USD cost totals', () => {
  const result = extractUsageFromTokscale(json([entry()]));

  assert.deepEqual(result.clientCredits, { qoder: 0.323132128 });
  // The whole point of the separate map: folding credits into costs would invent
  // an exchange rate Qoder has never published.
  assert.equal(result.costUsd, 0.02);
  assert.deepEqual(result.clientCosts, { qoder: 0.02 });
  assert.equal(result.totalTokens, 1200);
});

test('credit entries for the same client and session accumulate', () => {
  const result = extractUsageFromTokscale(json([
    entry({ credits: 0.5 }),
    entry({ credits: 0.25, sessionId: 'qoder:cn:session-1', messageId: 'm2' })
  ]));

  assert.equal(result.clientCredits.qoder, 0.75);
});

test('the credit map stays sparse across clients that do not meter credits', () => {
  const result = extractUsageFromTokscale(json([
    entry(),
    entry({ client: 'claude', provider: 'anthropic', sessionId: 'claude:s1', credits: undefined })
  ]));

  assert.deepEqual(result.clientCredits, { qoder: 0.323132128 },
    'a client with no credit meter must be absent, not zeroed');
  assert.deepEqual(result.clients, { qoder: 1200, claude: 1200 });
});

test('a zero-credit request is not recorded, and a negative one cannot subtract usage', () => {
  const zero = extractUsageFromTokscale(json([entry({ credits: 0 })]));
  assert.deepEqual(zero.clientCredits, {});

  const negative = extractUsageFromTokscale(json([entry({ credits: -5 })]));
  assert.deepEqual(negative.clientCredits, {},
    'a device record must not be able to report negative consumption');
});

test('normalizePeriod re-keys clientCredits and drops non-numeric entries', () => {
  const normalized = normalizePeriod({
    clientCredits: { 'Qoder CN': 1.5, qoder: '0.25', codex: 'not-a-number', claude: -3 }
  });

  assert.deepEqual(normalized.clientCredits, { qodercn: 1.5, qoder: 0.25 },
    'keys go through normalizeClientName and a bad value cannot poison the map');
});

test('mergePeriods sums credits per client across periods', () => {
  const a = period({ clients: { qoder: 100 }, clientCredits: { qoder: 0.4 } });
  const b = period({ clients: { qoder: 50, qodercn: 20 }, clientCredits: { qoder: 0.1, qodercn: 2 } });

  assert.deepEqual(mergePeriods(a, b).clientCredits, { qoder: 0.5, qodercn: 2 });
});

test('an anchored tick derives broader-period credits exactly from the anchor', () => {
  // base + (freshToday - anchorToday) is the anchored identity the collector uses
  // on every watch tick. Credits are a plain per-client sum, so they ride it with
  // no special casing — which is why they must never be stored as a ratio.
  const baseMonth = period({ totalTokens: 9000, clients: { qoder: 9000 }, clientCredits: { qoder: 12.5 } });
  const anchorToday = period({ totalTokens: 1000, clients: { qoder: 1000 }, clientCredits: { qoder: 1.25 } });
  const freshToday = period({ totalTokens: 2500, clients: { qoder: 2500 }, clientCredits: { qoder: 3.1 } });

  const result = applyPeriodDelta(baseMonth, freshToday, anchorToday);

  assert.equal(result.clientCredits.qoder, 14.35);
  assert.equal(result.clients.qoder, 10500);
});

test('an anchored tick clamps credit residue at zero', () => {
  const baseMonth = period({ clientCredits: { qoder: 0.1 } });
  const anchorToday = period({ clientCredits: { qoder: 0.1 + 1e-12 } });
  const freshToday = period();

  const result = applyPeriodDelta(baseMonth, freshToday, anchorToday);

  assert.ok(result.clientCredits.qoder >= 0);
  assert.equal(result.clientCredits.qoder, 0);
});

test('a period carried across devices keeps its credits', () => {
  const record = normalizeDeviceRecord({
    deviceId: 'dev-1',
    hostname: 'workstation',
    platform: 'linux',
    updatedAt: '2026-09-26T00:00:00.000Z',
    agentVersion: '0.47.0',
    today: { totalTokens: 1200, clients: { qoder: 1200 }, clientCredits: { qoder: 0.323132128 } }
  });

  assert.equal(record.periods.today.clientCredits.qoder, 0.323132128);
});

test('normalizeDeviceRecord drops a device-invented credit key instead of coercing it', () => {
  const record = normalizeDeviceRecord({
    deviceId: 'dev-1',
    today: { clients: { qoder: 10 }, clientCredits: { qoder: 1, __proto__: 2, constructor: 3 } }
  });

  assert.deepEqual(record.periods.today.clientCredits, { qoder: 1 },
    'reserved dynamic keys must not enter a plain-object map');
});

test('aggregateDevices sums credits across devices and trims float noise', () => {
  const aggregate = aggregateDevices([
    { deviceId: 'a', today: { totalTokens: 100, clients: { qoder: 100 }, clientCredits: { qoder: 0.11111111 } } },
    { deviceId: 'b', today: { totalTokens: 100, clients: { qoder: 100 }, clientCredits: { qoder: 0.22222222 } } }
  ], 600000);

  assert.equal(aggregate.periods.today.clientCredits.qoder, 0.333333);
});

test('a device with no credit meter contributes an empty map, not a zero', () => {
  const aggregate = aggregateDevices([
    { deviceId: 'a', today: { totalTokens: 10, clients: { claude: 10 } } }
  ], 600000);

  assert.deepEqual(aggregate.periods.today.clientCredits, {});
});

// --- Per-client measurement provenance -------------------------------------
// `period.estimated` says "some row here was estimated", which on a machine
// tracking Claude and Qoder would brand every client's total as a guess. The
// per-client flag is what lets the `~` land only where it is true.

test('only the estimated client is flagged, not the whole period', () => {
  const result = extractUsageFromTokscale(json([
    entry(),
    entry({ client: 'claude', provider: 'anthropic', sessionId: 'claude:s1', estimated: undefined })
  ]));

  assert.equal(result.estimated, true, 'the period-level flag keeps its existing meaning');
  assert.deepEqual(result.clientEstimated, { qoder: true });
});

test('a period with no estimated rows carries no provenance flags', () => {
  const result = extractUsageFromTokscale(json([entry({ estimated: undefined })]));

  assert.deepEqual(result.clientEstimated, {});
  assert.equal(result.estimated, undefined);
});

test('a client that contributed no tokens is not flagged as estimated', () => {
  const result = extractUsageFromTokscale(json([entry({ input: 0, output: 0 })]));

  assert.deepEqual(result.clients, {});
  assert.deepEqual(result.clientEstimated, {}, 'there are no tokens here for the flag to qualify');
});

test('merging periods keeps the estimate flag if either side estimated', () => {
  const target = period({ clients: { qoder: 10 }, clientEstimated: { qoder: true } });
  const exact = period({ clients: { qoder: 5, claude: 20 } });
  const alsoEstimated = period({ clients: { codex: 3 }, clientEstimated: { codex: true } });

  addPeriodInto(target, mergePeriods(exact, alsoEstimated));

  assert.deepEqual(target.clientEstimated, { qoder: true, codex: true },
    'a combined total that mixes exact and estimated tokens is not exact');
});

test('normalizePeriod accepts only a literal true for the provenance flag', () => {
  const normalized = normalizePeriod({
    clientEstimated: { qoder: true, qodercn: 'true', claude: 1, codex: {}, gemini: false, hermes: null }
  });

  assert.deepEqual(normalized.clientEstimated, { qoder: true },
    'a device record must not be able to put a truthy non-boolean into a provenance flag');
});

test('an anchored tick keeps the flag while the client is still in the broader window', () => {
  const baseMonth = period({ clients: { qoder: 9000 }, clientEstimated: { qoder: true } });
  const anchorToday = period({ clients: { qoder: 1000 }, clientEstimated: { qoder: true } });
  const freshToday = period({ clients: { qoder: 2500 } });

  const result = applyPeriodDelta(baseMonth, freshToday, anchorToday);

  assert.equal(result.clientEstimated.qoder, true,
    'the month still contains the estimated tokens, so it is still not exact');
});

test('normalizeDeviceRecord keeps the provenance map off arbitrary client keys', () => {
  const record = normalizeDeviceRecord({
    deviceId: 'dev-1',
    today: { clients: { qoder: 10 }, clientEstimated: { qoder: true, __proto__: true } }
  });

  assert.deepEqual(record.periods.today.clientEstimated, { qoder: true });
});

// --- Credits below the client axis -----------------------------------------
// Migration 006 put credits on the (client, session, model) ledger row, so the
// wire has to deliver them at that grain. Both maps are exact rollups of rows the
// Qoder adapter already attributes per session and model — neither is a client
// total divided among the models it used.

test('sessions carry their own credits and per-model split', () => {
  const result = extractUsageFromTokscale(json([
    entry({ sessionId: 's1', model: 'Qwen3.7-Plus', credits: 0.5 }),
    entry({ sessionId: 's1', model: 'GLM-4.7-Flash', credits: 0.25 }),
    entry({ sessionId: 's2', model: 'Qwen3.7-Plus', credits: 1.5 })
  ]));

  // addSession() keys the map as `client:sessionId`, so the row ids stay bare here.
  assert.equal(result.sessions['qoder:s1'].credits, 0.75);
  assert.equal(result.sessions['qoder:s1'].modelCredits['qwen3.7-plus'], 0.5);
  assert.equal(result.sessions['qoder:s1'].modelCredits['glm-4.7-flash'], 0.25);
  assert.equal(result.sessions['qoder:s2'].credits, 1.5);
  assert.deepEqual(result.clientModelCredits.qoder, { 'qwen3.7-plus': 2, 'glm-4.7-flash': 0.25 });
});

test('a session with no credit meter reports none instead of a zero row', () => {
  const result = extractUsageFromTokscale(json([
    entry({ client: 'claude', provider: 'anthropic', sessionId: 's1', credits: undefined })
  ]));

  assert.equal(result.sessions['claude:s1'].credits, 0);
  assert.deepEqual(result.sessions['claude:s1'].modelCredits, {});
  assert.deepEqual(result.clientModelCredits, {});
});

test('mergePeriods sums the nested credit map and sessions merge their own', () => {
  const a = period({ clientModelCredits: { qoder: { 'qwen3.7-plus': 1 } } });
  const b = period({ clientModelCredits: { qoder: { 'qwen3.7-plus': 0.5, 'glm-4.7-flash': 2 } } });

  const merged = mergePeriods(a, b);

  assert.deepEqual(merged.clientModelCredits.qoder, { 'qwen3.7-plus': 1.5, 'glm-4.7-flash': 2 });
});

test('an anchored tick keeps the nested credit map additive', () => {
  const baseMonth = period({ clientModelCredits: { qoder: { 'qwen3.7-plus': 10 } } });
  const anchorToday = period({ clientModelCredits: { qoder: { 'qwen3.7-plus': 2 } } });
  const freshToday = period({ clientModelCredits: { qoder: { 'qwen3.7-plus': 5 } } });

  const result = applyPeriodDelta(baseMonth, freshToday, anchorToday);

  assert.equal(result.clientModelCredits.qoder['qwen3.7-plus'], 13);
});

test('normalizePeriod re-keys the nested credit map like the cost one', () => {
  const normalized = normalizePeriod({
    clientModelCredits: { 'Qoder CN': { 'QWEN3.7-PLUS': 0.5, 'bad-model': 'nope' } }
  });

  assert.deepEqual(normalized.clientModelCredits, { qodercn: { 'qwen3.7-plus': 0.5 } },
    'a non-numeric credit is dropped rather than becoming NaN in the map');
});
