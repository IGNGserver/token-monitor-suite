'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { aggregateHistoryRange, createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

test('aggregateHistoryRange sums inclusive local calendar day keys', () => {
  const history = {
    daily: [
      {
        date: '2026-07-20',
        tokens: 100,
        cost: 1,
        perClient: { codex: { tokens: 60, cost: 0.6 }, claude: { tokens: 40, cost: 0.4 } },
        perModel: { 'gpt-5': { tokens: 100, cost: 1 } }
      },
      {
        date: '2026-07-21',
        tokens: 50,
        cost: 0.5,
        perClient: { codex: { tokens: 50, cost: 0.5 } },
        perModel: { 'gpt-5': { tokens: 50, cost: 0.5 } }
      },
      {
        date: '2026-07-22',
        tokens: 999,
        cost: 9,
        perClient: { codex: { tokens: 999, cost: 9 } },
        perModel: { 'gpt-5': { tokens: 999, cost: 9 } }
      }
    ]
  };
  const result = aggregateHistoryRange(
    history,
    new Date('2026-07-20T00:00:00'),
    new Date('2026-07-22T00:00:00'),
    { startDate: '2026-07-20', endDate: '2026-07-21' }
  );
  assert.equal(result.totalTokens, 150);
  assert.equal(result.costUsd, 1.5);
  assert.equal(result.clients.codex, 110);
  assert.equal(result.clients.claude, 40);
  assert.equal(result.models['gpt-5'], 150);
  assert.equal(result.matchedDays, 2);
});

test('aggregateHistoryRange treats reserved keys as unknown without prototype pollution', () => {
  const originalConstructor = Object.getOwnPropertyDescriptor(Object.prototype, 'constructor');
  const result = aggregateHistoryRange({
    daily: [{
      date: '2026-07-20',
      perClient: { __proto__: { tokens: 999 }, constructor: { tokens: 4 } },
      perModel: { __proto__: { tokens: 999 }, prototype: { tokens: 5 } }
    }]
  }, new Date('2026-07-20T00:00:00'), new Date('2026-07-21T00:00:00'), {
    startDate: '2026-07-20',
    endDate: '2026-07-20'
  });

  assert.equal(result.clients.unknown, 4);
  assert.equal(result.models.unknown, 5);
  assert.equal(Object.getOwnPropertyDescriptor(Object.prototype, 'constructor')?.value, originalConstructor.value);
  assert.equal(Object.prototype.auditPolluted, undefined);
});

