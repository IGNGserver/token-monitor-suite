'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  defaultDeviceId,
  loadDotEnv,
  normalizeHubUrl,
  parseArgs,
  parseBoolean,
  pidFilePath
} = require('../shared/config');
const { appVersion } = require('../shared/appVersion');
const { usageConfigFromSource } = require('../shared/collectorConfig');
const {
  readClientUsageArchive,
  writeClientUsageArchive: persistClientUsageArchive
} = require('../shared/clientUsageArchive');
const {
  readDeviceIdentity,
  renameDeviceOnHub,
  writeDeviceIdentity
} = require('../shared/deviceIdentity');
const { postSyncPayload } = require('../shared/syncPayload');
const { createSyncSummaryTransformer } = require('../shared/syncSummary');
const { withSyncUploadMetadata } = require('../shared/syncUploadSink');
const { requireSafeHubTransport } = require('../shared/hubTransport');
const { runAgent, runAgentOnce } = require('./runtime');

loadDotEnv();
const args = parseArgs(process.argv.slice(2));
const allowInsecureHubHttp = parseBoolean(
  args.allowInsecureHttp ?? args['allow-insecure-http'] ?? process.env.TOKEN_MONITOR_ALLOW_INSECURE_HTTP,
  false
);
const hubUrl = requireSafeHubTransport(
  normalizeHubUrl(args.hub || args.hubUrl || process.env.TOKEN_MONITOR_HUB_URL || 'http://127.0.0.1:17321'),
  { allowInsecureHttp: allowInsecureHubHttp }
);
const secret = String(args.secret || process.env.TOKEN_MONITOR_SECRET || '').trim();
const deviceId = String(args.device || args.deviceId || process.env.TOKEN_MONITOR_DEVICE_ID || defaultDeviceId());
const once = Boolean(args.once);
const dryRun = Boolean(args['dry-run'] || args.dryRun);

const usageSource = {
  clients: args.clients ?? process.env.TOKEN_MONITOR_CLIENTS,
  allTimeSince: args.since ?? args.allTimeSince ?? process.env.TOKEN_MONITOR_ALL_TIME_SINCE,
  commandTimeoutMs: args.timeoutMs ?? process.env.TOKEN_MONITOR_TOKSCALE_TIMEOUT_MS,
  deviceId,
  collectionMode: args.collectionMode ?? process.env.TOKEN_MONITOR_COLLECTION_MODE,
  collectionIntervalMs: args.interval ?? args.intervalMs ?? process.env.TOKEN_MONITOR_INTERVAL_MS,
  watchEnabled: args.watch ?? process.env.TOKEN_MONITOR_WATCH,
  watchDebounceMs: args.watchDebounceMs ?? process.env.TOKEN_MONITOR_WATCH_DEBOUNCE_MS,
  historyEnabled: args.history ?? args.historyEnabled ?? process.env.TOKEN_MONITOR_HISTORY_ENABLED,
  historyIntervalMs: process.env.TOKEN_MONITOR_HISTORY_INTERVAL_MS,
  projectsEnabled: args.projects ?? args.projectsEnabled ?? process.env.TOKEN_MONITOR_PROJECTS_ENABLED,
  sessionUsageArchiveEnabled: args.sessionArchive ?? args.sessionUsageArchiveEnabled ?? process.env.TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED,
  wslScanEnabled: args.wslScan ?? args.wslScanEnabled ?? process.env.TOKEN_MONITOR_WSL_SCAN,
  syncUploadIntervalMs: args.syncUploadIntervalMs ?? args.syncUploadInterval ?? process.env.TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS,
  anchorPersistenceEnabled: !once && !dryRun
};

const usageOptions = usageConfigFromSource(usageSource, {
  agentVersion: appVersion(),
  agentRuntime: 'headless-agent',
  reasonixNativeSessionsEnabled: true,
  dailyHistoryArchiveWriteEnabled: !dryRun,
  uploadTimeoutMs: 15 * 1000,
  onError: (error, reason) => console.error(`[${new Date().toISOString()}] (${reason}) ${error.message}`),
  logger: (message) => (dryRun ? console.error(message) : console.log(message))
});

