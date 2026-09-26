# AGENTS.md

This is the single source of project guidance, shared by every coding agent (Claude Code, Codex, Cursor, …). `CLAUDE.md` is a Claude Code compatibility shim that just imports this file — edit **this** file, not `CLAUDE.md`.

## Commands

```bash
npm start          # launch the desktop app (= npm run widget / npm run dev)
npm run agent      # start the headless collector→hub agent
npm run agent:once # one-shot collect+post, then exit (useful for cron/launchd)
npm test           # run the node:test suite (node --test "tests/**/*.test.js")
npm run lint       # ESLint flat config (eslint.config.js)
npm run verify:product-scope # enforce the approved two-mode / Compose-only product boundary
npm run verify:android       # Android Fluent colour + component-boundary guards
npm run verify     # product-scope + shared-UI boundary + css-var + Android guards, lint, test
```

Automated verification is `npm run verify` (= `npm run verify:product-scope && npm run verify:shared-ui && npm run verify:css-vars && npm run verify:android-fluent-contrast && npm run verify:android-fluent-boundary && npm run lint && npm test`); CI (`.github/workflows/ci.yml`) runs lint + test on push/PR across Node 22 & 24, and a separate `android` job compiles the client and runs `:app:testDebugUnitTest` — the Android toolchain is not reachable from the Node matrix. The toolchain (ESLint 10 + the node:test glob) needs Node 22.13+, which is why `engines.node` is `>=22.13.0` (Node 18 & 20 are both EOL as of 2026-06).

```bash
cd android && ./gradlew :app:testDebugUnitTest   # Android JVM tests (Compose runtime is NOT loadable here)
cd android && ./gradlew :app:assembleDebug       # compile-only check
```

Android JVM tests cannot load `androidx.compose.*` runtime classes, so anything a JVM test must
reach stays free of Compose types and keeps its `CompositionLocal` in a separate file
(`DisplayFx.kt` is the precedent); behaviour that only exists inside a composable is asserted by
the Node guards or by hand instead.


### Version and release policy

- Project versions use standard SemVer `<major>.<minor>.<patch>` (e.g., `1.0.0`), with optional local revision `-rev.<positive integer>` supported for incremental maintenance.
- Root package and lock metadata must stay aligned. `npm run verify:release-version` validates the project version format and the root package/lock copies.
- A normal request to “发布 release” means a GitHub prerelease. The release workflow defaults to `prerelease` for both pushed tags and manual dispatch. Only an explicit request to “发布正式版 release” may select the `release` workflow input. The Docker `latest` tag is updated only for a formal release; version-specific image tags are always published.
- Release tags are `v<project-version>`, and release jobs must check out and validate the exact tag. Android receives the same version through `-PtokenMonitorVersion`.
- The desktop update channel follows the **installed** version, not a setting: a formal release (`1.2.3`) only ever considers non-prerelease publishes, while a `-rev.N` build follows the newest publish. `releaseMatchesInstalledChannel()` in `src/shared/appUpdater.js` is the single rule and gates both the GitHub release-list check and electron-updater's own feed. Note that electron-builder still writes one `latest*.yml` per platform that every publish overwrites, so "download the artifact that matches the channel" needs a per-channel metadata file in the release workflow before it can be relied on at install time.

To dry-run the agent without posting: `node src/agent/agent.js --once --dry-run`.

## Architecture

The desktop app, Docker Compose Hub, and headless agent share `src/shared/`, and the desktop app and the Hub dashboard additionally share `src/shared-ui/`:

