'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { emptyPeriod, extractUsageFromTokscale, mergePeriods } = require('./usage');
const { REASONIX_CLIENT } = require('./reasonixPaths');
const { buildPromaPeriods, collectPromaRows } = require('./promaUsage');

const LXSS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss';

// Relative (Linux-style) paths under a WSL home. If any exists, a tracked client
// stores data there and the home is worth a tokscale scan. These mirror the roots
// tokscale actually reads (incl. alternate roots: Claude transcripts, Kimi
// Code, legacy OpenClaw bot dirs) so a home holding only an alternate-root client
// is still discovered. The `.vscode-server` entries cover Cline / Kilo Code
// running through the VS Code WSL remote.
//
// Both Qoder sites (`qoder`, `qodercn`) are deliberately absent even though their
// Linux roots (`~/.config/QoderCN`, `~/.qoder-cn`) could appear in a WSL home. A
// marker on its own would be worse than none: attribution is marker-based, so a
// Qoder-only home would be reported as an active client while contributing zero
// tokens, because tokscale has no Qoder entry and the usage comes from this
// project's own SQLite/transcript adapter. Doing it properly needs a Proma-style
// local-adapter branch here, and reading SQLite (plus its `-wal`/`-shm`
// sidecars) over a `\\wsl$\…` UNC path is unverified. On a Linux host the
// ordinary collector already reads the real home, so this only affects a Windows
// host reaching into a distro that runs Qoder's Linux build.
const WSL_DATA_MARKERS = [
  '.claude/projects',
  '.claude/transcripts',
  '.codex/sessions',
  '.local/share/opencode',
  '.openclaw/agents',
  '.clawdbot/agents',
  '.moltbot/agents',
  '.moldbot/agents',
  '.hermes',
  '.kimi/sessions',
  '.kimi-code/sessions',
  '.qwen/projects',
  '.grok/sessions',
  '.copilot/otel',
  '.gemini/antigravity-cli/conversations',
  '.config/Code/User/globalStorage/saoudrizwan.claude-dev/tasks',
  '.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/tasks',
  '.pi/agent/sessions',
  '.omp/agent/sessions',
  '.local/share/zed/threads/threads.db',
  '.config/Code/User/globalStorage/kilocode.kilo-code/tasks',
  '.vscode-server/data/User/globalStorage/kilocode.kilo-code/tasks',
  '.commandcode/projects',
  '.local/share/mimocode/mimocode.db',
  '.zcode/projects',
  '.zcode/cli/db',
  '.kiro/sessions',
  '.local/share/kiro-cli/data.sqlite3',
  '.config/Kiro/User/globalStorage/kiro.kiroagent',
  '.config/kiro/User/globalStorage/kiro.kiroagent',
  '.codebuddy/projects',
  '.workbuddy',
  '.proma/agent-sessions',
  '.dsh/sessions',
  // tokscale 4.17 clients with home-relative Linux roots. devin-desktop is
  // deliberately absent: its only root is macOS Application Support, which can
  // never appear inside a WSL home. trae/warp caches live under .config/tokscale
  // like the cursor/antigravity caches, but those are written by `tokscale <c>
  // sync`, so a WSL home holding only one still needs the marker to be scanned.
  '.gemini/tmp',
  '.local/share/amp/threads',
  '.factory/sessions',
  '.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks',
  '.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/tasks',
  '.mux/sessions',
  '.local/share/kilo/kilo.db',
  '.local/share/crush/projects.json',
  '.local/share/goose/sessions/sessions.db',
  '.config/manicode/projects',
  '.config/tokscale/trae-cache',
  '.config/tokscale/warp-cache',
  '.gjc/agent/sessions',
  '.jcode/sessions',
  '.junie/sessions',
  '.opencodereview/sessions',
  '.local/share/devin/cli/sessions.db',
  '.senpi/agent/sessions',
  '.augment/sessions',
  '.config/kimchi/harness/sessions',
  '.prime/agent/sessions',
  '.config/CherryStudio/.claude/projects',
  '.config/tokscale/headless/mcode',
  '.fx/sessions',
  '.lmstudio/server-logs',
  '.unsloth/studio/studio.db',
  '.hindsight/usage'
];

