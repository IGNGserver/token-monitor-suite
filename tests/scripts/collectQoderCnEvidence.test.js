'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

let sqlite = null;
try { sqlite = require('node:sqlite'); } catch (_) { sqlite = null; }

const {
  collectQoderCnEvidence,
  parseArgs,
  versionFromFile
} = require('../../scripts/collect-qoder-cn-evidence');

function temporaryHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qodercn-evidence-'));
}

test('parseArgs supports target-machine evidence options without accepting arbitrary flags', () => {
  assert.deepEqual(parseArgs([
    '--qoder-cn-version=0.1.2',
    '--version-file', '/tmp/QoderCN/Info.plist',
    '--require-version',
    '--require-data'
  ]), {
    homeDir: '',
    qoderCnVersion: '0.1.2',
    versionFile: '/tmp/QoderCN/Info.plist',
    requireData: true,
    requireVersion: true,
    help: false
  });
  assert.throws(() => parseArgs(['--unsupported']), /unsupported option/);
});

test('versionFromFile reads a version field without exposing the manifest path', () => {
  const home = temporaryHome();
  const manifest = path.join(home, 'Info.plist');
  fs.writeFileSync(manifest, '<key>CFBundleShortVersionString</key><string>0.1.7</string>\n');
  assert.equal(versionFromFile(manifest), '0.1.7');
  fs.rmSync(home, { recursive: true, force: true });
});

test('collectQoderCnEvidence reports redacted transcript and period evidence', async () => {
  const home = temporaryHome();
  const configRoot = path.join(home, '.qoder-cn');
  const projects = path.join(configRoot, 'projects', 'private-project');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'session.jsonl'), `${JSON.stringify({
    uuid: 'private-request-id',
    timestamp: '2026-08-15T10:00:00Z',
    message: {
      role: 'assistant',
      content: 'private transcript content must not be emitted',
      model: 'dfmodel',
      usage: { credits: 1 }
    }
  })}\n`);

  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    qoderCnVersion: '0.1.2',
    requireData: true,
    requireVersion: true,
    env: { QODERCN_CONFIG_DIR: configRoot },
    now: '2026-08-15T12:00:00Z'
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.failureCode, null);
  assert.equal(evidence.qoderCn.version.value, '0.1.2');
  assert.equal(evidence.qoderCn.merge.source, 'transcript');
  assert.equal(evidence.qoderCn.merge.mergedRows, 1);
  assert.equal(evidence.qoderCn.merge.estimated, true);
  assert.equal(evidence.qoderCn.periods.today.totalTokens > 0, true);
  assert.equal(evidence.qoderCn.sources.transcript.rootExists, true);
  assert.equal(serialized.includes(home), false, 'source paths must not be emitted');
  assert.equal(serialized.includes('private transcript content'), false, 'transcript content must not be emitted');
  assert.equal(serialized.includes('private-request-id'), false, 'request identities must not be emitted');

  fs.rmSync(home, { recursive: true, force: true });
});

test('requireData keeps an empty target-machine probe explicit instead of passing it', async () => {
  const home = temporaryHome();
  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    qoderCnVersion: '0.1.2',
    requireData: true,
    requireVersion: true,
    env: {}
  });
  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.failureCode, 'QODER_CN_NO_NONZERO_USAGE');
  fs.rmSync(home, { recursive: true, force: true });
});

test('requireData rejects recognized events that produce zero token usage', async () => {
  const home = temporaryHome();
  const projects = path.join(home, '.qoder-cn', 'projects', 'empty');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'session.jsonl'), `${JSON.stringify({
    type: 'assistant',
    timestamp: '2026-08-15T10:00:00Z',
    message: { role: 'assistant', content: '', model: 'dfmodel' }
  })}\n`);

  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    qoderCnVersion: '0.1.2',
    requireData: true,
    requireVersion: true,
    env: { QODERCN_CONFIG_DIR: path.join(home, '.qoder-cn') },
    now: '2026-08-15T12:00:00Z'
  });
  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.failureCode, 'QODER_CN_NO_NONZERO_USAGE');
  assert.equal(evidence.qoderCn.merge.mergedRows, 1);
  assert.equal(evidence.qoderCn.periods.allTime.totalTokens, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test('collectQoderCnEvidence reports a corrupt SQLite source as FAIL', async () => {
  const home = temporaryHome();
  const dbPath = path.join(home, 'local.db');
  fs.writeFileSync(dbPath, 'this is not a SQLite database');
  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    qoderCnVersion: '0.1.2',
    env: { TOKEN_MONITOR_QODER_CN_DB_PATH: dbPath }
  });
  assert.equal(evidence.status, 'FAIL');
  assert.equal(evidence.qoderCn.sources.legacyDb[0].integrity.status, 'failed');
  assert.equal(evidence.failureCode, 'QODER_CN_SQLITE_INTEGRITY_FAILED');
  assert.equal(JSON.stringify(evidence).includes(dbPath), false, 'failure evidence must not expose source paths');
  fs.rmSync(home, { recursive: true, force: true });
});

