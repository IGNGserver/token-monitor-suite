'use strict';

const mysql = require('mysql2/promise');
const { emptySubscriptionDocument } = require('../shared/subscriptionDisplay');

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

function ensureNestedMap(map, key) {
  if (!hasOwn(map, key) || !map[key] || typeof map[key] !== 'object' || Array.isArray(map[key])) {
    map[key] = {};
  }
  return map[key];
}

function createMySqlPool(options = {}) {
  const pool = mysql.createPool({
    host: options.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(options.port || process.env.MYSQL_PORT || 3306),
    user: options.user || process.env.MYSQL_USER || 'token_monitor',
    password: options.password ?? process.env.MYSQL_PASSWORD ?? '',
    database: options.database || process.env.MYSQL_DATABASE || 'token_monitor',
    waitForConnections: true,
    connectionLimit: Number(options.connectionLimit || process.env.MYSQL_CONNECTION_LIMIT || 10),
    timezone: 'Z',
    decimalNumbers: true,
    dateStrings: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  if (typeof pool.on === 'function') {
    pool.on('error', (err) => {
      // Prevent unhandled pool errors from bubbling up and crashing the process
      const code = err?.code || 'UNKNOWN';
      const msg = err?.message || String(err);
      console.warn?.(`[mysql-pool] background connection error (${code}): ${msg}`);
    });
  }

  return pool;
}

function json(value) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function date(value) {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function iso(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function subscriptionDocumentRow(row) {
  if (!row) return emptySubscriptionDocument();
  return {
    version: 1,
    updatedAt: row.updated_at ? iso(row.updated_at) : '',
    subscriptions: parseJson(row.subscriptions, []) || []
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pricingRow(row) {
  return {
    id: Number(row.id),
    model: row.model,
    inputPricePerMillion: Number(row.input_price_per_million),
    outputPricePerMillion: Number(row.output_price_per_million),
    cacheReadPricePerMillion: Number(row.cache_read_price_per_million),
    cacheWritePricePerMillion: Number(row.cache_write_price_per_million),
    source: row.source,
    updatedAt: iso(row.updated_at)
  };
}

function hubAccountRow(row) {
  if (!row) return null;
  return {
    id: String(row.account_id || ''),
    provider: String(row.provider || ''),
    name: String(row.name || ''),
    label: String(row.label || ''),
    accountKey: String(row.account_key || ''),
    accountEmail: String(row.account_email || ''),
    accountLabel: String(row.account_label || ''),
    enabled: Boolean(row.enabled),
    status: String(row.status || 'pending'),
    lastErrorCode: String(row.last_error_code || ''),
    lastErrorMessage: String(row.last_error_message || ''),
    lastAttemptAt: row.last_attempt_at ? iso(row.last_attempt_at) : null,
    lastSuccessAt: row.last_success_at ? iso(row.last_success_at) : null,
    nextRefreshAt: row.next_refresh_at ? iso(row.next_refresh_at) : null,
    createdAt: row.created_at ? iso(row.created_at) : null,
    updatedAt: row.updated_at ? iso(row.updated_at) : null
  };
}

function hubAccountSnapshotRow(row) {
  if (!row) return null;
  return {
    provider: parseJson(row.provider_snapshot, null),
    lastGood: parseJson(row.last_good_snapshot, null),
    updatedAt: row.updated_at ? iso(row.updated_at) : null
  };
}

function allPeriodModels(record) {
  const models = new Set();
  for (const period of Object.values(record?.periods || {})) {
    for (const model of Object.keys(period?.models || {})) models.add(model);
    for (const session of Object.values(period?.sessions || {})) {
      for (const model of Object.keys(session?.models || {})) models.add(model);
    }
  }
  return models;
}

function emptyUsageRange() {
  return {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    clientModels: {},
    clientModelCosts: {},
    eventCount: 0
  };
}

function addTokenCost(mapTokens, mapCosts, key, tokens, cost) {
  const id = safeDynamicKey(key);
  mapTokens[id] = mapNumber(mapTokens, id) + tokens;
  mapCosts[id] = mapNumber(mapCosts, id) + cost;
}

function createRepository(pool) {
  async function listDeviceRecords(executor = pool) {
    const [rows] = await executor.query(`SELECT state.snapshot_json
      FROM device_ingest_state state
      INNER JOIN devices device ON device.device_id = state.device_id
      WHERE device.deleted_at IS NULL
      ORDER BY state.device_id`);
    return rows.map((row) => parseJson(row.snapshot_json, {}));
  }

  async function getDeviceRecord(deviceId, executor = pool) {
    const [rows] = await executor.execute('SELECT snapshot_json FROM device_ingest_state WHERE device_id = ?', [deviceId]);
    return rows.length ? parseJson(rows[0].snapshot_json, null) : null;
  }

  async function saveDevice(record, executor = pool) {
    const storedRecord = { ...record };
    delete storedRecord.limits;
    delete storedRecord.limitsOnly;
    await executor.execute(`INSERT INTO devices (
      device_id, hostname, platform, updated_at, received_at, agent_version, agent_runtime,
      tracked_clients, client_status, wsl_status, projects_enabled,
      all_time_projects_omitted, all_time_projects_incomplete, sync_upload_interval_ms,
      period_windows, limits, history
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      hostname = VALUES(hostname), platform = VALUES(platform), updated_at = VALUES(updated_at),
      received_at = VALUES(received_at), agent_version = VALUES(agent_version), agent_runtime = VALUES(agent_runtime),
      tracked_clients = VALUES(tracked_clients), client_status = VALUES(client_status), wsl_status = VALUES(wsl_status),
      projects_enabled = VALUES(projects_enabled), all_time_projects_omitted = VALUES(all_time_projects_omitted),
      all_time_projects_incomplete = VALUES(all_time_projects_incomplete),
      sync_upload_interval_ms = VALUES(sync_upload_interval_ms), period_windows = VALUES(period_windows),
      limits = VALUES(limits), history = VALUES(history), deleted_at = NULL`, [
      record.deviceId, record.hostname || '', record.platform || '', date(record.updatedAt), date(record.receivedAt),
      record.agentVersion || '', record.agentRuntime || '', json(record.trackedClients), json(record.clientStatus),
      json(record.wslStatus), record.projectsEnabled ?? null, record.allTimeProjectsOmitted ?? null,
      record.allTimeProjectsIncomplete ?? null, record.syncUploadIntervalMs ?? null, json(record.periodWindows),
      null, json(record.history)
    ]);
    await executor.execute(`INSERT INTO device_ingest_state (device_id, snapshot_json)
      VALUES (?, ?) ON DUPLICATE KEY UPDATE snapshot_json = VALUES(snapshot_json)`, [record.deviceId, JSON.stringify(storedRecord)]);
  }

  async function countDevices(executor = pool) {
    const [rows] = await executor.query('SELECT COUNT(*) AS count FROM devices WHERE deleted_at IS NULL');
    return Number(rows[0]?.count || 0);
  }

  async function getPricing(models, executor = pool) {
    const ids = [...new Set(models.map((model) => String(model || '').trim()).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await executor.execute(`SELECT * FROM model_pricing WHERE model IN (${placeholders})`, ids);
    return new Map(rows.map((row) => {
      const item = pricingRow(row);
      return [item.model, item];
    }));
  }

  async function listPricing(executor = pool) {
    const [rows] = await executor.query('SELECT * FROM model_pricing ORDER BY model');
    return rows.map(pricingRow);
  }

  async function listHubAccounts(executor = pool) {
    const [rows] = await executor.query(`SELECT * FROM hub_accounts
      ORDER BY provider, name, account_id`);
    return rows.map(hubAccountRow);
  }

  async function getHubAccount(accountId, executor = pool) {
    const [rows] = await executor.execute(
      'SELECT * FROM hub_accounts WHERE account_id = ?',
      [String(accountId || '')]
    );
    return hubAccountRow(rows[0]);
  }

  async function findHubAccount(provider, accountKey = '', accountEmail = '', executor = pool) {
    const normalizedProvider = String(provider || '').trim();
    const normalizedKey = String(accountKey || '').trim();
    const normalizedEmail = String(accountEmail || '').trim().toLowerCase();
    if (!normalizedProvider || (!normalizedKey && !normalizedEmail)) return null;
    const [rows] = await executor.execute(`SELECT * FROM hub_accounts
      WHERE provider = ? AND (
        (? <> '' AND account_key = ?)
        OR (? <> '' AND account_email = ?)
      )
      ORDER BY account_id
      LIMIT 1`, [normalizedProvider, normalizedKey, normalizedKey, normalizedEmail, normalizedEmail]);
    return hubAccountRow(rows[0]);
  }

  async function createHubAccount(account, envelope, snapshot, executor = pool) {
    const now = date(account.updatedAt || Date.now());
    await executor.execute(`INSERT INTO hub_accounts (
      account_id, provider, name, label, account_key, account_email, account_label,
      enabled, status, last_error_code, last_error_message, last_attempt_at,
      last_success_at, next_refresh_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      account.id,
      account.provider,
      account.name || '',
      account.label || '',
      account.accountKey || '',
      account.accountEmail || '',
      account.accountLabel || '',
      account.enabled === false ? 0 : 1,
      account.status || 'pending',
      account.lastErrorCode || '',
      account.lastErrorMessage || '',
      account.lastAttemptAt ? date(account.lastAttemptAt) : null,
      account.lastSuccessAt ? date(account.lastSuccessAt) : null,
      account.nextRefreshAt ? date(account.nextRefreshAt) : null,
      account.createdAt ? date(account.createdAt) : now,
      now
    ]);
    await executor.execute(`INSERT INTO hub_account_credentials (
      account_id, credential_envelope, updated_at
    ) VALUES (?, ?, ?)`, [account.id, json(envelope), now]);
    await executor.execute(`INSERT INTO hub_account_limits (
      account_id, provider_snapshot, last_good_snapshot, updated_at
    ) VALUES (?, ?, ?, ?)`, [
      account.id,
      json(snapshot?.provider),
      json(snapshot?.lastGood),
      snapshot?.updatedAt ? date(snapshot.updatedAt) : now
    ]);
    return getHubAccount(account.id, executor);
  }

  async function updateHubAccount(accountId, patch, executor = pool) {
    const allowed = {
      name: 'name',
      label: 'label',
      accountKey: 'account_key',
      accountEmail: 'account_email',
      accountLabel: 'account_label',
      enabled: 'enabled',
      status: 'status',
      lastErrorCode: 'last_error_code',
      lastErrorMessage: 'last_error_message',
      lastAttemptAt: 'last_attempt_at',
      lastSuccessAt: 'last_success_at',
      nextRefreshAt: 'next_refresh_at',
      updatedAt: 'updated_at'
    };
    const entries = Object.entries(patch || {}).filter(([key, value]) => (
      allowed[key] && value !== undefined
    ));
    if (!entries.length) return getHubAccount(accountId, executor);
    const assignments = entries.map(([key]) => `${allowed[key]} = ?`);
    const values = entries.map(([key, value]) => {
      if (['lastAttemptAt', 'lastSuccessAt', 'nextRefreshAt', 'updatedAt'].includes(key)) {
        return value === null ? null : date(value);
      }
      if (key === 'enabled') return value === false ? 0 : 1;
      return value;
    });
    await executor.execute(
      `UPDATE hub_accounts SET ${assignments.join(', ')} WHERE account_id = ?`,
      [...values, String(accountId || '')]
    );
    return getHubAccount(accountId, executor);
  }

  async function deleteHubAccount(accountId, executor = pool) {
    const [result] = await executor.execute(
      'DELETE FROM hub_accounts WHERE account_id = ?',
      [String(accountId || '')]
    );
    return Number(result.affectedRows || 0) > 0;
  }

  async function getHubAccountCredential(accountId, executor = pool) {
    const [rows] = await executor.execute(
      'SELECT credential_envelope FROM hub_account_credentials WHERE account_id = ?',
      [String(accountId || '')]
    );
    return rows.length ? parseJson(rows[0].credential_envelope, null) : null;
  }

  async function replaceHubAccountCredential(accountId, envelope, executor = pool) {
    await executor.execute(`INSERT INTO hub_account_credentials (
      account_id, credential_envelope, updated_at
    ) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE credential_envelope = VALUES(credential_envelope), updated_at = VALUES(updated_at)`, [
      String(accountId || ''),
      json(envelope),
      new Date()
    ]);
    return getHubAccountCredential(accountId, executor);
  }

  async function getHubAccountSnapshot(accountId, executor = pool) {
    const [rows] = await executor.execute(
      'SELECT provider_snapshot, last_good_snapshot, updated_at FROM hub_account_limits WHERE account_id = ?',
      [String(accountId || '')]
    );
    return hubAccountSnapshotRow(rows[0]);
  }

  async function saveHubAccountSnapshot(accountId, snapshot, executor = pool) {
    await executor.execute(`INSERT INTO hub_account_limits (
      account_id, provider_snapshot, last_good_snapshot, updated_at
    ) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      provider_snapshot = VALUES(provider_snapshot),
      last_good_snapshot = VALUES(last_good_snapshot),
      updated_at = VALUES(updated_at)`, [
      String(accountId || ''),
      json(snapshot?.provider),
      json(snapshot?.lastGood),
      snapshot?.updatedAt ? date(snapshot.updatedAt) : new Date()
    ]);
    return getHubAccountSnapshot(accountId, executor);
  }

  async function appendHubAccountAudit(accountId, action, actor = '', details = null, executor = pool) {
    await executor.execute(`INSERT INTO hub_account_audit (
      account_id, action, actor, details
    ) VALUES (?, ?, ?, ?)`, [
      accountId ? String(accountId) : null,
      String(action || '').slice(0, 64),
      String(actor || '').slice(0, 255),
      json(details)
    ]);
  }

  async function getSubscriptions(executor = pool) {
    const [rows] = await executor.query('SELECT updated_at, subscriptions FROM hub_subscriptions WHERE id = 1');
    return subscriptionDocumentRow(rows[0]);
  }

  async function setSubscriptions(document, baseUpdatedAt) {
    return transaction(async (connection) => {
      const [rows] = await connection.query('SELECT updated_at, subscriptions FROM hub_subscriptions WHERE id = 1 FOR UPDATE');
      const current = subscriptionDocumentRow(rows[0]);
      if (current.updatedAt !== String(baseUpdatedAt || '')) {
        const error = new Error('stale_write');
        error.code = 'stale_write';
        error.current = current;
        throw error;
      }
      const updatedAt = document.updatedAt ? date(document.updatedAt) : null;
      const values = [updatedAt, JSON.stringify(document.subscriptions || [])];
      if (rows.length === 0) {
        await connection.execute(
          'INSERT INTO hub_subscriptions (id, updated_at, subscriptions) VALUES (1, ?, ?)',
          values
        );
      } else {
        await connection.execute(
          'UPDATE hub_subscriptions SET updated_at = ?, subscriptions = ? WHERE id = 1',
          values
        );
      }
      return document;
    });
  }

  async function upsertPricing(model, prices, source, executor = pool) {
    const modelId = String(model || '').trim();
    await executor.execute(`INSERT INTO model_pricing (
      model, input_price_per_million, output_price_per_million,
      cache_read_price_per_million, cache_write_price_per_million, source
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      input_price_per_million = VALUES(input_price_per_million),
      output_price_per_million = VALUES(output_price_per_million),
      cache_read_price_per_million = VALUES(cache_read_price_per_million),
      cache_write_price_per_million = VALUES(cache_write_price_per_million), source = VALUES(source),
      updated_at = CURRENT_TIMESTAMP(3)`, [
      modelId,
      prices.inputPricePerMillion,
      prices.outputPricePerMillion,
      prices.cacheReadPricePerMillion,
      prices.cacheWritePricePerMillion,
      source
    ]);
    return (await getPricing([modelId], executor)).get(modelId);
  }

  async function insertUsageEvents(deviceId, events, executor = pool) {
    if (!events.length) return;
    const sql = `INSERT INTO usage_events (
      device_id, client, session_id, model, provider, project_id, project_label, recorded_at,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
      message_count_delta, price_input_per_million, price_output_per_million,
      price_cache_read_per_million, price_cache_write_per_million, pricing_source,
      pricing_snapshot_at, cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const event of events) {
      await executor.execute(sql, [
        deviceId, event.client, event.sessionId, event.model, event.provider, event.projectId,
        event.projectLabel, date(event.recordedAt), event.inputTokens, event.outputTokens,
        event.cacheReadTokens, event.cacheWriteTokens, event.reasoningTokens, event.messageCount,
        event.priceInputPerMillion, event.priceOutputPerMillion, event.priceCacheReadPerMillion,
        event.priceCacheWritePerMillion, event.pricingSource, event.pricingSnapshotAt ? date(event.pricingSnapshotAt) : null,
        event.costUsd
      ]);
    }
  }

  async function replaceSessions(deviceId, summaries, executor = pool) {
    // This is a mutable materialized view of the latest all-time snapshot, not
    // the immutable event ledger. Replacing it also makes a device-side counter
    // reset visible without rewriting any usage_events rows.
    await executor.execute('DELETE FROM sessions WHERE device_id = ?', [deviceId]);
    for (const summary of summaries) {
      await executor.execute(`INSERT INTO sessions (
        device_id, client, session_id, total_tokens, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, reasoning_tokens, message_count, cost_usd,
        started_at, last_used_at, models
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE total_tokens = VALUES(total_tokens), input_tokens = VALUES(input_tokens),
        output_tokens = VALUES(output_tokens), cache_read_tokens = VALUES(cache_read_tokens),
        cache_write_tokens = VALUES(cache_write_tokens), reasoning_tokens = VALUES(reasoning_tokens),
        message_count = VALUES(message_count), cost_usd = VALUES(cost_usd), started_at = VALUES(started_at),
        last_used_at = VALUES(last_used_at), models = VALUES(models)`, [
        deviceId, summary.client, summary.sessionId, summary.totalTokens, summary.inputTokens,
        summary.outputTokens, summary.cacheReadTokens, summary.cacheWriteTokens, summary.reasoningTokens,
        summary.messageCount, summary.costUsd, date(summary.startedAt), date(summary.lastUsedAt), JSON.stringify(summary.models)
      ]);
    }
  }

  async function deleteDevice(deviceId, executor = pool) {
    await executor.execute('DELETE FROM sessions WHERE device_id = ?', [deviceId]);
    // DELETE is a display operation, not a counter reset. Keep both the ingest
    // baseline and immutable ledger identity so re-ingesting the same cumulative
    // snapshot produces a zero delta instead of counting its history twice.
    const [result] = await executor.execute(
      'UPDATE devices SET deleted_at = CURRENT_TIMESTAMP(3) WHERE device_id = ? AND deleted_at IS NULL',
      [deviceId]
    );
    return Number(result.affectedRows || 0) > 0;
  }

  async function renameDevice(previousDeviceId, nextDeviceId, executor = pool) {
    const previousId = String(previousDeviceId || '').trim();
    const nextId = String(nextDeviceId || '').trim();
    if (!previousId || !nextId) return { renamed: false, reason: 'device_id_required' };
    if (previousId === nextId) return { renamed: true, deviceId: nextId, unchanged: true };
    const [rows] = await executor.execute(
      'SELECT device_id FROM devices WHERE device_id IN (?, ?) FOR UPDATE',
      [previousId, nextId]
    );
    const ids = new Set(rows.map((row) => String(row.device_id)));
    if (!ids.has(previousId)) return { renamed: false, reason: 'not_found' };
    if (ids.has(nextId)) return { renamed: false, reason: 'target_exists' };
    const existing = await getDeviceRecord(previousId, executor);
    if (!existing) return { renamed: false, reason: 'baseline_missing' };

    await saveDevice({ ...existing, deviceId: nextId }, executor);
    await executor.execute('UPDATE usage_events SET device_id = ? WHERE device_id = ?', [nextId, previousId]);
    await executor.execute('UPDATE sessions SET device_id = ? WHERE device_id = ?', [nextId, previousId]);
    await executor.execute('DELETE FROM device_ingest_state WHERE device_id = ?', [previousId]);
    await executor.execute('DELETE FROM devices WHERE device_id = ?', [previousId]);
    return { renamed: true, deviceId: nextId, previousDeviceId: previousId };
  }

  async function listKnownModels(executor = pool) {
    const [rows] = await executor.query("SELECT DISTINCT model FROM usage_events WHERE model <> 'unknown' ORDER BY model");
    const models = new Set(rows.map((row) => row.model));
    for (const record of await listDeviceRecords(executor)) {
      for (const model of allPeriodModels(record)) if (model && model !== 'unknown') models.add(model);
    }
    return [...models].sort((a, b) => a.localeCompare(b));
  }

  async function aggregateUsageRange({ from, to }, executor = pool) {
    const fromAt = date(from);
    const toAt = date(to);
    const result = emptyUsageRange();
    if (!(fromAt.getTime() < toAt.getTime())) return result;

    const [countRows] = await executor.execute(
      'SELECT COUNT(*) AS count FROM usage_events WHERE recorded_at >= ? AND recorded_at < ?',
      [fromAt, toAt]
    );
    result.eventCount = Number(countRows[0]?.count || 0);
    if (result.eventCount === 0) return result;

    const [rows] = await executor.execute(`
      SELECT
        client,
        model,
        SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) AS tokens,
        SUM(cost_usd) AS cost_usd
      FROM usage_events
      WHERE recorded_at >= ? AND recorded_at < ?
      GROUP BY client, model
    `, [fromAt, toAt]);

    for (const row of rows) {
      const tokens = Math.round(number(row.tokens));
      const cost = number(row.cost_usd);
      const client = safeDynamicKey(row.client);
      const model = safeDynamicKey(row.model);
      result.totalTokens += tokens;
      result.costUsd += cost;
      addTokenCost(result.clients, result.clientCosts, client, tokens, cost);
      addTokenCost(result.models, result.modelCosts, model, tokens, cost);
      const clientModels = ensureNestedMap(result.clientModels, client);
      const clientModelCosts = ensureNestedMap(result.clientModelCosts, client);
      clientModels[model] = mapNumber(clientModels, model) + tokens;
      clientModelCosts[model] = mapNumber(clientModelCosts, model) + cost;
    }
    return result;
  }

  const RETRYABLE_SQL_ERRORS = new Set([
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ER_SERVER_SHUTDOWN'
  ]);

  async function transaction(work) {
    let lastError = null;
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let connection;
      try {
        connection = await pool.getConnection();
      } catch (connErr) {
        if (attempt < maxAttempts && RETRYABLE_SQL_ERRORS.has(connErr?.code)) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        throw connErr;
      }
      try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
      } catch (error) {
        try { await connection.rollback(); } catch (_) {}
        if (attempt < maxAttempts && RETRYABLE_SQL_ERRORS.has(error?.code)) {
          lastError = error;
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        throw error;
      } finally {
        try { connection.release(); } catch (_) {}
      }
    }
    throw lastError;
  }

  return {
    aggregateUsageRange,
    countDevices,
    deleteDevice,
    getDeviceRecord,
    getHubAccount,
    getHubAccountCredential,
    getHubAccountSnapshot,
    getPricing,
    getSubscriptions,
    insertUsageEvents,
    appendHubAccountAudit,
    createHubAccount,
    deleteHubAccount,
    findHubAccount,
    listHubAccounts,
    listDeviceRecords,
    listKnownModels,
    listPricing,
    renameDevice,
    replaceHubAccountCredential,
    replaceSessions,
    saveHubAccountSnapshot,
    saveDevice,
    setSubscriptions,
    transaction,
    updateHubAccount,
    upsertPricing
  };
}

module.exports = { createMySqlPool, createRepository, parseJson, emptyUsageRange };
