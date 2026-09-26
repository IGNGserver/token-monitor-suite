'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

// Device data transfer: /api/devices/{source}/transfer moves the source's
// recorded history onto an existing target device. The source keeps its
// identity and keeps recording; only the ownership of the already-recorded
// history changes, so the source's next upload must book only new usage.

function createMemoryHub(options = {}) {
  const repository = options.repository || new MemoryRepository();
  return { repository, hub: createHub({ port: 0, host: '127.0.0.1', secret: '', repository, logger: { error() {}, warn() {} }, ...options }) };
}

function payload(totalTokens, { deviceId = 'dev-a', model = 'gpt-5', inputTokens = totalTokens, updatedAt = '2026-07-18T00:00:00.000Z' } = {}) {
  return {
    deviceId,
    updatedAt,
    allTime: {
      totalTokens,
      costUsd: totalTokens / 1_000_000,
      clients: { codex: totalTokens },
      clientCosts: { codex: totalTokens / 1_000_000 },
      models: { [model]: totalTokens },
      modelCosts: { [model]: totalTokens / 1_000_000 },
      clientModels: { codex: { [model]: totalTokens } },
      clientModelCosts: { codex: { [model]: totalTokens / 1_000_000 } },
      sessions: {
        'codex:session-1': {
          client: 'codex', sessionId: 'session-1', totalTokens, inputTokens,
          models: { [model]: totalTokens }, modelCosts: { [model]: totalTokens / 1_000_000 },
          lastUsedAt: updatedAt, startedAt: updatedAt
        }
      }
    },
    today: { totalTokens },
    month: { totalTokens }
  };
}

async function startTransferHub() {
  const { hub, repository } = createMemoryHub();
  await hub.start();
  const { port } = hub.server.address();
  const transfer = (source, targetDeviceId) => fetch(`http://127.0.0.1:${port}/api/devices/${encodeURIComponent(source)}/transfer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetDeviceId })
  });
  const ingest = (body) => hub.ingest(body);
  return { hub, repository, port, transfer, ingest };
}

test('transfer moves the ledger, merges periods, and removes the source device', async () => {
  const ctx = await startTransferHub();
  const { hub, transfer, ingest } = ctx;
  try {
    await ingest(payload(100, { deviceId: 'dev-a' }));
    await ingest(payload(40, { deviceId: 'dev-b', updatedAt: '2026-07-18T01:00:00.000Z' }));

    const response = await transfer('dev-a', 'dev-b');
    assert.equal(response.status, 200);

    const stats = await (await fetch(`http://127.0.0.1:${ctx.port}/api/stats`)).json();
    const target = stats.devices.find((device) => device.deviceId === 'dev-b');
    const source = stats.devices.find((device) => device.deviceId === 'dev-a');
    assert.equal(target.periods.allTime.totalTokens, 140, 'target owns both devices\' history');
    assert.equal(source, undefined, 'the source device is removed by the Hub');
    assert.equal(stats.periods.allTime.totalTokens, 140, 'the aggregate does not double-count');
  } finally {
    await hub.stop();
  }
});