- **`src/shared-ui/`** — the one UI both hosts render. Views, i18n, formatting, pure data transforms, client icons and styles live here. Every host-specific call goes through `src/shared-ui/transport/`: `httpTransport` for the Hub (fetch + SSE, same-origin) and `ipcTransport` for Electron (IPC to the main process, which owns the secret and the stream lifecycle). `scripts/verify-shared-ui-boundary.js` enforces that no view reaches for `fetch`, storage, `history`, dialogs or `window.tokenMonitor` directly — that is what keeps one implementation viable in both.
- **`src/electron/main.js`** — desktop process. Owns the BrowserWindow, app menu, IPC, and exactly two sync choices: *local* and *client*. It serves the shared UI's `/api/*` vocabulary from local data or a Hub proxy via `src/electron/desktopRequestRouter.js`. Native menu/tray labels come from `src/shared-ui/core/i18n.js`, which the main process `require()`s directly (Node's `require(esm)`, available in Electron's bundled Node) — there is deliberately no second catalog; `tests/electron/i18n.test.js` fails if a native string exists only in one of them.
- **Scope tabs are not all wire periods.** The *Day / Month / Total* tabs read `stats.periods`, which is the collector's fixed three-window scan. The *Yesterday* and *Week* tabs are calendar windows the UI computes in `src/shared-ui/core/dateRanges.js` and resolves through `/api/usage/range`, so they land in `state.customPeriod` exactly like a hand-picked range does and never widen the wire shape or the per-tick tokscale cost. Adding a preset there is a UI change; adding one to the wire is a collector + Hub + Android change. The range is fetched on selection and re-fetched only when its window stops matching (i.e. after midnight) — never on a stream frame, because in local mode a range request runs tokscale.
- **`src/electron/renderer/`** — a shell (`index.html`, `desktop.css`) plus `boot.js`, which installs the IPC transport before importing the shared UI.
- **`src/hub/server.js`** — Node/MySQL HTTP Hub, used only by the root `docker-compose.yml`. It exposes `/api/ingest`, `/api/stats`, `/api/stats/stream` (SSE), and serves the same-port web dashboard / PWA from `src/hub/web/` via `src/hub/static.js`; the shared UI is served under `/ui/`. The Hub source is intentionally excluded from Electron packages.
- **`src/agent/agent.js`** — headless collector for machines without the desktop app. It is a sync client and posts to the Docker Compose Hub.
- **`android/`** — a native Kotlin/Compose read client for the Docker Compose Hub (`/api/*` + SSE, no collector, no `POST /api/ingest`). It shares Fluent 2 tokens and semantics with the shared renderer but is a separate UI: its component contract is `docs/design/android-fluent2-contract.md`, and it enforces that contract with ratchet guards rather than review, because it is the one surface with no shared code to keep it honest. It consumes the same `clientStatus` / `wslStatus` / `limits` / accounts records the Hub serves, and it renders the *same* provenance rules (`clientEstimated` → `~`, `clientCredits` as a separate unit) — a client that drops provenance is reporting an estimate as a measurement.

The product boundary is recorded in `product-scope.json`: no embedded widget Hub, no standalone `npm run hub` entry point, and no secondary Worker deployment. Run `npm run verify:product-scope` before changing any deployment or sync code.

### Collector pipeline (shared by the desktop app and the agent)

`src/shared/collector.js` is the only place that invokes `tokscale`. It:
1. resolves the platform binary from `@tokscale/cli-<platform>-<arch>` and falls back to the JS shim under Electron via `ELECTRON_RUN_AS_NODE=1`;
2. runs three `tokscale --json --client <csv> --group-by client,model` calls (today / month / since `allTimeSince`) on full ticks (startup / interval / manual) — serially on purpose: concurrent scans triple peak CPU/IO. Watch-triggered ticks instead scan only `--today` and derive month/allTime **exactly** via `applyPeriodDelta()` anchored to the last full scan (every tokscale period scan costs the same full-load+filter, so the win is 3 spawns→1; the delta is an identity for append-only logs, NOT an estimate; stale-date anchors force a full scan);
3. funnels output through `extractUsageFromTokscale()` in `src/shared/usage.js`, which is a defensive deep-walker over tokscale's JSON shape (it never assumes a fixed layout — that's why `tokenValue`/`detectClient` accept many key spellings);
4. watches the per-client data directories from `watchPathsForClients()` with chokidar (`usePolling: true, interval: 2000`) and debounces refreshes by `watchDebounceMs` (no cooldown — the product promises 3–5 s updates; mid-tick watch events re-arm the debounce timer instead of coalescing). The cursor/antigravity tokscale cache dirs are deliberately *not* watched — only our own `maybeSync*` calls write them, so watching them re-triggers forever — and those syncs are gated + throttled (`SYNC_MIN_INTERVAL_MS`).
5. on Windows, also scans usage from **running** WSL distros (`src/shared/wslUsage.js`). It registry-gates on `HKCU\…\Lxss` (so `wsl.exe` is never spawned without WSL — the inbox stub otherwise shows an interactive install prompt), lists running distros via `wsl.exe --list --running` (never auto-starts a stopped one), keeps homes containing tracked-client data, and runs `tokscale --home \\wsl$\<distro>\home\<user>` per home (serial, same CPU/IO reason as above). The bundle is merged into the Windows periods in `collectUsageOnce` **before** `deriveClientStatus` (so a WSL-only client still shows active); `mergePeriods`/`addPeriodInto` (in `usage.js`) do the additive sum. It refreshes on full ticks only and is frozen between them (`wslAnchor` in `startCollector`), so the Windows-only delta anchor stays exact and the chokidar watcher is **not** extended to WSL. Non-`win32` is a no-op. Default on, no setting.

