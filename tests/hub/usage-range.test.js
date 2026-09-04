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