// Maps every WSL_DATA_MARKERS entry to the tracked-client id that owns it, so a
// matched marker can be attributed back to a client (alt roots collapse to one
// id, e.g. .kimi/.kimi-code -> kimi; the OpenClaw bot dirs -> openclaw; the two
// Cline globalStorage paths -> cline). Ids must match DEFAULT_CLIENTS.
const MARKER_CLIENTS = {
  '.claude/projects': 'claude',
  '.claude/transcripts': 'claude',
  '.codex/sessions': 'codex',
  '.local/share/opencode': 'opencode',
  '.openclaw/agents': 'openclaw',
  '.clawdbot/agents': 'openclaw',
  '.moltbot/agents': 'openclaw',
  '.moldbot/agents': 'openclaw',
  '.hermes': 'hermes',
  '.kimi/sessions': 'kimi',
  '.kimi-code/sessions': 'kimi',
  '.qwen/projects': 'qwen',
  '.grok/sessions': 'grok',
  '.copilot/otel': 'copilot',
  // Antigravity CLI's own parse-local root, mapped to the umbrella `antigravity`
  // id we track; tokscaleClientFilter widens the scan to the antigravity-cli id.
  '.gemini/antigravity-cli/conversations': 'antigravity',
  '.config/Code/User/globalStorage/saoudrizwan.claude-dev/tasks': 'cline',
  '.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/tasks': 'cline',
  '.pi/agent/sessions': 'pi',
  '.omp/agent/sessions': 'pi',
  '.local/share/zed/threads/threads.db': 'zed',
  '.config/Code/User/globalStorage/kilocode.kilo-code/tasks': 'kilocode',
  '.vscode-server/data/User/globalStorage/kilocode.kilo-code/tasks': 'kilocode',
  '.commandcode/projects': 'commandcode',
  '.local/share/mimocode/mimocode.db': 'micode',
  '.zcode/projects': 'zcode',
  '.zcode/cli/db': 'zcode',
  '.kiro/sessions': 'kiro',
  '.local/share/kiro-cli/data.sqlite3': 'kiro',
  '.config/Kiro/User/globalStorage/kiro.kiroagent': 'kiro',
  '.config/kiro/User/globalStorage/kiro.kiroagent': 'kiro',
  '.codebuddy/projects': 'codebuddy',
  '.workbuddy': 'workbuddy',
  '.proma/agent-sessions': 'proma',
  '.dsh/sessions': 'deepseek-harness',
  '.gemini/tmp': 'gemini',
  '.local/share/amp/threads': 'amp',
  '.factory/sessions': 'droid',
  '.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks': 'roocode',
  '.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/tasks': 'roocode',
  '.mux/sessions': 'mux',
  '.local/share/kilo/kilo.db': 'kilo',
  '.local/share/crush/projects.json': 'crush',
  '.local/share/goose/sessions/sessions.db': 'goose',
  // One directory holds both Codebuff and Freebuff chats; tokscale tells them
  // apart by the run's root agent id, not by location. Attribute the marker to
  // codebuff (the base product) — both ids are tracked, and the marker's only job
  // is deciding whether a WSL home is worth scanning at all.
  '.config/manicode/projects': 'codebuff',
  '.config/tokscale/trae-cache': 'trae',
  '.config/tokscale/warp-cache': 'warp',
  '.gjc/agent/sessions': 'gjc',
  '.jcode/sessions': 'jcode',
  '.junie/sessions': 'junie',
  '.opencodereview/sessions': 'opencodereview',
  '.local/share/devin/cli/sessions.db': 'devin-cli',
  '.senpi/agent/sessions': 'senpi',
  '.augment/sessions': 'augment',
  '.config/kimchi/harness/sessions': 'kimchi',
  '.prime/agent/sessions': 'prime-agent',
  '.config/CherryStudio/.claude/projects': 'cherrystudio',
  '.config/tokscale/headless/mcode': 'mcode',
  '.fx/sessions': 'fx',
  '.lmstudio/server-logs': 'lmstudio',
  '.unsloth/studio/studio.db': 'unsloth',
  '.hindsight/usage': 'hindsight'
};

// Default command runner. reg output is ANSI/utf8; wsl.exe output is UTF-16LE.
// stdin is NUL ('ignore') so a non-WSL wsl.exe stub cannot block on "press any
// key to install"; a timeout backstops any hang.
function defaultExec(cmd, args) {
  const isWsl = /wsl(\.exe)?$/i.test(cmd);
  const out = execFileSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
    windowsHide: true,
    encoding: 'buffer'
  });
  return Buffer.from(out).toString(isWsl ? 'utf16le' : 'utf8');
}