test('a removed source re-registering under the same id only books new usage', async () => {
  const ctx = await startTransferHub();
  const { hub, repository, transfer, ingest } = ctx;
  try {
    await ingest(payload(100, { deviceId: 'dev-a' }));
    await ingest(payload(40, { deviceId: 'dev-b', updatedAt: '2026-07-18T01:00:00.000Z' }));
    const transferred = await transfer('dev-a', 'dev-b');
    assert.equal(transferred.status, 200);
    const eventsAfterTransfer = repository.events.length;

    // The operator re-identified this machine; until then its agent keeps
    // uploading under the old cumulative id. The pinned baseline means the
    // replayed cumulative counters book nothing; only new usage counts.
    await ingest(payload(120, { deviceId: 'dev-a', updatedAt: '2026-07-18T02:00:00.000Z' }));

    assert.equal(repository.events.length - eventsAfterTransfer, 1, 'exactly one new event');
    const newEvent = repository.events[repository.events.length - 1];
    assert.equal(newEvent.deviceId, 'dev-a', 'new usage stays attributed to the source');
    assert.equal(newEvent.totalTokens, 20, 'only the delta is booked, not the transferred history');

    const stats = await (await fetch(`http://127.0.0.1:${ctx.port}/api/stats`)).json();
    const target = stats.devices.find((device) => device.deviceId === 'dev-b');
    const source = stats.devices.find((device) => device.deviceId === 'dev-a');
    assert.equal(target.periods.allTime.totalTokens, 140, 'target keeps the transferred total');
    assert.equal(source.periods.allTime.totalTokens, 20, 'source owns only its new usage');
    assert.equal(stats.periods.allTime.totalTokens, 160);
  } finally {
    await hub.stop();
  }
});

test('transfer requires an existing target device', async () => {
  const ctx = await startTransferHub();
  const { hub, transfer, ingest } = ctx;
  try {
    await ingest(payload(100, { deviceId: 'dev-a' }));

    const missingTarget = await transfer('dev-a', 'dev-missing');
    assert.equal(missingTarget.status, 404);
    assert.equal((await missingTarget.json()).error, 'target_not_found');

    const missingSource = await transfer('dev-missing', 'dev-a');
    assert.equal(missingSource.status, 404);

    const sameDevice = await transfer('dev-a', 'dev-a');
    assert.equal(sameDevice.status, 400);
    assert.equal((await sameDevice.json()).error, 'same_device');
  } finally {
    await hub.stop();
  }
});

test('transfer sums sessions present on both devices instead of dropping them', async () => {
  const ctx = await startTransferHub();
  const { hub, repository, transfer, ingest } = ctx;
  try {
    // Both devices report the same client+session id, so a plain row move would
    // collide with the target's primary key.
    await ingest(payload(100, { deviceId: 'dev-a' }));
    await ingest(payload(40, { deviceId: 'dev-b', updatedAt: '2026-07-18T01:00:00.000Z' }));

    const transferred = await transfer('dev-a', 'dev-b');
    assert.equal(transferred.status, 200);

    const sourceSessions = [...repository.sessions.entries()].filter(([key]) => key.startsWith('dev-a\u0000'));
    assert.equal(sourceSessions.length, 0, 'no session rows remain on the source');
    const moved = [...repository.sessions.entries()].find(([key]) => key.startsWith('dev-b\u0000') && key.endsWith('\u0000codex\u0000session-1'));
    assert.ok(moved, 'the shared session lives under the target device');
    // dev-a contributed 100 and dev-b 40 for the same session id.
    assert.equal(moved[1].totalTokens, 140, 'both sides\' counts are summed into one row');
  } finally {
    await hub.stop();
  }
});

test('a transferred source reporting its old cumulative totals keeps the aggregate stable', async () => {
  const ctx = await startTransferHub();
  const { hub, transfer, ingest } = ctx;
  try {
    await ingest(payload(100, { deviceId: 'dev-a' }));
    await ingest(payload(40, { deviceId: 'dev-b', updatedAt: '2026-07-18T01:00:00.000Z' }));
    assert.equal((await hub.getStats()).periods.allTime.totalTokens, 140);
    const transferred = await transfer('dev-a', 'dev-b');
    assert.equal(transferred.status, 200);
    // dev-b's own 40 plus the moved 100 — the total is conserved, the source
    // just stops displaying its share.
    assert.equal((await hub.getStats()).periods.allTime.totalTokens, 140);
    // A repeated cumulative report (no new usage yet) must not re-add anything.
    await ingest(payload(100, { deviceId: 'dev-a', updatedAt: '2026-07-18T02:00:00.000Z' }));
    assert.equal((await hub.getStats()).periods.allTime.totalTokens, 140, 'replayed counters must not double-count');
  } finally {
    await hub.stop();
  }
});
