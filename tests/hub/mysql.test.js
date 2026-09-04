'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createHub } = require('../../src/hub/server');
const { createMySqlPool, createRepository } = require('../../src/hub/repository');
const { runMigrations } = require('../../migrations/run');
const { loadDotEnv } = require('../../src/shared/config');

loadDotEnv();

const enabled = process.env.MYSQL_TEST_ENABLED === '1' && Boolean(process.env.MYSQL_TEST_PASSWORD);

function payload(totalTokens, updatedAt = '2026-07-18T00:00:00.000Z') {
  return {
    deviceId: 'mysql-device', updatedAt,
    allTime: {
      totalTokens, clients: { codex: totalTokens }, models: { 'gpt-5': totalTokens },
      clientModels: { codex: { 'gpt-5': totalTokens } },
      sessions: {
        'codex:session-1': {
          client: 'codex', sessionId: 'session-1', totalTokens, inputTokens: totalTokens,
          models: { 'gpt-5': totalTokens }, lastUsedAt: updatedAt, startedAt: updatedAt
        }
      }
    },
    today: { totalTokens }, month: { totalTokens }
  };
}

test('MySQL ingest snapshots prices and preserves baseline identity across delete and re-ingest', { skip: !enabled && 'set MYSQL_TEST_PASSWORD and start docker-compose.test.yml' }, async () => {
  const pool = createMySqlPool({
    host: process.env.MYSQL_TEST_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_TEST_PORT || 17322),
    user: process.env.MYSQL_TEST_USER || 'token_monitor_test',
    password: process.env.MYSQL_TEST_PASSWORD,
    database: process.env.MYSQL_TEST_DATABASE || 'token_monitor_test'
  });
  const repository = createRepository(pool);
  const hub = createHub({ repository, logger: { error() {} } });
  try {
    await runMigrations(pool);
    await pool.query('DELETE FROM usage_events');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM device_ingest_state');
    await pool.query('DELETE FROM devices');
    await pool.query('DELETE FROM model_pricing');

    await hub.setPricing('gpt-5', {
      inputPricePerMillion: 1,
      outputPricePerMillion: 0,
      cacheReadPricePerMillion: 0,
      cacheWritePricePerMillion: 0
    });
    await hub.ingest(payload(1_000_000));
    await hub.setPricing('gpt-5', {
      inputPricePerMillion: 2,
      outputPricePerMillion: 0,
      cacheReadPricePerMillion: 0,
      cacheWritePricePerMillion: 0
    });
    await hub.ingest(payload(2_000_000, '2026-07-18T00:01:00.000Z'));

    const [events] = await pool.query('SELECT price_input_per_million, cost_usd FROM usage_events ORDER BY id');
    assert.deepEqual(events.map((row) => Number(row.price_input_per_million)), [1, 2]);
    assert.deepEqual(events.map((row) => Number(row.cost_usd)), [1, 2]);
    await hub.deleteDevice('mysql-device');
    const [remaining] = await pool.query('SELECT device_id FROM usage_events ORDER BY id');
    assert.equal(remaining.length, 2);
    assert.ok(remaining.every((row) => row.device_id === 'mysql-device'));
    assert.equal((await hub.getStats()).devices.length, 0);

    await hub.ingest(payload(2_000_000, '2026-07-18T00:02:00.000Z'));
    const [afterReingest] = await pool.query('SELECT device_id FROM usage_events ORDER BY id');
    assert.equal(afterReingest.length, 2, 're-ingesting the same cumulative snapshot must not duplicate the ledger');
    assert.equal((await hub.getStats()).devices.length, 1);
  } finally {
    await pool.end();
  }
});