### AI Tool Limits collector

Usage and limits have independent lifecycles under `src/shared/deviceRuntime.js`: `UsageRuntime` owns the tokscale collector, while `LimitsRuntime` owns its refresh timer, bounded cross-provider concurrency, per-provider latest-wins serial lanes, scoped account refreshes, finite probe deadlines, retry/backoff, and `lastGood` / `lastAttempt` retention. Credential changes refresh or clear only the affected limits lane and never restart usage; Cursor additionally forces one targeted usage sync because its tokscale cache is self-synced.

`DeviceState` composes both outputs into the unchanged device wire record, buffering limits until usage exists and cold-start previews until a complete usage baseline exists; limits-only updates preserve the usage `updatedAt`. Provider dispatch starts in `src/shared/limitCollector.js`, with provider-specific implementations split between that file and `src/shared/*Limits.js`; shared normalization remains in `src/shared/limits.js`. The Docker Compose Hub receives the composed record and never needs provider credentials.

### Local / client mode switching

`main.js` chooses between `local` and `client` from `settings.hubMode`, set in the settings view's Hub connection group. In `client` mode (a `hubUrl` is set) it stops the local-only collector, opens an SSE stream to `/api/stats/stream`, and also runs a sync collector to post this device's own usage. In `local` mode it runs only the local collector and emits stats over IPC, which the shared UI reads through its transport. A legacy `host` value is migrated to `local` and its embedded-Hub settings are discarded; it is not a supported runtime mode.

The only supported Hub deployment is the root Docker Compose stack. `src/hub/` remains part of the Docker image and release Compose archive, but never part of the Electron package. When both the desktop app and the headless agent run on the same machine, the app's sync collector backs off — it checks `data/agent.pid` (`pidFilePath()`) and skips posting if that PID is alive.

### Settings and credentials: env first, GUI overrides for the desktop app

Configuration has two sources, and the desktop app splits its persisted GUI state by sensitivity:

1. **`.env` at project root** — read by `loadDotEnv()` in `src/shared/config.js` at the top of every entry file. Only assigns keys that aren't already in `process.env`, so real env vars (systemd / launchd / Docker) still win. `.env.example` documents the operator-facing settings intended for direct configuration, including connection/device settings, feature toggles, and provider credentials. Lower-level runtime knobs may still be accepted without being listed there; treat additions or removals from the documented env surface as compatibility changes and keep `.env.example` aligned with the code.
2. **Desktop GUI** — Electron `userData/settings.json` stores preferences and account metadata; plaintext `userData/credentials.json` stores GUI-managed raw credentials with restrictive filesystem permissions (POSIX `0600`; Windows relies on the containing `userData` ACL). `readSettings()` merges both over `defaultSettings()` (which is seeded from env). The snapshot sent to the renderer omits every raw credential **and** the main process's own runtime state (`windowBounds`, `lastViewState`, `archivedClientUsage`, `migratedDefaultClients`, `lastPostedDeviceId`, `appUpdate`), and `settings:update` refuses those same keys in both directions, so a renderer write cannot clobber them; the desktop settings surface is asserted by `tests/electron/settingsMigration.test.js`. The single Hub secret is the only raw credential exposed to the renderer, and `ipcTransport` never forwards its value — the UI only learns whether a Hub is configured. The headless agent and Docker Compose Hub never read `credentials.json`; their credential flow remains CLI/env-based.

