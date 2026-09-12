'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');

const packageJson = require('../package.json');
const {
  QODER_CN_SQLITE_BACKEND_UNAVAILABLE,
  buildQoderCnPeriods,
  collectQoderCnMainRows,
  collectQoderCnRows,
  collectQoderCnTranscriptRows,
  mergeQoderCnRows,
  qoderCnDataPaths
} = require('../src/shared/qoderCnUsage');

const EVIDENCE_SCHEMA_VERSION = 1;
const MAX_VERSION_FILE_BYTES = 1024 * 1024;
const SAFE_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SAFE_CODE_RE = /^[A-Z0-9_]{1,96}$/;
const TRANSCRIPT_DIAGNOSTIC_KEYS = [
  'rootExists', 'rootsFound', 'candidateFiles', 'readFiles', 'readBytes',
  'recognizedEvents', 'ignoredEvents', 'badJsonLines', 'oversizedFiles',
  'oversizedLines', 'readErrors', 'duplicateRows', 'lastDataAt', 'source',
  'usedSources', 'estimated', 'truncated', 'failureCode', 'maxFiles',
  'maxTotalBytes', 'maxDepth', 'maxDurationMs'
];

function parseArgs(argv = []) {
  const args = {
    homeDir: '',
    qoderCnVersion: '',
    versionFile: '',
    requireData: false,
    requireVersion: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '');
    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }
    if (value === '--require-data') {
      args.requireData = true;
      continue;
    }
    if (value === '--require-version') {
      args.requireVersion = true;
      continue;
    }
    const match = /^(--home-dir|--qoder-cn-version|--version-file)=(.*)$/.exec(value);
    if (match) {
      args[{
        '--home-dir': 'homeDir',
        '--qoder-cn-version': 'qoderCnVersion',
        '--version-file': 'versionFile'
      }[match[1]]] = match[2];
      continue;
    }
    if (value === '--home-dir' || value === '--qoder-cn-version' || value === '--version-file') {
      const next = argv[index + 1];
      if (!next || String(next).startsWith('-')) throw new Error('missing option value');
      args[{
        '--home-dir': 'homeDir',
        '--qoder-cn-version': 'qoderCnVersion',
        '--version-file': 'versionFile'
      }[value]] = String(next);
      index += 1;
      continue;
    }
    throw new Error('unsupported option');
  }
  return args;
}

function safeVersion(value) {
  const normalized = String(value || '').trim();
  return SAFE_VERSION_RE.test(normalized) ? normalized : '';
}

function versionFromFile(filePath, fsImpl = fs) {
  if (!filePath) return '';
  try {
    const stat = fsImpl.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_VERSION_FILE_BYTES) return '';
    const text = fsImpl.readFileSync(filePath, 'utf8');
    try {
      const parsed = JSON.parse(text);
      return safeVersion(parsed?.version || parsed?.productVersion || parsed?.appVersion);
    } catch (_) {
      const xmlMatch = /<key>\s*(?:CFBundleShortVersionString|productVersion|appVersion|version)\s*<\/key>\s*<string>\s*([^<\s]+)\s*<\/string>/i.exec(text);
      if (xmlMatch) return safeVersion(xmlMatch[1]);
      const match = /(?:CFBundleShortVersionString|productVersion|appVersion|version)\s*[=:]\s*["']?([A-Za-z0-9][A-Za-z0-9._+-]{0,63})/i.exec(text);
      return safeVersion(match?.[1]);
    }
  } catch (_) {
    return '';
  }
}

function resolveQoderCnVersion(options = {}, env = process.env, fsImpl = fs) {
  const explicit = safeVersion(options.qoderCnVersion);
  if (explicit) return { value: explicit, source: 'argument', status: 'provided' };
  const fromEnv = safeVersion(env.QODERCN_VERSION);
  if (fromEnv) return { value: fromEnv, source: 'QODERCN_VERSION', status: 'provided' };
  const fromFile = versionFromFile(options.versionFile, fsImpl);
  if (fromFile) return { value: fromFile, source: 'version-file', status: 'provided' };
  if (options.qoderCnVersion || env.QODERCN_VERSION || options.versionFile) {
    return { value: null, source: null, status: 'invalid_or_unreadable' };
  }
  return { value: null, source: null, status: 'not_provided' };
}

function safeFailureCode(value, fallback = null) {
  const normalized = String(value || '').trim().toUpperCase();
  if (SAFE_CODE_RE.test(normalized)) return normalized;
  return fallback;
}