test('GET /api/usage/range prefers history_daily over usage_events', async () => {
  const repository = new MemoryRepository();
  await repository.insertUsageEvents('dev-a', [{
    client: 'codex',
    sessionId: 's1',
    model: 'gpt-5',
    recordedAt: '2026-07-20T12:30:00.000Z',
    inputTokens: 40,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.2
  }]);
  await repository.saveDevice({
    deviceId: 'dev-a',
    history: {
      daily: [{
        date: '2026-07-20',
        tokens: 999,
        cost: 9,
        perClient: { codex: { tokens: 999, cost: 9 } },
        perModel: { 'gpt-5': { tokens: 999, cost: 9 } }
      }],
      monthly: [],
      summary: {}
    }
  });

  const hub = createHub({
    port: 0,
    host: '127.0.0.1',
    secret: 'range-secret',
    repository,
    logger: { error() {}, warn() {} }
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const base = `http://127.0.0.1:${port}`;
    const headers = { authorization: 'Bearer range-secret' };

    const withHistory = await fetch(
      `${base}/api/usage/range?startDate=2026-07-20&endDate=2026-07-20&startHour=0&endHour=23`,
      { headers }
    );
    assert.equal(withHistory.status, 200);
    const historyBody = await withHistory.json();
    assert.equal(historyBody.source, 'history_daily');
    assert.equal(historyBody.totalTokens, 999);
    assert.equal(historyBody.clients.codex, 999);
    assert.equal(historyBody.startDate, '2026-07-20');
    assert.equal(historyBody.endDate, '2026-07-20');

    // No overlapping history day and no events → empty history_daily payload
    const eventOnly = await fetch(
      `${base}/api/usage/range?from=${encodeURIComponent('2026-07-21T00:00:00.000Z')}&to=${encodeURIComponent('2026-07-22T00:00:00.000Z')}`,
      { headers }
    );
    assert.equal(eventOnly.status, 200);
    const eventBody = await eventOnly.json();
    assert.equal(eventBody.source, 'history_daily');
    assert.equal(eventBody.totalTokens, 0);

    // Events still used when history has no matching days but events exist in window
    await repository.insertUsageEvents('dev-a', [{
      client: 'codex',
      sessionId: 's2',
      model: 'gpt-5',
      recordedAt: '2026-07-21T12:00:00.000Z',
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0.1
    }]);
    const withEvents = await fetch(
      `${base}/api/usage/range?from=${encodeURIComponent('2026-07-21T00:00:00.000Z')}&to=${encodeURIComponent('2026-07-22T00:00:00.000Z')}`,
      { headers }
    );
    assert.equal(withEvents.status, 200);
    const body = await withEvents.json();
    assert.equal(body.source, 'usage_events');
    assert.equal(body.totalTokens, 15);

    const bad = await fetch(`${base}/api/usage/range?from=nope&to=2026-07-21T00:00:00.000Z`, { headers });
    assert.equal(bad.status, 400);
  } finally {
    await hub.stop();
  }
});
test('GET /api/usage/range falls back to live today when history is empty', async () => {
  const repository = new MemoryRepository();
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  await repository.saveDevice({
    deviceId: 'dev-live',
    hostname: 'host-a',
    platform: 'win32',
    updatedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    today: {
      totalTokens: 12345,
      costUsd: 1.25,
      clients: { codex: 12345 },
      clientCosts: { codex: 1.25 },
      models: { 'gpt-5': 12345 },
      modelCosts: { 'gpt-5': 1.25 }
    },
    history: { daily: [], monthly: [], summary: {} }
  });

  const hub = createHub({
    port: 0,
    host: '127.0.0.1',
    secret: 'range-secret',
    repository,
    logger: { error() {}, warn() {} }
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const base = `http://127.0.0.1:${port}`;
    const headers = { authorization: 'Bearer range-secret' };
    const res = await fetch(
      `${base}/api/usage/range?startDate=${todayKey}&endDate=${todayKey}&startHour=0&endHour=23`,
      { headers }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.source, 'live_today');
    assert.equal(body.totalTokens, 12345);
    assert.equal(body.clients.codex, 12345);
    assert.equal(body.startDate, todayKey);
    assert.equal(body.endDate, todayKey);
  } finally {
    await hub.stop();
  }
});

test('aggregateHistoryRange reports the window it actually covered', () => {
  const history = {
    daily: [
      { date: '2026-07-20', tokens: 100, cost: 1 },
      { date: '2026-07-21', tokens: 50, cost: 0.5 }
    ]
  };
  // The request reaches back before the rolling window starts.
  const truncated = aggregateHistoryRange(
    history,
    new Date('2025-01-01T00:00:00'),
    new Date('2026-07-21T00:00:00'),
    { startDate: '2025-01-01', endDate: '2026-07-21' }
  );
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.coveredFrom, '2026-07-20');
  assert.equal(truncated.coveredTo, '2026-07-21');
  assert.equal(truncated.requestedStart, '2025-01-01');

  // A fully covered request is not flagged.
  const covered = aggregateHistoryRange(
    history,
    new Date('2026-07-20T00:00:00'),
    new Date('2026-07-21T00:00:00'),
    { startDate: '2026-07-20', endDate: '2026-07-21' }
  );
  assert.equal(covered.truncated, false);
  assert.equal(covered.coveredFrom, '2026-07-20');
});

test('a range reaching past the daily window is topped up from the ledger', async () => {
  const repository = new MemoryRepository();
  // Ledger rows for the uncovered head (2024), well before the daily window.
  await repository.insertUsageEvents('dev-a', [{
    client: 'codex',
    model: 'gpt-5',
    // The ledger stores token components, not a single `tokens` field.
    inputTokens: 500,
    outputTokens: 200,
    costUsd: 7,
    recordedAt: '2024-06-01T00:00:00.000Z'
  }]);

  const hub = createHub({ port: 0, host: '127.0.0.1', secret: '', repository, logger: { error() {}, warn() {} } });
  await hub.start();
  try {
    // Only a 2026 daily row exists, so the 2024 portion is not in history.
    await repository.saveDevice({
      deviceId: 'dev-a',
      hostname: 'host',
      platform: 'linux-x64',
      updatedAt: '2026-07-21T00:00:00.000Z',
      receivedAt: '2026-07-21T00:00:00.000Z',
      history: {
        daily: [{ date: '2026-07-20', tokens: 100, cost: 1, perClient: { codex: { tokens: 100, cost: 1 } }, perModel: { 'gpt-5': { tokens: 100, cost: 1 } } }],
        monthly: [],
        summary: {}
      },
      periods: {}
    });

    const range = await hub.getUsageRange({ startDate: '2024-06-01', endDate: '2026-07-20' });
    assert.equal(range.source, 'history_daily+usage_events', 'the uncovered head should be filled from the ledger');
    assert.equal(range.headSource, 'usage_events');
    assert.equal(range.totalTokens, 800, 'in-window 100 plus the ledger head 700');
    assert.equal(range.costUsd, 8);
    assert.equal(range.clients.codex, 800);
  } finally {
    await hub.stop();
  }
});

test('an oversized daily history is capped to the product window on coercion', () => {
  const { coerceHistory } = require('../../src/shared/history');
  const rows = [];
  for (let index = 0; index < 4000; index += 1) {
    rows.push({ date: new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString().slice(0, 10), tokens: index, cost: 0 });
  }
  const capped = coerceHistory({ daily: rows, monthly: [{ month: '2020-01' }], summary: { activeDays: 3 } });
  assert.equal(capped.daily.length, 370, 'the daily tier should be trimmed to the product window');
  // The newest rows are the ones that matter, so they must survive the trim.
  assert.equal(capped.daily[capped.daily.length - 1].date, rows[rows.length - 1].date);
  assert.equal(capped.monthly.length, 1, 'the monthly tier is the lifetime rollup and must be kept');
  assert.deepEqual(capped.summary, { activeDays: 3 });
  // A history already inside the window must pass through untouched.
  const small = [{ date: '2026-07-20', tokens: 1, cost: 0 }];
  assert.equal(coerceHistory({ daily: small }).daily, small);
});

test('a limits-only ingest preserves the stored usage and ledger', async () => {
  // docs/API.md accepts `limitsOnly` for mixed-version compatibility, and
  // mergeDeviceRecord has a branch for it. Stripping the flag before the merge made
  // that branch unreachable, so a limits-only body zeroed the device's periods,
  // deleted its sessions and made the next real tick look like a counter reset.
  const repository = new MemoryRepository();
  const hub = createHub({ port: 0, host: '127.0.0.1', secret: '', repository, logger: { error() {}, warn() {} } });
  await hub.start();
  try {
    const full = {
      deviceId: 'dev-limits',
      hostname: 'host',
      platform: 'linux-x64',
      updatedAt: '2026-07-21T00:00:00.000Z',
      allTime: { totalTokens: 100, costUsd: 1, clients: { codex: 100 }, models: { 'gpt-5': 100 } },
      today: { totalTokens: 100 },
      month: { totalTokens: 100 }
    };
    await hub.ingest(full);
    const eventsAfterFull = repository.events.length;
    assert.ok(eventsAfterFull > 0, 'the full ingest should append ledger rows');

    // The documented mixed-version shape: limits only, no period objects.
    await hub.ingest({
      deviceId: 'dev-limits',
      updatedAt: '2026-07-21T00:05:00.000Z',
      limitsOnly: true,
      limits: { providers: [{ provider: 'codex', status: 'ok', windows: [] }] }
    });

    const stored = await repository.getDeviceRecord('dev-limits');
    assert.equal(stored.periods.allTime.totalTokens, 100, 'the stored all-time total must survive');
    assert.equal(stored.periods.today.totalTokens, 100, 'the stored today total must survive');
    assert.equal(repository.events.length, eventsAfterFull, 'a limits-only update must not touch the ledger');

    // And a following real tick must not be seen as a counter reset.
    await hub.ingest({ ...full, updatedAt: '2026-07-21T00:10:00.000Z' });
    const stats = await hub.getStats();
    const device = stats.devices.find((entry) => entry.deviceId === 'dev-limits');
    assert.equal(device.periods.allTime.totalTokens, 100);
  } finally {
    await hub.stop();
  }
});
