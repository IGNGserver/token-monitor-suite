'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const test = require('node:test');

const {
  buildDeepSeekHarnessHistoryGraph,
  buildDeepSeekHarnessPeriods,
  buildDeepSeekHarnessRangeJson,
  collectDeepSeekHarnessRows,
  decodeZstdFrames,
  resolveDeepSeekHarnessHome
} = require('../../src/shared/deepseekHarnessUsage');
const { collectCustomRangeOnce, collectUsageOnce } = require('../../src/shared/collector');
const { extractUsageFromTokscale, normalizeClientName } = require('../../src/shared/usage');

function makeRoot(prefix = 'deepseek-harness-usage-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeRawSession(root, id, lines, name = 'session.jsonl') {
  const directory = path.join(root, `--project-${id}--`, id);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  return filePath;
}

function sessionFixture(id = 'session-1') {
  const createdAt = Date.parse('2026-08-20T01:00:00.000Z');
  const header = {
    type: 'session', version: 0, id, createdAt, cwd: '/workspace/demo', delegationDepth: 0
  };
  const first = {
    type: 'assistant/message', seq: 2, time: Date.parse('2026-08-20T01:01:00.000Z'),
    data: {
      turn: 0,
      step: 0,
      message: { source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, reasoningTokens: 10 }
    }
  };
  const second = {
    type: 'assistant/message', seq: 5, time: Date.parse('2026-08-20T01:02:00.000Z'),
    data: {
      turn: 1,
      step: 0,
      message: { source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-pro' } },
      usage: { prompt_tokens: 50, prompt_tokens_details: { cached_tokens: 8 }, completion_tokens: 5 }
    }
  };
  return { header, first, second };
}

test('DeepSeek Harness resolves DSH_HOME and preserves the upstream client id', () => {
  assert.equal(normalizeClientName('DeepSeek Harness'), 'deepseek-harness');
  assert.equal(normalizeClientName('deepseek'), 'deepseek');
  assert.equal(
    resolveDeepSeekHarnessHome({ homeDir: '/tmp/test-home', env: { DSH_HOME: '~/custom-dsh' } }),
    '/tmp/test-home/custom-dsh'
  );
});

test('DeepSeek Harness raw logs count assistant messages, not chunks, and skip seeded events', () => {
  const root = makeRoot();
  try {
    const fixture = sessionFixture();
    writeRawSession(root, fixture.header.id, [
      { ...fixture.header, seedLength: 2 },
      { type: 'assistant/message', seq: 0, time: fixture.first.time, data: fixture.first.data, usage: { inputTokens: 999, outputTokens: 1 } },
      { type: 'text-chunks', seq: 1, time: fixture.first.time, data: { chunks: ['packed'] } },
      fixture.first,
      { type: 'assistant/chunk', seq: 3, time: fixture.first.time, data: { chunk: { type: 'text-delta', delta: 'ignored' } } },
      { type: 'reasoning-chunks', seq: 4, time: fixture.second.time, data: { chunks: ['packed'] } },
      fixture.second
    ]);

    const rows = collectDeepSeekHarnessRows({ sessionsDir: root });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.model), ['deepseek-v4-flash', 'deepseek-v4-pro']);
    assert.deepEqual(rows[0], {
      client: 'deepseek-harness',
      sessionId: 'session-1',
      model: 'deepseek-v4-flash',
      provider: 'deepseek-official',
      input: 100,
      output: 20,
      cacheRead: 30,
      cacheWrite: 0,
      reasoning: 10,
      messageCount: 1,
      startedAt: '2026-08-20T01:00:00.000Z',
      lastUsedAt: '2026-08-20T01:01:00.000Z',
      createdAt: Date.parse('2026-08-20T01:01:00.000Z'),
      projectLabel: '/workspace/demo'
    });

    const periods = buildDeepSeekHarnessPeriods({
      now: '2026-08-20T03:00:00.000Z',
      allTimeSince: '2026-01-01',
      rows,
      pricingByModel: {
        'deepseek-v4-flash': { inputCostPerToken: 0.001, outputCostPerToken: 0.002, cacheReadInputTokenCost: 0.0001 },
        'deepseek-v4-pro': { inputCostPerToken: 0.002, outputCostPerToken: 0.003, cacheReadInputTokenCost: 0.0001 }
      }
    });
    const today = extractUsageFromTokscale(periods.today);
    assert.equal(today.totalTokens, 205);
    assert.equal(today.clients['deepseek-harness'], 205);
    assert.equal(today.cacheReadTokens, 38);
    assert.equal(today.outputTokens, 25);
    assert.equal(today.sessions['deepseek-harness:session-1'].startedAt, '2026-08-20T01:00:00.000Z');
    assert.equal(today.sessions['deepseek-harness:session-1'].lastUsedAt, '2026-08-20T01:02:00.000Z');
    assert.ok(Math.abs(today.costUsd - 0.2428) < 1e-12);

    const graph = buildDeepSeekHarnessHistoryGraph({ rows });
    assert.deepEqual(graph.contributions[0].clients[0].client, 'deepseek-harness');
    assert.equal(
      graph.contributions[0].clients.reduce((total, client) => total + client.tokens.input, 0),
      142
    );

    const ranged = extractUsageFromTokscale(buildDeepSeekHarnessRangeJson({
      startMs: Date.parse('2026-08-20T01:02:00.000Z'),
      endMs: Date.parse('2026-08-20T01:02:00.000Z')
    }, { rows }));
    assert.equal(ranged.totalTokens, 55);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('DeepSeek Harness decodes every complete zstd frame and ignores a torn final frame', () => {
  if (typeof zlib.zstdCompressSync !== 'function') {
    assert.ok(true, 'runtime has no zstd encoder; compressed fixture skipped');
    return;
  }
  const fixture = sessionFixture('compressed-session');
  const eventLines = [fixture.first, fixture.second].map((line) => Buffer.from(`${JSON.stringify(line)}\n`));
  const frames = [
    JSON.stringify(fixture.header) + '\n',
    eventLines[0].toString(),
    eventLines[1].toString()
  ].map((line) => zlib.zstdCompressSync(Buffer.from(line)));
  const complete = Buffer.concat(frames);
  assert.match(decodeZstdFrames(complete).toString(), /deepseek-v4-pro/);

  const root = makeRoot();
  try {
    const directory = path.join(root, '--compressed--', fixture.header.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'session.jsonl.zstd'), Buffer.concat([
      frames[0], frames[1], frames[2].subarray(0, Math.max(1, frames[2].length - 3))
    ]));
    const rows = collectDeepSeekHarnessRows({ sessionsDir: root });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].model, 'deepseek-v4-flash');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('collector uses the local Harness adapter without invoking tokscale for it', async () => {
  const home = makeRoot('deepseek-harness-collector-');
  try {
    const fixture = sessionFixture('collector-session');
    writeRawSession(path.join(home, '.dsh', 'sessions'), fixture.header.id, [fixture.header, fixture.first]);
    let tokScaleCalls = 0;
    const summary = await collectUsageOnce({
      clients: 'deepseek-harness',
      homeDir: home,
      env: {},
      now: '2026-08-20T03:00:00.000Z',
      allTimeSince: '2026-01-01',
      commandTimeoutMs: 1000,
      deviceId: 'dsh-test',
      limitsEnabled: false,
      historyEnabled: false,
      wslScanEnabled: false,
      lookupModelPricing: async () => { throw new Error('pricing unavailable'); },
      pricingRevision: 'test',
      runTokscale: async () => {
        tokScaleCalls += 1;
        return { entries: [] };
      }
    });
    assert.equal(tokScaleCalls, 0);
    assert.equal(summary.today.totalTokens, 150);
    assert.equal(summary.today.clients['deepseek-harness'], 150);
    assert.equal(summary.allTime.totalTokens, 150);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('custom ranges include DeepSeek Harness assistant messages', async () => {
  const home = makeRoot('deepseek-harness-range-');
  try {
    const fixture = sessionFixture('range-session');
    const rangeHeader = { ...fixture.header, createdAt: Date.parse('2026-08-20T00:00:00.000Z') };
    const rangeFirst = { ...fixture.first, time: Date.parse('2026-08-20T00:01:00.000Z') };
    writeRawSession(path.join(home, '.dsh', 'sessions'), fixture.header.id, [rangeHeader, rangeFirst, fixture.second]);
    const result = await collectCustomRangeOnce({
      clients: 'deepseek-harness',
      homeDir: home,
      env: {},
      range: {
        startDate: '2026-08-20',
        endDate: '2026-08-20',
        startHour: 9,
        endHour: 9
      },
      lookupModelPricing: async () => { throw new Error('pricing unavailable'); },
      pricingRevision: 'test'
    });
    assert.equal(result.period.totalTokens, 55);
    assert.equal(result.period.clients['deepseek-harness'], 55);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
