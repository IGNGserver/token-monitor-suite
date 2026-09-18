'use strict';

/**
 * Trae and Warp/Oz self-sync runners.
 *
 * Both clients differ from every other tracked source: tokscale does not read
 * their own app data, it reads a cache *tokscale* writes under
 * `<config>/tokscale/<client>-cache`, populated by `tokscale <client> sync`.
 * Without that sync the cache stays absent and the client reads as `missing`
 * forever, so the collector has to run it the same way it runs `cursor sync`.
 *
 * Two behaviours are deliberately inherited from the cursor/antigravity path:
 *
 *  1. **Never sync without credentials.** `tokscale trae login` / `tokscale warp
 *     login` are interactive, so an unauthenticated machine must be skipped
 *     rather than have a subprocess prompt or fail on every tick. Credential
 *     presence comes from `tokscale <client> status --json`, which is read-only.
 *  2. **Never hand the cache dir to chokidar.** A sync writes the cache, so
 *     watching it would make every tick trigger the next one (the issue #15
 *     loop). Both clients are therefore in SELF_SYNCED_CLIENTS, and the sync
 *     below is what refreshes them on the interval/source-event cadence.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');

const SYNC_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 15_000;

function runTokscaleClientCommand(client, args, { timeoutMs = STATUS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    // Required lazily: collector.js requires this module, so a top-level import
    // would be a cycle.
    const { tokscaleCommand, terminateChild, abandonChildStreams } = require('./collector');
    const { bin, prefixArgs, env } = tokscaleCommand();
    const child = spawn(bin, [...prefixArgs, client, ...args], { env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // SIGTERM alone can leave a child (or a grandchild holding the pipes)
      // burning CPU; escalate and detach so the tick is not held open.
      terminateChild(child);
      abandonChildStreams(child);
      reject(new Error(`tokscale ${client} ${args[0]} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { if (!settled) stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { if (!settled) stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        return reject(new Error(`tokscale ${client} ${args[0]} exited ${code}: ${(stderr || stdout).trim()}`));
      }
      resolve(stdout);
    });
    child.stdin.end();
  });
}

function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

/**
 * A client is authenticated when `tokscale <client> status --json` says so.
 * The two commands report it differently — trae as a map of channel booleans
 * (`{"trae":false,"trae-solo":false}` where any `true` authenticates), warp as a
 * `hasCredentials` flag — so both shapes are accepted. A status that cannot be
 * read is treated as NOT authenticated: the safe direction, because the failure
 * mode of guessing wrong is a subprocess that blocks on an interactive login.
 */
function statusShowsCredentials(client, status) {
  if (!status || typeof status !== 'object') return false;
  if (client === 'warp') return status.hasCredentials === true;
  if (client === 'trae') {
    return Object.entries(status).some(([key, value]) => key !== 'diagnostics' && value === true);
  }
  return false;
}

async function hasClientCredentials(client, deps = {}) {
  try {
    if (typeof deps.runStatus === 'function') return Boolean(await deps.runStatus(client));
    const stdout = await runTokscaleClientCommand(client, ['status', '--json'], {
      timeoutMs: Number(deps.statusTimeoutMs || STATUS_TIMEOUT_MS)
    });
    return statusShowsCredentials(client, parseJsonOutput(stdout));
  } catch (_) {
    // A status probe that fails (not logged in, spawn error, timeout) means "no
    // credentials" — the caller then skips the sync instead of spawning one that
    // would try to prompt for an interactive login.
    return false;
  }
}

/**
 * Run `tokscale <client> sync`. Resolves `{attempted}` so the caller can tell a
 * skip (unauthenticated) apart from a run, which is what the self-sync throttle's
 * completion bookkeeping needs.
 */
async function runClientSync(client, deps = {}) {
  if (typeof deps.runSync === 'function') {
    await deps.runSync(client);
    return { attempted: true };
  }
  await runTokscaleClientCommand(client, ['sync', '--json'], {
    timeoutMs: Number(deps.syncTimeoutMs || SYNC_TIMEOUT_MS)
  });
  return { attempted: true };
}

/**
 * Whether a client's cache dir already exists. Used only as a cheap diagnostic
 * signal; presence is NOT required to sync (the sync creates the dir).
 */
function clientCacheExists(client, options = {}) {
  const { tokscaleClientCacheDir } = require('./tokscaleConfig');
  const dir = tokscaleClientCacheDir(client, {
    homeDir: options.homeDir || require('node:os').homedir(),
    env: options.env || process.env,
    platform: options.platform || process.platform
  });
  try {
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch (_) {
    return false;
  }
}

module.exports = {
  SYNC_TIMEOUT_MS,
  STATUS_TIMEOUT_MS,
  clientCacheExists,
  hasClientCredentials,
  runClientSync,
  statusShowsCredentials
};