(sqlite ? test : test.skip)('collectQoderCnEvidence reports the real 0.1.x main.sqlite source', async (t) => {
  const home = temporaryHome();
  const dbPath = path.join(home, 'main.sqlite');
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const database = new sqlite.DatabaseSync(dbPath);
  database.exec(`CREATE TABLE chat_sessions (session_id TEXT PRIMARY KEY, model TEXT);
    CREATE TABLE chat_session_messages (
      session_id TEXT NOT NULL, message_id TEXT NOT NULL, sequence INTEGER NOT NULL,
      payload_json TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );`);
  database.prepare('INSERT INTO chat_sessions (session_id, model) VALUES (?, ?)').run('s1', 'qfmodel');
  const insert = database.prepare(`INSERT INTO chat_session_messages
    (session_id, message_id, sequence, payload_json, status, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'completed', 'local', ?, ?)`);
  const timestamp = Date.parse('2026-09-03T10:00:00.000Z');
  insert.run('s1', 'u1', 1, JSON.stringify({ role: 'user', text: 'private prompt', timestamp: new Date(timestamp).toISOString() }), timestamp, timestamp);
  insert.run('s1', 'a1', 2, JSON.stringify({ role: 'assistant', text: 'private answer', timestamp: new Date(timestamp + 1_000).toISOString(), parts: [{ type: 'text', text: 'private answer' }] }), timestamp + 1_000, timestamp + 1_000);
  database.close();

  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    platform: 'win32',
    qoderCnVersion: '0.1.4',
    requireData: true,
    requireVersion: true,
    env: { TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH: dbPath },
    now: '2026-09-03T12:00:00.000Z'
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.qoderCn.sources.mainDb[0].kind, 'main_sqlite');
  assert.equal(evidence.qoderCn.sources.mainDb[0].integrity.status, 'ok');
  assert.equal(evidence.qoderCn.sources.mainDb[0].rows, 1);
  assert.equal(evidence.qoderCn.merge.mainDbRows, 1);
  assert.deepEqual(evidence.qoderCn.merge.usedSources, ['main-sqlite']);
  assert.equal(evidence.qoderCn.merge.estimated, true);
  assert.equal(evidence.qoderCn.periods.allTime.totalTokens > 0, true);
  assert.equal(serialized.includes(dbPath), false, 'main database paths must not be emitted');
  assert.equal(serialized.includes('private answer'), false, 'main database content must not be emitted');
});

(sqlite ? test : test.skip)('collectQoderCnEvidence selects one main.sqlite and reports transcript suppression', async (t) => {
  const home = temporaryHome();
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const appSupport = path.join(home, '.config');
  const sessionId = 'cccccccc-1111-2222-3333-444444444444';

  // A current install plus the stale bundle directory an in-place upgrade can
  // leave behind. Both are readable; only the current one may be billed.
  const mainDbPaths = ['com.qodercn.app.stable', 'com.qoder.app.stable'].map((bundleId) => {
    const dir = path.join(appSupport, bundleId);
    fs.mkdirSync(dir, { recursive: true });
    const dbPath = path.join(dir, 'main.sqlite');
    const database = new sqlite.DatabaseSync(dbPath);
    database.exec(`CREATE TABLE chat_sessions (session_id TEXT PRIMARY KEY, model TEXT);
      CREATE TABLE chat_session_messages (
        session_id TEXT NOT NULL, message_id TEXT NOT NULL, sequence INTEGER NOT NULL,
        payload_json TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );`);
    database.prepare('INSERT INTO chat_sessions (session_id, model) VALUES (?, ?)').run(sessionId, 'qfmodel');
    const timestamp = Date.parse('2026-09-03T10:00:00.000Z');
    database.prepare(`INSERT INTO chat_session_messages
      (session_id, message_id, sequence, payload_json, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'completed', 'local', ?, ?)`)
      .run(sessionId, 'a1', 1, JSON.stringify({
        role: 'assistant',
        text: 'private answer',
        timestamp: new Date(timestamp).toISOString()
      }), timestamp, timestamp);
    database.close();
    return dbPath;
  });
  // The CN profile footprint is what makes the shared bundle id attributable.
  fs.mkdirSync(path.join(home, '.qoder-cn'), { recursive: true });

  // The transcript tree covers the same session, so the desktop copy must not be
  // billed on top of it.
  const projects = path.join(home, '.qoder-cn', 'projects', 'private-project');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, `${sessionId}.jsonl`), `${JSON.stringify({
    type: 'assistant',
    sessionId,
    uuid: 'private-request-id',
    timestamp: '2026-09-03T10:00:00Z',
    message: { role: 'assistant', content: 'private transcript content', model: 'qfmodel' }
  })}\n`);

  const evidence = await collectQoderCnEvidence({
    homeDir: home,
    platform: 'linux',
    env: {},
    requireData: true,
    now: '2026-09-03T12:00:00.000Z'
  });

  assert.equal(evidence.status, 'PASS');
  const mainDb = evidence.qoderCn.sources.mainDb;
  assert.deepEqual(mainDb.map((candidate) => candidate.selected), [true, false]);
  assert.deepEqual(mainDb.map((candidate) => candidate.rows), [1, 1], 'both copies are still probed');
  assert.equal(evidence.qoderCn.merge.mainDbRows, 1, 'only the selected copy is billed');
  assert.equal(evidence.qoderCn.merge.suppressedMainRows, 1, 'the transcript tree covers that session');
  assert.equal(evidence.qoderCn.merge.transcriptRows, 1);
  assert.equal(evidence.qoderCn.merge.mergedRows, 1);
  assert.deepEqual(evidence.qoderCn.merge.usedSources, ['transcript']);
  const serialized = JSON.stringify(evidence);
  for (const dbPath of mainDbPaths) {
    assert.equal(serialized.includes(dbPath), false, 'main database paths must not be emitted');
  }
  assert.equal(serialized.includes(sessionId), false, 'session ids must not be emitted');
});
