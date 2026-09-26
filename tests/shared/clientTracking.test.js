'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  TRACKED_CLIENTS,
  normalizeClientsCsv
} = require('../../src/shared/clientTracking');

test('the tracked set is one non-empty, normalized csv', () => {
  assert.equal(typeof TRACKED_CLIENTS, 'string');
  const clients = TRACKED_CLIENTS.split(',');
  assert.ok(clients.length >= 50, `expected the wired client set, saw ${clients.length}`);
  assert.equal(normalizeClientsCsv(TRACKED_CLIENTS), TRACKED_CLIENTS);
  assert.equal(new Set(clients).size, clients.length, 'a client id must not repeat');
});

test('the tracked set still covers every current tokscale-supported tool', () => {
  const clients = TRACKED_CLIENTS.split(',');
  for (const client of ['cline', 'kimi', 'qwen', 'grok', 'copilot', 'pi', 'zed', 'kilocode', 'zcode', 'kiro', 'codebuddy', 'workbuddy']) {
    assert.ok(clients.includes(client), `${client} should be tracked`);
  }
  for (const client of ['claude-desktop', 'deepseek-harness']) {
    assert.ok(clients.includes(client), `${client} should be tracked`);
  }
});

test('micode and both Qoder sites are tracked (the selection surface is gone)', () => {
  // micode double-counts claude-import sessions in mimocode.db until tokscale
  // dedups them, and the Qoder sites are estimate-marked local adapters. They
  // used to be opt-in through Settings → Tracked tools; with that UI removed,
  // excluding them would make the data unreachable, so they are locked in like
  // every other wired client.
  const clients = TRACKED_CLIENTS.split(',');
  for (const client of ['micode', 'qoder', 'qodercn']) {
    assert.ok(clients.includes(client), `${client} must be tracked`);
  }
});

test('the two Qoder sites sit adjacent', () => {
  // Cosmetic but load-bearing for every client list a view renders: the two
  // editions of one product belong next to each other rather than scattered by
  // insertion history.
  const clients = TRACKED_CLIENTS.split(',');
  assert.equal(clients.indexOf('qoder'), clients.indexOf('qodercn') - 1);
});

test('every tracked client is accepted by bundled tokscale', () => {
  const locallyParsedClients = new Set(['proma', 'claude-desktop', 'qoder', 'qodercn']);
  // Ids we track but tokscale spells differently. The collector renames them
  // before building `--client`, so the upstream spelling is what has to exist in
  // the enum. A wrong id is a hard usage error (exit 2), not a silently dropped
  // filter — which is why this test checks the rename.
  const tokscaleSpellings = { 'deepseek-harness': 'dsh' };
  const result = spawnSync(process.execPath, [require.resolve('tokscale/bin.js'), '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const help = `${result.stdout || ''}\n${result.stderr || ''}`;
  const possibleValues = help.match(/\[possible values: ([^\]]+)\]/);
  assert.ok(possibleValues, 'tokscale --help should list --client possible values');
  const supported = new Set(possibleValues[1].split(',').map((client) => client.trim()).filter(Boolean));
  const unsupported = TRACKED_CLIENTS.split(',').filter((client) => {
    if (locallyParsedClients.has(client)) return false;
    return !supported.has(tokscaleSpellings[client] || client);
  });
  assert.deepEqual(unsupported, []);
  // Neither Qoder site is in the enum at all, so passing one through would fail
  // the whole scan for every other client in the same call. That is the reason
  // LOCAL_PARSED_CLIENTS in collector.js has to filter both ids out of the CSV,
  // and this assertion is what fails if tokscale ever grows a Qoder entry (at
  // which point the local adapter becomes redundant and should be revisited).
  for (const client of ['qoder', 'qodercn']) {
    assert.ok(!supported.has(client), `tokscale unexpectedly accepts ${client}`);
  }
});

test('normalizeClientsCsv trims, lowercases, and drops empty entries', () => {
  assert.equal(normalizeClientsCsv(' Claude , Codex,,hermes '), 'claude,codex,hermes');
  assert.equal(normalizeClientsCsv(undefined), '');
  assert.equal(normalizeClientsCsv(''), '');
});