function emptyWslBundle() {
  return { today: emptyPeriod(), month: emptyPeriod(), allTime: emptyPeriod() };
}

// Install-proof gate: reg.exe is read-only and cannot trigger a WSL install. If
// the Lxss key is absent, reg exits non-zero and execFileSync throws -> false.
function isWslInstalled(deps = {}) {
  const platform = deps.platform || process.platform;
  if (platform !== 'win32') return false;
  const exec = deps.exec || defaultExec;
  try {
    exec('reg', ['query', LXSS_KEY]);
    return true;
  } catch (_) {
    return false;
  }
}

function listRunningWslDistros(deps = {}) {
  if (!isWslInstalled(deps)) return [];
  const exec = deps.exec || defaultExec;
  let out;
  try {
    out = exec('wsl.exe', ['--list', '--quiet', '--running']);
  } catch (_) {
    return [];
  }
  return String(out)
    .split(/\r?\n/)
    .map((line) => line.replace(/\u0000/g, '').trim())
    .filter(Boolean);
}

// Returns the tracked-client ids whose marker is present in this home (deduped).
// Empty array = no tracked client stores data here.
function wslHomePath(home, relativePath) {
  return `${home}\\${relativePath.replace(/\//g, '\\')}`;
}

function homeHasData(home, existsSync, readdirSync = fs.readdirSync) {
  const ids = new Set();
  for (const rel of WSL_DATA_MARKERS) {
    if (existsSync(wslHomePath(home, rel))) {
      const client = MARKER_CLIENTS[rel];
      if (client) ids.add(client);
    }
  }
  // workspaceStorage is not Copilot-specific, so require the nested source
  // Tokscale 4.5.2 actually parses instead of marking every VS Code WSL home.
  const workspaceRoot = wslHomePath(home, '.config/Code/User/workspaceStorage');
  try {
    for (const workspace of readdirSync(workspaceRoot)) {
      if (existsSync(`${workspaceRoot}\\${workspace}\\chatSessions`)) {
        ids.add('copilot');
        break;
      }
    }
  } catch (_) { /* workspaceStorage missing or unreadable */ }
  return [...ids];
}

function wslUsageHomes(deps = {}) {
  const readdirSync = deps.readdirSync || fs.readdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const homes = [];
  for (const distro of listRunningWslDistros(deps)) {
    const candidates = [];
    const homeRoot = `\\\\wsl$\\${distro}\\home`;
    try {
      for (const user of readdirSync(homeRoot)) {
        candidates.push(`${homeRoot}\\${user}`);
      }
    } catch (_) { /* distro has no /home or it is unreadable */ }
    candidates.push(`\\\\wsl$\\${distro}\\root`);
    for (const home of candidates) {
      if (homeHasData(home, existsSync, readdirSync).length > 0) homes.push(home);
    }
  }
  return homes;
}

// Cheap WSL readiness probe (no tokscale). Returns 'not-installed' (no Lxss),
// 'not-running' (installed but no running distro), or 'ok'.
function probeWslState(deps = {}) {
  if (!isWslInstalled(deps)) return 'not-installed';
  if (listRunningWslDistros(deps).length === 0) return 'not-running';
  return 'ok';
}

