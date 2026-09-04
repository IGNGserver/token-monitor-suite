'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runMigrations, migrationFiles } = require('../../migrations/run');

function fakePool({ applied = [], releaseError = null } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ kind: 'execute', sql, params });
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
      if (sql.includes('RELEASE_LOCK')) {
        if (releaseError) throw releaseError;
        return [[{ released: 1 }], []];
      }
      return [[], []];
    },
    async query(sql) {
      calls.push({ kind: 'query', sql });
      if (sql.includes('SELECT name FROM schema_migrations')) return [applied.map((name) => ({ name })), []];
      return [[], []];
    },
    release() { calls.push({ kind: 'release' }); }
  };
  return { calls, async getConnection() { return connection; } };
}

test('migration runner releases the connection even if advisory-lock cleanup fails', async () => {
  const pool = fakePool({ applied: migrationFiles(), releaseError: new Error('connection lost') });
  await assert.rejects(() => runMigrations(pool), /connection lost/);
  assert.equal(pool.calls.at(-1).kind, 'release');
});

test('migration runner serializes DDL with a MySQL advisory lock and no false transaction boundary', async () => {
  const pool = fakePool();
  await runMigrations(pool);

  const lock = pool.calls.find((call) => call.sql.includes('GET_LOCK'));
  const release = pool.calls.find((call) => call.sql.includes('RELEASE_LOCK'));
  assert.deepEqual(lock.params, ['token-monitor-schema-migrations', 30]);
  assert.deepEqual(release.params, ['token-monitor-schema-migrations']);
  assert.equal(pool.calls.some((call) => call.kind === 'beginTransaction' || call.kind === 'rollback' || call.kind === 'commit'), false);
  const ddl = pool.calls.filter((call) => call.kind === 'query' && call.sql.startsWith('CREATE TABLE'));
  assert.equal(ddl.length, 7);
  assert.ok(ddl.every((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS')));
  assert.deepEqual(
    pool.calls.filter((call) => call.sql?.includes('INSERT INTO schema_migrations')).map((call) => call.params[0]),
    migrationFiles()
  );
});

test('migration runner leaves already-applied files untouched', async () => {
  const pool = fakePool({ applied: migrationFiles() });
  await runMigrations(pool);
  assert.equal(pool.calls.some((call) => call.sql?.includes('INSERT INTO schema_migrations')), false);
  assert.equal(pool.calls.filter((call) => call.kind === 'query' && call.sql.startsWith('CREATE TABLE')).length, 1);
});

test('soft-delete migration is restart-safe using MySQL-supported conditional DDL', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../migrations/003_device_soft_delete.sql'), 'utf8');
  assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
  assert.match(sql, /information_schema\.COLUMNS/i);
  assert.match(sql, /PREPARE token_monitor_device_soft_delete/i);
  assert.match(sql, /ALTER TABLE `devices` ADD COLUMN `deleted_at`/i);
});
