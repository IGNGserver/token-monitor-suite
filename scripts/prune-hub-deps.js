'use strict';

// Prune node_modules down to the Hub's real runtime closure.
//
// The Hub's only runtime dependencies are chokidar, dotenv, koffi, mysql2, semver
// and undici, but a single root package.json means `npm ci --omit=dev` also
// installs the Electron/agent/updater stack. Measured on the production install:
// 47.9 MB installed versus 7.3 MB needed, of which @tokscale/cli-linux-x64-gnu
// alone is 25.9 MB (the Hub never spawns tokscale — grep src/hub for it and the
// only hits are comments).
//
// This runs in the Docker build, so a dependency that is genuinely needed will
// fail loudly at `npm ci` time in the image or at first request; the explicit
// keep-list below is the guard against silently pruning something reachable.

const fs = require('node:fs');
const path = require('node:path');

// Packages reachable from src/hub/server.js. `koffi` is reached lazily through
// src/hub/accountService.js -> ../shared/limitCollector (require('koffi')), so it
// must stay even though no Hub file names it at the top level.
const KEEP = new Set([
  'chokidar',
  'dotenv',
  'koffi',
  'mysql2',
  'semver',
  'undici'
]);

// Packages that are only pulled in because something on the keep-list declares
// them; kept explicitly so a version bump cannot break the image.
const KEEP_TRANSITIVE_ALLOWLIST = new Set([
  'readdirp', // chokidar
  'safer-buffer', 'iconv-lite', 'aws-ssl-profiles', 'long', 'lru.min', 'denque',
  'generate-function', 'is-property', 'named-placeholders', 'sql-escaper', // mysql2
  '@koromix/koffi-linux-x64', '@koromix/koffi-linux-arm64', '@koromix/koffi-linux-arm',
  '@koromix/koffi-linux-x64-musl', '@koromix/koffi-linux-arm64-musl'
].map((name) => name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/')));

function pruneHubNodeModules(nodeModulesDir, options = {}) {
  const log = options.log || (() => {});
  const keep = options.keep || KEEP;
  if (!fs.existsSync(nodeModulesDir)) {
    throw new Error(`node_modules not found at ${nodeModulesDir}`);
  }

  let removed = 0;
  let removedBytes = 0;

  function sizeOf(target) {
    let total = 0;
    const stack = [target];
    while (stack.length > 0) {
      const current = stack.pop();
      let stat;
      try { stat = fs.lstatSync(current); } catch (_) { continue; }
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(current)) stack.push(path.join(current, entry));
      } else {
        total += stat.size;
      }
    }
    return total;
  }

  const evaluate = (entryName, fullPath, depth) => {
    if (entryName.startsWith('.')) return false;
    const isScoped = entryName.startsWith('@');
    if (isScoped) {
      // Walk the scope's members individually; only directories are package
      // installs, so a stray file inside a scope directory is left alone.
      let entries;
      try { entries = fs.readdirSync(fullPath); } catch (_) { return false; }
      let keptAny = false;
      for (const member of entries) {
        const memberPath = path.join(fullPath, member);
        if (!fs.statSync(memberPath).isDirectory()) {
          keptAny = true;
          continue;
        }
        const memberName = `${entryName}/${member}`;
        const keepMember = keep.has(memberName) || KEEP_TRANSITIVE_ALLOWLIST.has(memberName);
        if (!keepMember) {
          const bytes = sizeOf(memberPath);
          fs.rmSync(memberPath, { recursive: true, force: true });
          removed += 1;
          removedBytes += bytes;
          log(`pruned ${memberName} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          keptAny = true;
        }
      }
      return !keptAny; // remove the now-empty scope directory
    }
    if (keep.has(entryName) || KEEP_TRANSITIVE_ALLOWLIST.has(entryName)) return false;
    if (depth > 0) return false; // only prune top-level entries
    const bytes = sizeOf(fullPath);
    fs.rmSync(fullPath, { recursive: true, force: true });
    removed += 1;
    removedBytes += bytes;
    log(`pruned ${entryName} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
    return false;
  };

  for (const entryName of fs.readdirSync(nodeModulesDir)) {
    const fullPath = path.join(nodeModulesDir, entryName);
    let stats;
    try { stats = fs.statSync(fullPath); } catch (_) { continue; }
    if (!stats.isDirectory()) continue;
    const removeScopeDir = evaluate(entryName, fullPath, 0);
    if (removeScopeDir) {
      try { fs.rmSync(fullPath, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    }
  }

  return { removed, removedBytes };
}

if (require.main === module) {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'node_modules'));
  try {
    const result = pruneHubNodeModules(target, { log: (message) => console.log(`[prune-hub-deps] ${message}`) });
    console.log(
      `[prune-hub-deps] removed ${result.removed} packages (${(result.removedBytes / 1024 / 1024).toFixed(2)} MB) from ${target}`
    );
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = { KEEP, pruneHubNodeModules };