async function collectWslUsage(options = {}, deps = {}) {
  const { clients, trackedClients = clients, allTimeSince, commandTimeoutMs, now, runTokscale, logger, decoratePeriods } = options;
  const buildProma = options.buildPromaPeriods || buildPromaPeriods;
  const collectProma = options.collectPromaRows || collectPromaRows;
  const existsSync = deps.existsSync || fs.existsSync;
  const readdirSync = deps.readdirSync || fs.readdirSync;
  const bundle = emptyWslBundle();
  const detected = new Set();
  if (!trackedClients) return { bundle, detected: [] };
  // Only attribute markers for clients the user is actually tracking — a marker
  // for an untracked client must not surface in the panel.
  // Reasonix aggregate usage is supported on the host, but remains excluded
  // from WSL scans: Tokscale's Windows PathRoot::ReasonixHome conflicts with
  // the Linux-default `.reasonix/stats` path inside WSL. Native session files
  // are local-only as well.
  const tracked = new Set(String(trackedClients).split(',').map((c) => c.trim()).filter(Boolean));
  // Only the local adapters are withheld from the tokscale scan. DeepSeek
  // Harness stays in: the collector's runTokscale renames it to tokscale's `dsh`.
  const clientsCsv = String(clients || '').split(',').map((c) => c.trim()).filter(Boolean)
    .filter((client) => client !== REASONIX_CLIENT && client !== 'proma')
    .join(',');
  for (const home of wslUsageHomes(deps)) {
    // Attribution is marker-based, independent of whether a parser returns data.
    const homeDataClients = homeHasData(home, existsSync, readdirSync);
    for (const id of homeDataClients) {
      if (tracked.has(id)) detected.add(id);
    }
    // Proma is locally parsed rather than tokscale-backed. Scan its WSL JSONL
    // root directly so a Proma-only home contributes actual usage, not merely
    // marker detection. The root is isolated per home to avoid double-counting
    // another distro or the host's local Proma sessions.
    if (tracked.has('proma') && homeDataClients.includes('proma')) {
      try {
        const promaOptions = {
          now,
          allTimeSince,
          roots: [wslHomePath(home, '.proma/agent-sessions')]
        };
        if (typeof options.resolvePromaPricing === 'function') {
          const rows = collectProma(promaOptions);
          promaOptions.rows = rows;
          promaOptions.pricingByModel = await options.resolvePromaPricing(rows);
        } else if (options.promaPricingByModel) {
          promaOptions.pricingByModel = options.promaPricingByModel;
        }
        const proma = buildProma(promaOptions);
        bundle.today = mergePeriods(bundle.today, extractUsageFromTokscale(proma.today));
        bundle.month = mergePeriods(bundle.month, extractUsageFromTokscale(proma.month));
        bundle.allTime = mergePeriods(bundle.allTime, extractUsageFromTokscale(proma.allTime));
      } catch (error) {
        if (typeof logger === 'function') logger(`wsl Proma usage parse failed for ${home}: ${error.message}`);
      }
    }
    // DeepSeek Harness is no longer locally parsed: tokscale reads its WSL
    // session store through the ordinary `--home` scan below (upstream id `dsh`,
    // which the collector's TOKSCALE_CLIENT_RENAMES maps from `deepseek-harness`).
    // Tokscale resolves DSH_HOME relative to the scanned home, so a distro's
    // ~/.dsh is read without the host's DSH_HOME leaking in. The marker above is
    // kept so a dsh-only home is still discovered.
    // Tokscale 4.6+ keeps explicit --home scans isolated from host-native roots,
    // so every requested client can be passed through for each discovered home.
    // Keep the empty guard because an empty --client expands to all clients.
    if (clientsCsv.length === 0 || typeof runTokscale !== 'function') continue;
    try {
      // Serial on purpose (issue #15): never run these concurrently.
      const todayJson = await runTokscale({ clients: clientsCsv, flags: ['--today', '--home', home], commandTimeoutMs });
      const monthJson = await runTokscale({ clients: clientsCsv, flags: ['--month', '--home', home], commandTimeoutMs });
      const allTimeJson = await runTokscale({ clients: clientsCsv, flags: ['--since', allTimeSince, '--home', home], commandTimeoutMs });
      const periods = {
        today: extractUsageFromTokscale(todayJson),
        month: extractUsageFromTokscale(monthJson),
        allTime: extractUsageFromTokscale(allTimeJson)
      };
      if (typeof decoratePeriods === 'function') decoratePeriods(periods, home);
      bundle.today = mergePeriods(bundle.today, periods.today);
      bundle.month = mergePeriods(bundle.month, periods.month);
      bundle.allTime = mergePeriods(bundle.allTime, periods.allTime);
    } catch (error) {
      if (typeof logger === 'function') logger(`wsl usage scan failed for ${home}: ${error.message}`);
    }
  }
  return { bundle, detected: [...detected] };
}

module.exports = {
  WSL_DATA_MARKERS,
  MARKER_CLIENTS,
  collectWslUsage,
  emptyWslBundle,
  homeHasData,
  isWslInstalled,
  listRunningWslDistros,
  probeWslState,
  wslUsageHomes
};