function filePresence(filePath, fsImpl = fs) {
  try {
    const stat = fsImpl.statSync(filePath);
    if (!stat.isFile()) return { exists: false, readable: false, sizeBytes: 0 };
    let readable = true;
    try { fsImpl.accessSync(filePath, fsImpl.constants.R_OK); } catch (_) { readable = false; }
    return { exists: true, readable, sizeBytes: Number(stat.size) || 0 };
  } catch (_) {
    return { exists: false, readable: false, sizeBytes: 0 };
  }
}

function sqliteErrorIsUnavailable(error) {
  return error?.code === 'ENOENT'
    || error?.code === 'MODULE_NOT_FOUND'
    || /(?:node:sqlite|sqlite3).*(?:not available|cannot find|not found|enoent|unknown built-in)/i.test(String(error?.message || error));
}

function quickCheckWithNodeSqlite(dbPath) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (error) {
    return { status: 'unavailable', engine: 'node:sqlite', error };
  }
  let database;
  try {
    database = new DatabaseSync(dbPath, { readOnly: true });
    database.exec('PRAGMA busy_timeout = 250');
    const result = database.prepare('PRAGMA quick_check').get();
    const value = String(result?.quick_check || '').trim().toLowerCase();
    return value === 'ok'
      ? { status: 'ok', engine: 'node:sqlite' }
      : { status: 'failed', engine: 'node:sqlite', error: new Error('quick_check failed') };
  } catch (error) {
    return { status: sqliteErrorIsUnavailable(error) ? 'unavailable' : 'failed', engine: 'node:sqlite', error };
  } finally {
    try { database?.close(); } catch (_) { /* best effort */ }
  }
}

function quickCheckWithCli(dbPath, execFileSyncImpl = execFileSync) {
  try {
    const output = String(execFileSyncImpl('sqlite3', [
      '-readonly', '-cmd', '.timeout 3000', dbPath, 'PRAGMA quick_check;'
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10_000, windowsHide: true }));
    return /^\s*ok\s*$/im.test(output)
      ? { status: 'ok', engine: 'sqlite3' }
      : { status: 'failed', engine: 'sqlite3', error: new Error('quick_check failed') };
  } catch (error) {
    return { status: sqliteErrorIsUnavailable(error) ? 'unavailable' : 'failed', engine: 'sqlite3', error };
  }
}

function quickCheckSqlite(dbPath, deps = {}) {
  const nodeResult = (deps.quickCheckWithNodeSqlite || quickCheckWithNodeSqlite)(dbPath);
  if (nodeResult.status === 'ok' || nodeResult.status === 'failed') return nodeResult;
  const cliResult = (deps.quickCheckWithCli || quickCheckWithCli)(dbPath, deps.execFileSync || execFileSync);
  if (cliResult.status !== 'unavailable') return cliResult;
  return { status: 'unavailable', engine: 'none' };
}

function sanitizeTranscriptDiagnostics(input = {}) {
  const output = {};
  for (const key of TRANSCRIPT_DIAGNOSTIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (key === 'failureCode') output[key] = safeFailureCode(value);
    else if (key === 'source') output[key] = ['none', 'transcript', 'sqlite+transcript', 'sqlite'].includes(value) ? value : 'none';
    else if (key === 'usedSources') output[key] = Array.isArray(value) ? value.filter((item) => ['sqlite', 'transcript'].includes(item)) : [];
    else if (key === 'lastDataAt') output[key] = typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
    else if (typeof value === 'boolean') output[key] = value;
    else if (Number.isFinite(Number(value)) && Number(value) >= 0) output[key] = Number(value);
  }
  return output;
}