`CREDENTIAL_SETTING_PATHS` in `src/shared/credentialStore.js` maps fixed GUI credential settings. Add new fixed credentials there instead of creating provider-specific stores; dynamic account credentials such as MiMo cookies belong under a dedicated nested path in the same unified store and must remain metadata-only in the renderer. The single Hub secret is the only raw credential exposed by the sync UI. Expose any other raw credential to the renderer only through an explicit allowlist. Legacy migration must write and verify the new store before stripping/deleting the old source; corrupt, unknown-version, or symlinked stores must never be replaced with an empty document. This store is deliberately local plaintext protected by filesystem permissions, not OS-backed encryption: it avoids Keychain/credential-manager prompts but does not protect against processes already running as the same OS user.

Per-setting precedence for the agent and hub: `CLI flag → env var (real or .env) → built-in default`. There is no JSON config file anymore — `config.local.json` was removed.

### Adding a tracked client

The default client CSV lives in **one** place: `DEFAULT_CLIENTS` in `src/shared/clientTracking.js` (`src/electron/main.js` and `src/agent/agent.js` both derive from it). But adding a *new* client means touching several spots that must all agree on the id:

| Touch point | Where |
|---|---|
| Default client list | `DEFAULT_CLIENTS` in `src/shared/clientTracking.js` |
| Watch paths | the `add(...)` call in `clientWatchCandidates()` (`src/shared/collector.js`) |
| Name normalization | the `normalizeClientName()` branch in `src/shared/usage.js` |
| UI labels / colours | `CLIENT_LABELS` / `CLIENT_COLORS` in `src/shared-ui/core/data.js`, plus the `ICON_ALIASES` entry if the file name differs from the id |
| Discord RPC | `KNOWN_CLIENT_ASSETS` / `CLIENT_LABELS` in `src/electron/discordRpc.js` |
| Icon assets | `src/shared-ui/icons/clients/<id>.svg` (the one tree both hosts serve) + `.github/assets/tools-icon/<id>.png` |
| WSL discovery | marker(s) in `WSL_DATA_MARKERS` **and** the marker→id mapping in `MARKER_CLIENTS` (`src/shared/wslUsage.js`) — use the exact roots tokscale reads, including alternate roots. A marker without a `MARKER_CLIENTS` entry attributes to nothing, so a WSL home holding only that client's data would be skipped |
| Docs & env examples | the supported-tools table in `README.md` and its translations (`README.*.md`) + the client CSV in `.env.example`. Every locale's prose tool/provider counts must match its own table — `tests/docs/readmeConsistency.test.js` fails on a stale count or a table that drifts between locales |
| Guard tests | the expected-client lists in `tests/shared/clientTracking.test.js` |
| Android client | `CLIENT_LABELS` / `CLIENT_COLORS` in `ClientBranding.kt`, plus the brand SVG in `src/shared-ui/icons/clients/<id>.svg` — `npm run update:fluent-assets` converts it to `res/drawable/client_<id>.xml` and regenerates `ClientIcons.kt`. An SVG that needs filters, gradients or transforms is skipped *by design* and falls back to the letter monogram; nothing breaks, the mark just does not appear |

Two caveats on top of the table:

