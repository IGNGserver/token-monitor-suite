'use strict';

/**
 * DeepSeek Harness (dsh) path resolution.
 *
 * Usage is read by tokscale (`--client dsh`, upstream 4.17+); this module keeps
 * only the one thing tokscale cannot tell us: which directory to watch so a
 * newly appended session refreshes the widget in seconds instead of at the next
 * full tick.
 *
 * dsh resolves its data root as explicit path > $DSH_HOME > ~/.dsh, and keeps
 * every durable session log under `<root>/sessions`. We mirror that precedence
 * exactly so the watch root and tokscale's scan root cannot disagree.
 */

const os = require('node:os');
const path = require('node:path');

function homeOf(options = {}) {
  return options.homeDir || os.homedir();
}

function envOf(options = {}) {
  return options.env || process.env;
}

function expandHomePath(value, home) {
  const raw = String(value || '').trim();
  if (raw === '~') return home;
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(home, raw.slice(2));
  return raw;
}

/** Resolve DSH_HOME with the same precedence as the upstream Harness. */
function resolveDeepSeekHarnessHome(options = {}) {
  const home = homeOf(options);
  const env = envOf(options);
  const configured = String(options.dshHome || env.DSH_HOME || '').trim();
  return path.resolve(expandHomePath(configured || path.join(home, '.dsh'), home));
}

function resolveDeepSeekHarnessSessionsDir(options = {}) {
  return path.join(resolveDeepSeekHarnessHome(options), 'sessions');
}

module.exports = {
  resolveDeepSeekHarnessHome,
  resolveDeepSeekHarnessSessionsDir
};