function safeModelNames(entries = []) {
  const names = new Set();
  for (const entry of entries) {
    const value = String(entry?.model || '').trim();
    if (!value) continue;
    if (/^[A-Za-z0-9][A-Za-z0-9 ._+:#/-]{0,95}$/.test(value)) names.add(value);
    else names.add(`redacted:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`);
  }
  return [...names].sort();
}

function summarizePeriod(period = {}) {
  const entries = Array.isArray(period.entries) ? period.entries : [];
  return {
    entries: entries.length,
    messages: Number(period.totalMessages) || 0,
    input: Number(period.totalInput) || 0,
    output: Number(period.totalOutput) || 0,
    cacheRead: Number(period.totalCacheRead) || 0,
    cacheWrite: Number(period.totalCacheWrite) || 0,
    totalTokens: (Number(period.totalInput) || 0)
      + (Number(period.totalOutput) || 0)
      + (Number(period.totalCacheRead) || 0)
      + (Number(period.totalCacheWrite) || 0),
    estimated: period.estimated === true || entries.some((entry) => entry?.estimated === true),
    modelNames: safeModelNames(entries),
    attributedProjectEntries: entries.filter((entry) => String(entry?.projectLabel || '').trim()).length
  };
}

function dbStatusFromError(error) {
  if (error?.code === QODER_CN_SQLITE_BACKEND_UNAVAILABLE) return 'backend_unavailable';
  return 'failed';
}

async function collectQoderCnEvidence(options = {}, deps = {}) {
  const fsImpl = deps.fs || fs;
  const env = { ...process.env, ...(options.env || {}) };
  const homeDir = options.homeDir || os.homedir();
  const paths = (deps.qoderCnDataPaths || qoderCnDataPaths)({
    homeDir,
    platform: options.platform || process.platform,
    env
  });
  const version = resolveQoderCnVersion(options, env, fsImpl);
  const dbCandidates = [];
  const databaseRows = [];
  let dbFailure = null;
  const inspectDatabase = async (dbPath, { kind, collectRows, sourceKey }) => {
    const presence = filePresence(dbPath, fsImpl);
    const candidate = {
      kind,
      exists: presence.exists,
      readable: presence.readable,
      sizeBytes: presence.sizeBytes,
      integrity: presence.exists ? quickCheckSqlite(dbPath, deps) : { status: 'not_present', engine: null },
      rows: 0,
      status: presence.exists ? 'pending' : 'not_present',
      failureCode: null
    };
    if (presence.exists && candidate.integrity.status === 'failed') {
      candidate.status = 'failed';
      candidate.failureCode = 'QODER_CN_SQLITE_INTEGRITY_FAILED';
      dbFailure = candidate.failureCode;
    } else if (presence.exists && candidate.integrity.status === 'unavailable') {
      candidate.status = 'backend_unavailable';
      candidate.failureCode = QODER_CN_SQLITE_BACKEND_UNAVAILABLE;
      dbFailure = dbFailure || candidate.failureCode;
    } else if (presence.exists) {
      try {
        const rows = await collectRows({
          homeDir,
          platform: options.platform || process.platform,
          env,
          [sourceKey]: [dbPath]
        });
        candidate.rows = rows.length;
        candidate.status = 'ok';
        databaseRows.push(...rows);
      } catch (error) {
        candidate.status = dbStatusFromError(error);
        candidate.failureCode = safeFailureCode(error?.code, 'QODER_CN_DB_READ_FAILED');
        dbFailure = dbFailure || candidate.failureCode;
      }
    }
    dbCandidates.push(candidate);
  };
  for (const dbPath of paths.dbPaths || []) {
    await inspectDatabase(dbPath, {
      kind: 'legacy_sqlite',
      collectRows: deps.collectQoderCnRows || collectQoderCnRows,
      sourceKey: 'dbPaths'
    });
  }
  for (const dbPath of paths.mainDbPaths || []) {
    await inspectDatabase(dbPath, {
      kind: 'main_sqlite',
      collectRows: deps.collectQoderCnMainRows || collectQoderCnMainRows,
      sourceKey: 'mainDbPaths'
    });
  }

  const transcriptDiagnostics = {};
  let transcriptRows = [];
  let transcriptFailure = null;
  try {
    const result = await (deps.collectQoderCnTranscriptRows || collectQoderCnTranscriptRows)({
      homeDir,
      platform: options.platform || process.platform,
      env,
      diagnostics: transcriptDiagnostics,
      returnDiagnostics: true
    });
    transcriptRows = Array.isArray(result) ? result : (result.rows || []);
    Object.assign(transcriptDiagnostics, result?.diagnostics || {});
  } catch (error) {
    transcriptFailure = safeFailureCode(error?.code, 'QODER_CN_TRANSCRIPT_READ_FAILED');
    Object.assign(transcriptDiagnostics, error?.diagnostics || {});
  }

  const mergeDiagnostics = { source: 'none', usedSources: [], duplicateRows: 0 };
  const mergedRows = (deps.mergeQoderCnRows || mergeQoderCnRows)(databaseRows, transcriptRows, mergeDiagnostics, {
    databaseSources: {
      legacy: dbCandidates.some((candidate) => candidate.kind === 'legacy_sqlite' && candidate.rows > 0),
      main: dbCandidates.some((candidate) => candidate.kind === 'main_sqlite' && candidate.rows > 0)
    }
  });
  const now = options.now || new Date().toISOString();
  const periods = (deps.buildQoderCnPeriods || buildQoderCnPeriods)({
    now,
    allTimeSince: '1970-01-01T00:00:00.000Z',
    rows: mergedRows
  });
  const transcript = sanitizeTranscriptDiagnostics({
    ...transcriptDiagnostics,
    failureCode: transcriptFailure || transcriptDiagnostics.failureCode
  });
  const sourcePresent = dbCandidates.some((candidate) => candidate.exists)
    || transcript.rootExists === true;
  const hasFailure = Boolean(dbFailure || transcript.failureCode);
  const periodSummaries = {
    today: summarizePeriod(periods.today),
    month: summarizePeriod(periods.month),
    allTime: summarizePeriod(periods.allTime)
  };
  const hasNonzeroUsage = periodSummaries.allTime.totalTokens > 0;
  let status = hasFailure ? 'FAIL' : (!sourcePresent || !hasNonzeroUsage ? 'NOT RUN' : 'PASS');
  let failureCode = safeFailureCode(dbFailure || transcript.failureCode);
  if (options.requireData && !hasNonzeroUsage && !failureCode) {
    status = 'FAIL';
    failureCode = 'QODER_CN_NO_NONZERO_USAGE';
  }
  if (options.requireVersion && version.status !== 'provided') {
    status = 'FAIL';
    failureCode = failureCode || 'QODER_CN_VERSION_NOT_PROVIDED';
  }

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    status,
    failureCode,
    collectedAt: new Date().toISOString(),
    application: {
      tokenMonitorVersion: safeVersion(packageJson.version) || null,
      nodeVersion: process.version,
      platform: String(options.platform || process.platform).split('-')[0],
      arch: process.arch
    },
    qoderCn: {
      version,
      sources: {
        legacyDb: dbCandidates.filter((candidate) => candidate.kind === 'legacy_sqlite'),
        mainDb: dbCandidates.filter((candidate) => candidate.kind === 'main_sqlite'),
        transcript: {
          rootsConfigured: Array.isArray(paths.transcriptRoots) ? paths.transcriptRoots.length : 0,
          ...transcript
        }
      },
      merge: {
        dbRows: databaseRows.length,
        legacyDbRows: dbCandidates
          .filter((candidate) => candidate.kind === 'legacy_sqlite')
          .reduce((total, candidate) => total + candidate.rows, 0),
        mainDbRows: dbCandidates
          .filter((candidate) => candidate.kind === 'main_sqlite')
          .reduce((total, candidate) => total + candidate.rows, 0),
        transcriptRows: transcriptRows.length,
        mergedRows: mergedRows.length,
        duplicateRows: Number(mergeDiagnostics.duplicateRows) || 0,
        source: ['none', 'sqlite', 'transcript', 'sqlite+transcript'].includes(mergeDiagnostics.source)
          ? mergeDiagnostics.source
          : 'none',
        usedSources: Array.isArray(mergeDiagnostics.usedSources)
          ? mergeDiagnostics.usedSources.filter((item) => ['sqlite', 'main-sqlite', 'transcript'].includes(item))
          : [],
        estimated: mergedRows.some((row) => row?.estimated === true)
      },
      periods: {
        ...periodSummaries
      }
    }
  };
}

function usageText() {
  return [
    'Usage: node scripts/collect-qoder-cn-evidence.js [options]',
    '',
    'Options:',
    '  --qoder-cn-version VERSION  record the installed Qoder CN version without paths',
    '  --version-file PATH         read only a version field from a local app manifest',
    '  --require-version            exit 1 unless a valid version was supplied',
    '  --require-data               exit 1 unless non-zero rows are collected',
    '  --home-dir PATH              test/diagnostic override; paths are never printed',
    '  --help'
  ].join('\n');
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usageText());
    return 0;
  }
  const evidence = await collectQoderCnEvidence({
    ...args,
    env,
    homeDir: args.homeDir || os.homedir()
  });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence.status === 'FAIL' ? 1 : 0;
}

if (require.main === module) {
  main().catch(() => {
    console.error('Qoder CN evidence collection failed');
    process.exitCode = 1;
  }).then((code) => {
    if (Number.isInteger(code)) process.exitCode = code;
  });
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  collectQoderCnEvidence,
  parseArgs,
  safeFailureCode,
  safeVersion,
  sanitizeTranscriptDiagnostics,
  summarizePeriod,
  versionFromFile
};