- Self-synced clients (cursor/antigravity) additionally go in `SELF_SYNCED_CLIENTS`; parse-local clients must NOT.
- A tracked id is not necessarily the id tokscale spells. `tokscale --client` is a clap value-enum: an id outside it is a hard usage error (exit 2, empty stdout), so one unknown id fails the whole scan — every other client in the same call included. `TOKSCALE_CLIENT_RENAMES` / `TOKSCALE_CLIENT_ALIASES` in `collector.js` are therefore load-bearing: rename an id tokscale rejects (`deepseek-harness` → `dsh`), and alias an id whose usage tokscale splits across two (`pi` → `pi,omp`, since 4.14 moved Oh My Pi's `~/.omp` root to its own `omp` client). Every downstream consumer must fold those upstream ids back — `normalizeClientName` for usage rows, and `normalizeGraphClientIds` for the history graph, which tokscale keys by its own ids. `tests/shared/clientTracking.test.js` asserts every default client maps to an id the bundled tokscale actually accepts.

### Data flow contract

The Docker Compose Hub stores normalized device records (`normalizeDeviceRecord` in `usage.js`) and aggregates on read (`aggregateDevices`). The wire shape between device and Hub is whatever `collectUsageOnce()` returns — that function is the source of truth, and `docs/API.md` documents the full contract. The core is `{deviceId, hostname, platform, updatedAt, agentVersion, today, month, allTime}` (each period has `{totalTokens, costUsd, clients, clientCosts, models, modelCosts}`), plus attribution fields (`trackedClients`, `clientStatus`, `wslStatus`, `periodWindows`, `projectsEnabled`) and optional `osName` / `osVersion` / `agentRuntime` / `history` / `limits`.

### Product boundary and architecture governance

`product-scope.json` records the approved architectural boundary for this project: Electron exposes only `local` and `client`, and Hub deployment uses only the root Docker Compose stack. An embedded Hub, a standalone Hub command, and a secondary Worker deployment tree are strictly prohibited. Keep the scope guard in CI, release verification, and `npm run verify`. If future features adjust settings, renderer, build, or deployment files, update the implementation and its guard together.

### Stale devices

A device is "stale" if `Date.now() - receivedAt > staleAfterMs` (default 10 min). Stale devices still appear in `/api/stats` with `stale: true`, and the renderer greys them out — this is intentional, not a bug.

## Conventions

- **Consider best practices first.** When picking an approach — library vs hand-roll, pattern vs custom, framework default vs override — start by checking the ecosystem convention, not by optimizing for "fewer deps" or "less code". If a hand-rolled solution is genuinely better, argue that *after* weighing the convention.
- **This project has external users.** Settings keys, env vars, CLI flags, hub endpoints, and the wire shape (`docs/API.md`) are compatibility surfaces — treat changes to them as breaking and think about migration. Internal code can still be refactored and renamed freely.
- **Don't add dependencies or new tooling without discussing it first** (in the issue or PR description).
- **Keep this file lean and current.** Document non-obvious constraints and gotchas, not descriptions the code already makes obvious. Avoid hardcoded counts and exhaustive lists (prefer a command like `ls src/shared/` over a hand-maintained one); verify claims against the code before writing them; delete anything that has gone stale — an outdated note is worse than none.

### Commit messages

Format: `<type>(<scope>): <subject>` — conventional-commit types (`feat` / `fix` / `refactor` / `docs` / `chore` / `perf` / `test` / …), with a scope when the change targets a clear subsystem (`fix(hermes):`, `fix(collector):`, `feat(limits):`); leave it off for cross-cutting or general changes. Aim for a subject ≤ ~72 chars that describes the actual change. Add a **body** only when the diff doesn't make the *why* obvious — rationale, rejected alternatives, behaviour-preserving notes, linked issues; trivial changes stay single-line. Write body paragraphs as continuous lines, not hard-wrapped.

**Do:**

```
fix(dashboard): balance stat card widths
feat(wsl): scan usage from running WSL distros
docs(i18n): add Japanese README
```

**Don't** — vague subjects, or internal review/agent jargon (`P0`/`P1`, "review findings", "hardening pass"):

```
fix: address P0 review findings   ❌
fix: hardening pass round 2       ❌
fix: various improvements         ❌
```

Never add an AI `Co-Authored-By` trailer. **Do** keep the genuine human `Co-authored-by:` trailer on a multi-author squash (e.g. a maintainer follow-up on a contributor PR) and keep the `(#NN)` PR-number suffix GitHub appends to squash subjects.

### Pull requests

- PR titles follow the commit-message convention above — they become the squash-merge subject.
- In the description: summarize the behaviour change, note the commands you ran (`npm run verify` at minimum), attach screenshots/GIFs for UI changes, and link the related issue.

### Authoring GitHub content via `gh`

Write PR/issue bodies and comments to a file and pass it, rather than inline heredocs: `gh issue comment --body-file <path>`, `gh api -X PATCH … -F body=@<path>`. Inline `--body "$(cat <<EOF … EOF)"` mangles backtick escaping and renders as a literal `` \` `` in GitHub markdown. Same spirit for prose: write paragraphs as continuous lines and let GitHub wrap them — don't hard-wrap at 80 columns.