const archivedClientUsage = (() => {
  try { return readClientUsageArchive(); }
  catch (error) {
    console.error(`[client-archive] read failed: ${error.message}`);
    return { version: 1, clients: {} };
  }
})();
const syncSummaryTransformer = createSyncSummaryTransformer({
  initialClientUsageArchive: archivedClientUsage,
  activeClients: usageOptions.clients,
  captureClientUsage: true,
  writeClientUsageArchive: (archive) => {
    if (!dryRun) persistClientUsageArchive(archive);
  },
  canWriteClientUsageArchive: !dryRun,
  sessionUsageArchiveEnabled: usageOptions.dailyHistoryArchiveEnabled,
  canWriteSessionUsageArchive: !dryRun,
  onArchiveError: (error, operation) => console.error(`[session-archive] ${operation} failed: ${error.message}`)
});

function summaryForSync(summary, reason, meta) {
  return syncSummaryTransformer.transform(summary, reason, meta);
}

let deviceIdentity = readDeviceIdentity();

async function postUsage(summary, context = {}) {
  const previousDeviceId = deviceIdentity.lastPostedDeviceId;
  if (previousDeviceId && previousDeviceId !== summary.deviceId) {
    await renameDeviceOnHub(
      fetch,
      hubUrl,
      secret,
      previousDeviceId,
      summary.deviceId,
      { signal: context.signal, timeoutMs: usageOptions.uploadTimeoutMs }
    );
  }
  const { response } = await postSyncPayload(fetch, `${hubUrl}/api/ingest`, {
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    summary,
    signal: context.signal,
    timeoutMs: usageOptions.uploadTimeoutMs,
    logger: (message) => console.warn(`[sync] ${message}`)
  });
  if (!response.ok) {
    const error = new Error(`Hub responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  deviceIdentity = { version: 1, lastPostedDeviceId: summary.deviceId };
  try { writeDeviceIdentity(summary.deviceId); }
  catch (error) { console.warn(`[identity] state write failed: ${error.message}`); }
  return response.json();
}

async function deliver(summary, context = {}) {
  const uploadSummary = withSyncUploadMetadata(summary, usageOptions.syncUploadIntervalMs);
  if (dryRun) { console.log(JSON.stringify(uploadSummary, null, 2)); return; }
  await postUsage(uploadSummary, context);
  console.log(`[${new Date().toISOString()}] posted ${summary.deviceId}: today=${summary.today.totalTokens} month=${summary.month.totalTokens} allTime=${summary.allTime.totalTokens}`);
}

function registerPidFile(stopRuntime) {
  const pidPath = pidFilePath();
  fs.mkdirSync(path.dirname(pidPath), { recursive: true });
  fs.writeFileSync(pidPath, String(process.pid), 'utf8');
  const cleanup = () => { try { fs.unlinkSync(pidPath); } catch (_) {} };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      try { stopRuntime?.(); } catch (_) {}
      cleanup();
      process.exit(0);
    });
  }
}

async function main() {
  const startupMessage = `Token Monitor agent device=${deviceId} hub=${hubUrl} mode=${usageSource.collectionMode || 'live'} intervalMs=${usageOptions.intervalMs} uploadIntervalMs=${usageOptions.syncUploadIntervalMs} watch=${usageOptions.watchEnabled} projects=${usageOptions.projectsEnabled ? 'on' : 'off'} history=${usageOptions.historyEnabled ? 'on' : 'off'} sessionArchive=${usageOptions.dailyHistoryArchiveEnabled ? 'on' : 'off'} limits=hub`;
  if (dryRun) console.error(startupMessage);
  else console.log(startupMessage);
  if (!secret) console.warn('Warning: TOKEN_MONITOR_SECRET is not set. Posting without authorization header.');
  // Claim archive ownership before either a one-shot or long-running scan so
  // Electron can yield before its history read-modify-write reaches disk.
  let runtimeHandle = null;
  if (!dryRun) registerPidFile(() => runtimeHandle?.stop());
  const runtimeOptions = {
    envelope: { deviceId, agentVersion: appVersion(), agentRuntime: 'headless-agent' },
    usageOptions,
    transformUsage: summaryForSync,
    syncUploadIntervalMs: usageOptions.syncUploadIntervalMs,
    uploadTimeoutMs: usageOptions.uploadTimeoutMs,
    deliver,
    dryRun,
    onRuntime: (runtime) => { runtimeHandle = runtime; },
    onError: (error, reason) => console.error(`[${new Date().toISOString()}] (${reason}) ${error.message}`)
  };
  if (once) {
    await runAgentOnce(runtimeOptions);
    return;
  }
  runtimeHandle = runAgent(runtimeOptions);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
