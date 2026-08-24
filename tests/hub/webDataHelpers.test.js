'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dataPath = path.join(__dirname, '../../src/hub/web/js/data.js');
const source = fs.readFileSync(dataPath, 'utf8');

/** @type {Awaited<typeof import('../../src/hub/web/js/data.js')>} */
let dataApi;

test.before(async () => {
  dataApi = await import(pathToFileUrl(dataPath));
});

function pathToFileUrl(filePath) {
  const resolved = path.resolve(filePath);
  const normalized = resolved.split(path.sep).join('/');
  if (/^[A-Za-z]:/.test(normalized)) return 'file:///' + normalized;
  return 'file://' + normalized;
}

test('hub web data exports expected helper surface', () => {
  assert.match(source, /export function devicePlatformLabel\(/);
  assert.match(source, /export function countActiveDays\(/);
  assert.match(source, /export function heatmapValue\(/);
  assert.match(source, /export function providerDisplayName\(/);
  assert.match(source, /export function statusRows\(/);
  assert.match(source, /export const MAX_SESSION_ROWS/);
  assert.match(source, /export function limitRemainingTone\(/);
  assert.match(source, /export function clampHomeLimitAccountCount\(/);
  assert.match(source, /openrouter:\s*'OpenRouter'/);
});

test('openrouter client icon is published for hub web', () => {
  const icon = path.join(__dirname, '../../src/hub/web/icons/clients/openrouter.svg');
  assert.equal(fs.existsSync(icon), true);
  const svg = fs.readFileSync(icon, 'utf8');
  assert.match(svg, /OpenRouter|openrouter/i);
});

test('hub web app wires status, heatmap, and active-days controls', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../src/hub/web/js/app.js'), 'utf8');
  assert.match(app, /data-heatmap-metric|heatmap-metric/);
  assert.match(app, /data-active-days-window|active-days-window/);
  assert.match(app, /data-device-period|deviceDetailPeriod/);
  assert.match(app, /renderHeatmap\(/);
  assert.match(app, /devicePlatformLabel\(/);
  assert.match(app, /id: 'status'/);
  assert.match(app, /function renderStatus/);
  assert.match(app, /homeLimitAccountCount/);
  assert.match(app, /limitRemainingTone/);
  assert.match(app, /projects\.incomplete|sessions\.truncated/);
  assert.match(app, /id: 'subscriptions'/);
  assert.match(app, /id: 'pricing'/);
  assert.match(app, /historyRevision|deviceHistoryRevision/);
  assert.match(app, /data-subscription-form/);
  assert.match(app, /data-pricing-form/);
});

test('devicePlatformLabel / countActiveDays / heatmapValue behavior', () => {
  const { devicePlatformLabel, countActiveDays, heatmapValue } = dataApi;
  assert.equal(devicePlatformLabel('win32', 'Windows', '11'), 'Windows 11');
  assert.equal(devicePlatformLabel('darwin', 'macOS', '14.5'), 'macOS 14.5');
  assert.equal(devicePlatformLabel('linux'), 'Linux');

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const recent = new Date(today);
  recent.setUTCDate(recent.getUTCDate() - 10);
  const old = new Date(today);
  old.setUTCDate(old.getUTCDate() - 400);
  const days = [
    { date: iso(recent), tokens: 10, cost: 0.1 },
    { date: iso(old), tokens: 20, cost: 0.2 },
    { date: iso(today), tokens: 0, cost: 0 }
  ];
  assert.equal(countActiveDays(days, 'all'), 2);
  assert.equal(countActiveDays(days, 'year'), 1);
  assert.equal(heatmapValue({ tokens: 100, cost: 1.5 }, 'tokens'), 100);
  assert.equal(heatmapValue({ tokens: 100, cost: 1.5 }, 'cost'), 1.5);
});

test('agentRuntimeLabel normalizes common runtimes', () => {
  const { agentRuntimeLabel } = dataApi;
  assert.equal(agentRuntimeLabel('headless-agent'), 'headless-agent');
  assert.equal(agentRuntimeLabel('electron-widget'), 'widget');
  assert.equal(agentRuntimeLabel(''), '');
});

test('clientStatusEntries and wslStatusSummary filter wire shapes', () => {
  const { clientStatusEntries, wslStatusSummary } = dataApi;
  assert.deepEqual(
    clientStatusEntries({ codex: 'active', nope: 'weird', cursor: 'missing' }),
    [
      { client: 'codex', state: 'active' },
      { client: 'cursor', state: 'missing' }
    ]
  );
  assert.equal(wslStatusSummary({ state: 'broken' }), null);
  assert.deepEqual(wslStatusSummary({ state: 'active', detected: ['codex'], withData: ['codex'] }), {
    state: 'active',
    detected: ['codex'],
    withData: ['codex']
  });
});

test('deviceRows expose runtime and status fields', () => {
  const { deviceRows } = dataApi;
  const rows = deviceRows({
    devices: [{
      deviceId: 'd1',
      hostname: 'desk',
      platform: 'win32',
      osName: 'Windows',
      osVersion: '11',
      agentRuntime: 'headless-agent',
      clientStatus: { codex: 'active' },
      wslStatus: { state: 'not-running', detected: [], withData: [] },
      periods: { today: { totalTokens: 10, costUsd: 0.1 } }
    }]
  }, 'today');
  assert.equal(rows[0].agentRuntimeLabel, 'headless-agent');
  assert.equal(rows[0].clientStatus.codex, 'active');
  assert.equal(rows[0].wslStatus.state, 'not-running');
});

test('limitCards separates balance without inventing spend meter', () => {
  const { limitCards } = dataApi;
  const cards = limitCards({
    limits: {
      providers: [{
        provider: 'openrouter',
        accountLabel: 'or-main',
        balanceUsd: 12.5,
        balance: { amount: 80, currency: 'CNY' },
        resetCredits: { availableCount: 2, totalCount: 5 },
        windows: [{
          kind: 'weekly',
          label: 'Weekly',
          remainingPercent: 40,
          metric: 'credits'
        }]
      }]
    }
  });
  assert.equal(cards.length, 1);
  const kinds = cards[0].windows.map((w) => w.kind);
  assert.ok(kinds.includes('weekly'));
  assert.ok(kinds.includes('balanceUsd'));
  assert.ok(kinds.includes('balance'));
  assert.ok(kinds.includes('resetCredits'));
  const balance = cards[0].windows.find((w) => w.kind === 'balance');
  assert.equal(balance.showMeter, false);
  assert.equal(balance.value.includes('80'), true);
  const credits = cards[0].windows.find((w) => w.kind === 'weekly');
  assert.equal(credits.metric, 'credits');
});

test('providerDisplayName and planLabel handle identity fields', () => {
  const { providerDisplayName, providerPlanLabel } = dataApi;
  assert.equal(
    providerDisplayName({ provider: 'openrouter', accountLabel: 'or-main', accountEmail: 'a@b.com' }),
    'or-main'
  );
  assert.equal(
    providerPlanLabel({ planLabel: 'Plus', plan: 'old', accountLabel: 'legacy' }),
    'Plus'
  );
  assert.equal(
    providerDisplayName({ provider: 'codex', accountEmail: 'u@x.com', workspaceKind: 'personal' }, [], 'en'),
    'u@x.com'
  );
  const peers = [
    { provider: 'codex', accountEmail: 'u@x.com', accountName: 'Work' },
    { provider: 'codex', accountEmail: 'u@x.com', accountName: 'Home' }
  ];
  assert.equal(providerDisplayName(peers[0], peers, 'en'), 'u@x.com · Work');
});

test('projectRows returns incomplete flag and client color', () => {
  const { projectRows } = dataApi;
  const result = projectRows({
    projects: {
      p1: { label: 'Repo', tokens: 10, costUsd: 0.1, clients: { codex: 10 } }
    }
  }, { incomplete: true });
  assert.equal(result.incomplete, true);
  assert.equal(result.rows[0].name, 'Repo');
  assert.ok(result.rows[0].color);
});

test('sessionRows truncates large collections', () => {
  const { sessionRows, MAX_SESSION_ROWS } = dataApi;
  const sessions = {};
  for (let i = 0; i < 5; i += 1) {
    sessions['codex:s' + i] = {
      client: 'codex',
      sessionId: 's' + i,
      totalTokens: 10 + i,
      costUsd: 0.01,
      lastUsedAt: '2026-01-0' + (i + 1) + 'T00:00:00Z'
    };
  }
  const result = sessionRows({ sessions }, { limit: 3 });
  assert.equal(result.total, 5);
  assert.equal(result.rows.length, 3);
  assert.equal(result.truncated, true);
  assert.equal(MAX_SESSION_ROWS, 200);
});

test('deviceBreakdownRows includes nested client models', () => {
  const { deviceBreakdownRows } = dataApi;
  const breakdown = deviceBreakdownRows({
    periods: {
      today: {
        totalTokens: 100,
        costUsd: 1,
        clients: { codex: 100 },
        clientCosts: { codex: 1 },
        models: { 'gpt-5': 100 },
        modelCosts: { 'gpt-5': 1 },
        clientModels: { codex: { 'gpt-5': 100 } },
        clientModelCosts: { codex: { 'gpt-5': 1 } }
      }
    }
  }, 'today');
  assert.equal(breakdown.tools[0].models[0].key, 'gpt-5');
  assert.equal(breakdown.tools[0].models[0].value, 100);
});

test('statusRows marks health from stale/status', () => {
  const { statusRows } = dataApi;
  const rows = statusRows({
    limits: {
      providers: [
        { provider: 'openrouter', status: 'ok', windows: [] },
        { provider: 'deepseek', status: 'error', stale: true, windows: [] }
      ]
    }
  });
  assert.ok(rows.some((r) => r.health === 'ok'));
  assert.ok(rows.some((r) => r.health === 'stale'));
});

test('limitCards uses planLabel and openrouter identity', () => {
  const { limitCards } = dataApi;
  const cards = limitCards({
    limits: {
      providers: [{
        provider: 'openrouter',
        accountName: 'OR Key',
        planLabel: 'Credits',
        accountEmail: 'or@example.com',
        windows: [{ kind: 'weekly', label: 'Weekly', remainingPercent: 20, metric: 'credits', detail: 'mgmt key' }]
      }]
    }
  });
  assert.equal(cards[0].name, 'OR Key');
  assert.equal(cards[0].plan, 'Credits');
  assert.equal(cards[0].windows[0].detail, 'mgmt key');
});


test('limitRemainingTone matches desktop thresholds', () => {
  const { limitRemainingTone, clampHomeLimitAccountCount } = dataApi;
  assert.equal(limitRemainingTone(100), 'ok');
  assert.equal(limitRemainingTone(50), 'ok');
  assert.equal(limitRemainingTone(49.9), 'warn');
  assert.equal(limitRemainingTone(20), 'warn');
  assert.equal(limitRemainingTone(19.9), 'critical');
  assert.equal(limitRemainingTone(null), 'unknown');
  assert.equal(clampHomeLimitAccountCount(3), 3);
  assert.equal(clampHomeLimitAccountCount(0), 1);
  assert.equal(clampHomeLimitAccountCount(99), 12);
  assert.equal(clampHomeLimitAccountCount('x', 3), 3);
});


test('hub web app wires tool drill and trends stack', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../src/hub/web/js/app.js'), 'utf8');
  assert.match(app, /function renderTools\(/);
  assert.match(app, /data-select-tool/);
  assert.match(app, /selectedToolId/);
  assert.match(app, /clientModels/);
  assert.match(app, /trendsStack/);
  assert.match(app, /ensureHistory/);
  assert.match(app, /\/api\/history/);
  assert.match(app, /modelColor/);
  assert.match(app, /clampHomeLimitAccountCount,\s*[\r\n\s]*modelColor/);
});
