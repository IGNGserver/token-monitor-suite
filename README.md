<p align="right">
   <strong>EN</strong> | <a href="./README.zh-CN.md">简</a> | <a href="./README.zh-TW.md">繁</a> | <a href="./README.ko.md">KO</a> | <a href="./README.ja.md">JA</a>
</p>
<div align="center">
    <img src=".github/assets/app.png" alt="Token Monitor logo" width="120">
    <h1>Token Monitor</h1>
</div>

<p align="center">
    <em>One live dashboard for every AI coding tool, synced across every machine.</em>
</p>

<p align="center">
    <a href="https://github.com/IGNGserver/token-monitor-suite/releases"><img src="https://img.shields.io/github/v/release/IGNGserver/token-monitor-suite?include_prereleases&style=flat-square&label=release&color=22c55e" alt="Latest release" /></a>
    <a href="https://github.com/IGNGserver/token-monitor-suite/releases"><img src="https://img.shields.io/github/downloads/IGNGserver/token-monitor-suite/total?style=flat-square&color=22c55e" alt="Total downloads" /></a>
    <img src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=flat-square" alt="Windows 10 or later" />
    <img src="https://img.shields.io/badge/macOS-12%2B-0A84FF?style=flat-square&logo=apple&logoColor=white" alt="macOS 12 or later" />
    <img src="https://img.shields.io/badge/Linux-x64-64748b?style=flat-square&logo=linux&logoColor=white" alt="Linux x64" />
    <a href="https://discord.gg/HmdNVVvw5P"><img src="https://img.shields.io/discord/1344259784219689031?color=5865F2&label=Discord&logo=discord&logoColor=white&style=flat-square" alt="Discord"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-A855F7?style=flat-square" alt="License: MIT" /></a>
</p>

<div align="center">
    <img src=".github/assets/demo.gif">
</div>

## What is Token Monitor?

A desktop widget that shows live token usage and AI Tool Limits across 31+ AI coding tools — Claude Code, Codex, Cursor, GitHub Copilot, and more — with real-time multi-device sync, historical usage trends, and breakdowns by tool, device, model, session, or project.

## Supported Tools

Token Monitor supports token usage, account-limit checks, and session details separately:

| Logo | Tool | Data path | Token Usage | AI Tool Limits | Session Details |
|:---:|------|-----------|:---:|:---:|:---:|
| <img src=".github/assets/tools-icon/claude.png" width="28" alt="Claude Code" /> | Claude Code | `~/.claude/projects/`, `~/.claude/transcripts/` | ✅ | ✅ | ✅ |
| <img src=".github/assets/tools-icon/codex.png" width="28" alt="Codex" /> | Codex | `~/.codex/` (`sessions/`, `archived_sessions/`) | ✅ | ✅ | ✅ |
| <img src=".github/assets/tools-icon/opencode.png" width="28" alt="OpenCode" /> | OpenCode | `~/.local/share/opencode/` (`opencode*.db`, `storage/message/`) | ✅ | ✅ | ✅ |
| <img src=".github/assets/tools-icon/hermes-agent.png" width="28" alt="Hermes Agent" /> | Hermes Agent | `~/.hermes/state.db` | ✅ | — | — |
| <img src=".github/assets/tools-icon/openclaw.png" width="28" alt="OpenClaw" /> | OpenClaw | `~/.openclaw/agents/` | ✅ | — | — |
| <img src=".github/assets/tools-icon/cursor.png" width="28" alt="Cursor" /> | Cursor | `~/.config/tokscale/cursor-cache/` | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/antigravity.png" width="28" alt="Antigravity" /> | Antigravity | `~/.gemini/` (`antigravity/`, `antigravity-ide/`, `antigravity-backup/`, `antigravity-cli/conversations/`) | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/cline.png" width="28" alt="Cline" /> | Cline | VS Code globalStorage tasks (`.../saoudrizwan.claude-dev/tasks/`), `~/.cline/data/sessions/` | ✅ | — | — |
| <img src=".github/assets/tools-icon/kimi.png" width="28" alt="Kimi" /> | Kimi CLI / Kimi Code | `~/.kimi/sessions/`, `~/.kimi-code/sessions/` | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/qwen.png" width="28" alt="Qwen" /> | Qwen CLI | `~/.qwen/projects/` | ✅ | — | — |
| <img src=".github/assets/tools-icon/xai.png" width="28" alt="Grok Build" /> | Grok Build | `~/.grok/` (`sessions/`, `logs/unified.jsonl`) | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/copilot.png" width="28" alt="GitHub Copilot" /> | GitHub Copilot | VS Code `workspaceStorage/*/chatSessions/`, `~/.copilot/` (`otel/`, `data.db`) | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/pi.png" width="28" alt="Pi" /> | Pi / Oh My Pi | `~/.pi/agent/sessions/`, `~/.omp/agent/sessions/` | ✅ | — | — |
| <img src=".github/assets/tools-icon/zed.png" width="28" alt="Zed" /> | Zed | `~/.local/share/zed/threads/threads.db` | ✅ | — | — |
| <img src=".github/assets/tools-icon/kilocode.png" width="28" alt="Kilo Code" /> | Kilo Code | VS Code globalStorage tasks (`.../kilocode.kilo-code/tasks/`) — Linux & remote/WSL only | ✅ | — | — |
| <img src=".github/assets/tools-icon/commandcode.png" width="28" alt="Command Code" /> | Command Code | `~/.commandcode/projects/**/*.jsonl` | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/mimo-code.png" width="28" alt="MiMo Code" /> | MiMo Code | `~/.local/share/mimocode/mimocode.db` | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/zcode.png" width="28" alt="ZCode" /> | ZCode / GLM | `~/.zcode/` (`projects/`, `cli/db/db.sqlite`) | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/kiro.png" width="28" alt="Kiro" /> | Kiro | `~/.kiro/sessions/cli/`, Kiro IDE globalStorage & `kiro-cli` DB | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/codebuddy.png" width="28" alt="CodeBuddy" /> | CodeBuddy | `~/.codebuddy/projects/` + IDE / VS Code extension logs | ✅ | — | — |
| <img src=".github/assets/tools-icon/workbuddy.png" width="28" alt="WorkBuddy" /> | WorkBuddy | `~/.workbuddy/projects/`, `~/.workbuddy/workbuddy.db` | ✅ | — | — |
| <img src=".github/assets/tools-icon/proma.png" width="28" alt="Proma" /> | Proma | `~/.proma/agent-sessions/*.jsonl` | ✅ | — | — |
| <img src=".github/assets/tools-icon/deepseek-harness.svg" width="28" alt="DeepSeek Harness" /> | DeepSeek Harness | `$DSH_HOME/sessions/` (default `~/.dsh/sessions/`; `session.jsonl.zstd`) | ✅ | — | ✅ |
| <img src=".github/assets/tools-icon/qoder.png" width="28" alt="Qoder" /> | Qoder | `<platform-app-data>/QoderCN/SharedClientCache/cache/db/local.db` (CN only); Qoder dashboard cookie (big-model credits via Qoder usage API) | ✅ | ✅ | — |
| <img src=".github/assets/tools-icon/reasonix.png" width="28" alt="Reasonix" /> | Reasonix | `~/.reasonix/` (`stats/`, `sessions/`, `projects/*/sessions/`) | ✅ | — | — |
| <img src=".github/assets/tools-icon/deepseek.png" width="28" alt="DeepSeek" /> | DeepSeek | DeepSeek API key (balance via DeepSeek API) | — | ✅ | — |
| <img src=".github/assets/tools-icon/openrouter.png" width="28" alt="OpenRouter" /> | OpenRouter | OpenRouter API key (usage/key limit; balance when credits access is authorized, documented for Management keys) | — | ✅ | — |
| <img src=".github/assets/tools-icon/minimax.png" width="28" alt="Minimax" /> | Minimax | Minimax API key (Token Plan quota via Minimax API) | — | ✅ | — |
| <img src=".github/assets/tools-icon/volcengine.png" width="28" alt="Volcengine" /> | Volcengine | Ark API key or Volcengine AK/SK (Ark Coding Plan quota via Volcengine API) | — | ✅ | — |
| <img src=".github/assets/tools-icon/ollama.png" width="28" alt="Ollama" /> | Ollama | Ollama Cloud cookie (session/weekly usage via ollama.com/settings) | — | ✅ | — |
| <img src=".github/assets/tools-icon/newapi.png" width="28" alt="Third-party APIs" /> | Third-party APIs | New API-compatible account preset (including compatible One API forks), New API API-key preset, and a declarative Custom balance endpoint | — | ✅ | — |

<details>
<summary><strong>Notes, Custom balance endpoints, and data paths overridden by environment variables</strong></summary>

<br>

- Paths above are the defaults. Token Monitor follows the same environment overrides Tokscale does — `$XDG_DATA_HOME` for the `~/.local/share/` roots, and per-tool variables such as `$CODEX_HOME`, `$GROK_HOME`, `$HERMES_HOME`, `$KIMI_CODE_HOME`, `$REASONIX_STATE_HOME`, `$REASONIX_HOME` and the `$CLINE_*` family.

- Command Code transcripts do not contain actual token counts or per-message model metadata. Token usage is estimated from transcript text, while model attribution and derived cost may reflect the currently configured model rather than the model historically used for each request.

- Custom maps numeric JSON fields from one GET balance endpoint; OpenAI or Anthropic compatibility alone is not enough.

#### Qoder CN (local adapter)

Set Qoder CN's own `QODERCN_CONFIG_DIR` when its profile is relocated; Token Monitor then watches `<that-dir>/projects` unless `TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR` is set.

Qoder CN token usage is read from the app's local SQLite database, not an API — enable it in Settings → tools (opt-in, off by default). The legacy database is auto-detected per platform: macOS `~/Library/Application Support/QoderCN/SharedClientCache/cache/db/local.db`, Windows `%APPDATA%\QoderCN\SharedClientCache\cache\db\local.db`, Linux `~/.config/QoderCN/SharedClientCache/cache/db/local.db` — overridable with `TOKEN_MONITOR_QODER_CN_DB_PATH`. Qoder CN 0.1.x also stores conversation messages in `com.qoder.app.stable/main.sqlite` under the platform application-support directory; override it with `TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH` when needed. It may additionally write `~/.qoder-cn/projects/**/*.jsonl`; that transcript root is watched for live updates and can be changed with `TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR`.

This is an advanced local integration: reading needs a `sqlite3` CLI on PATH or a Node runtime with unflagged `node:sqlite` (Node ≥ 23.4; the Electron widget may need the CLI). Read failures are logged, and an existing complete snapshot is retained instead of being replaced with zero usage. Main-database and transcript rows use a blended estimate of CJK characters / 1.5 and other characters / 4; request input is the cumulative session context and output is that request's stored content. Provider billing fields, system prompts, and tool schemas are not available in these local records, so those totals and costs are marked `estimated` and are not exact provider token billing. Costs are estimated from the models.dev catalog for each mapped model; the adapter may break if Qoder changes its database schema.

#### Qoder account limits

`qoder` quota accounts are added manually to the Hub, separate from the local `qodercn` usage adapter. The Hub encrypts the supplied credential, refreshes the account quota, and distributes the normalized result to connected devices. Device-side automatic discovery of local Qoder logins, browser profiles, environment credentials, and CLI accounts is removed; the device never uploads those credentials or treats them as quota sources.
</details>

## Showcase

<table>
<tr>
<td width="290" align="center"><img src=".github/assets/home-view.png" width="250" alt="Home View"><br><sub>Customizable dashboard — choose which modules show and their order</sub></td>
<td width="290" align="center"><img src=".github/assets/limits-view.png" width="250" alt="Limits View"><br><sub>Hub-managed accounts and refreshed quotas across devices</sub></td>
<td width="290" align="center"><img src=".github/assets/tools-view.png" width="250" alt="Tools View"><br><sub>Click any tool to expand input / output and cache-hit detail</sub></td>
</tr>
<tr>
<td width="290" align="center"><img src=".github/assets/sessions-view.png" width="250" alt="Session View"><br><sub>Open a single session to break each prompt into tokens and tools used</sub></td>
<td width="290" align="center"><img src=".github/assets/models-view.png" width="250" alt="Models View"><br><sub>Every model's usage and cost, aggregated across tools</sub></td>
<td width="290" align="center"><img src=".github/assets/devices-view.png" width="250" alt="Devices View"><br><sub>Each device's usage, cost, and sync status — expand for per-machine detail</sub></td>
</tr>
</table>

<table>
<tr>
<td width="435" align="center"><img src=".github/assets/dashboard-overview.png" width="400" alt="Usage Dashboard Overview"><br><sub>A year of activity heatmap and streaks, aggregated across all devices</sub></td>
<td width="435" align="center"><img src=".github/assets/dashboard-trends.png" width="400" alt="Usage Dashboard Trends"><br><sub>A year of daily trends, stacked by tool / model, with K-line</sub></td>
</tr>
</table>

## Why Token Monitor?

Most usage monitors are useful on the machine they run on. Token Monitor is built for multi-device work: each device watches its own local logs, sends summary updates to your hub, and every connected widget sees token changes almost immediately.

## Features

### Tracking usage

- **Live token tracking** — Claude Code, Codex, Cursor, GitHub Copilot, Antigravity, OpenCode, and 25+ AI tools, with the UI updating within seconds of each turn (full list in the table above)
- **Per-session detail** — open a Claude Code, Codex, or OpenCode session to see tokens per prompt, expandable to each reply's exact token split and tools used (read on-demand from local transcripts or databases, never synced)
- **Cache hit statistics** — click any tool or model to expand a detailed breakdown of input tokens (cache hit vs miss), output tokens, and hit-rate percentages
- **Cost & currency** — cost alongside token counts, shown in USD, TWD, HKD, or CNY; exchange rates auto-update daily and can be manually overridden in Settings
- **WSL usage (Windows)** — file-based usage from a running WSL distro is detected automatically and merged about every 5 minutes; SQLite-backed tools such as OpenCode and Hermes may require a [headless agent inside WSL](docs/wsl-sqlite-setup.md)

### Limits, trends & export

- **AI Tool Limits detection** — provider-specific session, weekly, billing, and credits windows for Claude Code, Codex, Cursor, OpenRouter, third-party APIs, GLM, Kimi, and 19+ providers, including multiple OpenRouter/third-party profiles and DeepSeek prepaid balance/spend
- **Hub-managed account quotas** — add multiple provider accounts manually, keep their credentials in the Hub, refresh quotas centrally, and distribute the results to every connected device
- **Preserve deleted session usage** — many tools prune old sessions (Claude Code drops transcripts after 30 days by default), losing that history. When enabled, Token Monitor archives observed daily tool/model usage locally so the heatmap and trends survive even after the source files are gone (see [Session data retention](#session-data-retention) below)
- **Usage Trends & Dashboard** — a home-screen activity heatmap and trend chart, plus a dedicated dashboard window with streaks and stacked per-tool/per-model history (bar and K-line views) across all your devices
- **Optional Status view** — Claude, OpenAI, Cursor, and DeepSeek status pages, with manual or interval re-checks
- **Data export** — export usage as tool-agnostic CSV + JSON, manually or auto-written to a folder, for spreadsheets, Obsidian, Grafana, or scripts; see [docs/export.md](docs/export.md)
- **Subscription records** — record by hand what each AI account actually costs; the plan label's tooltip then reports the price, the next renewal or end date, time subscribed, and the month's usage cost as a multiple of what the plan costs, for recurring plans and top-up ledgers alike

### Multi-device & deployment

- **Real-time multi-device sync** — Server-Sent Events push an update on one device to the others within seconds
- **Local-first** — no servers needed for single-device use
- **Self-hosted sync backend** — Docker Compose Hub
- **iOS widget support** — Widgy and Scriptable clients can use the self-hosted Hub API
- **Privacy-first** — prompts, responses, source code, and file contents stay on your machine

### Interface & surfaces

- **Breakdown views** — grouped by tool, device, model, session, project, or account limits
- **Menu bar (macOS) and system tray (Windows) popover** — live cost, tokens, or the closest-to-empty provider limit % next to the icon
- **Floating Bubble mode** — collapses the widget into a draggable mini-window with click or hover preview and tray-style content
- **Menu bar layout composer** — the menu bar and the floating bubble can use a built-in preset or a layout you build yourself: pick "Custom…" to add AI tool icons, quota bars, percentages, reset times, cost, or custom text, drag to reorder against a live preview, and give each item its own AI tool, account, quota window, and typeface
- **Appearance controls** — interface theme switching (incl. a light mode), per-tool vendor colours, glass opacity, blur, and transparent window mode
- **Experimental native macOS Widget** — macOS 14+ support in Small, Medium, and Large sizes, with Overview, Quota, Models, Activity, and Trend pages. This source-only preview is not yet promised in published releases.
- **Customizable tool list** — hide, pin, and reorder tools in the main dashboard without changing what gets tracked
- **Recordable global shortcut** — show or hide the window from anywhere
- **Discord Rich Presence** — broadcast today's tokens, cost, and top client (opt-in)

## Installation

Download from [GitHub Releases](https://github.com/IGNGserver/token-monitor-suite/releases).

- **macOS (Apple Silicon)** — `.dmg`, signed and notarized
- **macOS (Intel)** — x64 `.dmg`, signed and notarized
- **Windows 10/11** — setup and portable `.exe`, [code-signed](docs/code-signing.md)
- **Linux x64** — `.AppImage`
- **No-GUI/server** — `Token-Monitor-Headless-<version>.tar.gz`; install with Node.js 22.13+ and `npm ci --omit=dev`

Packaged builds check GitHub Releases automatically. When an update is available, the app shows an update indicator; supported platforms can also install from Settings → General.

### First run

Local mode is the default: launch the app and it starts tracking this device. No hub, agent, or config required.

## Multi-device sync

When you want multi-device sync, connect all devices (and any headless agents) to the same Docker Compose Hub. On each device, open the widget and choose **Connect to a hub** under Settings → Multi-device Sync. The widget contributes this device's usage automatically; run `npm run agent` only on machines without a widget. For a no-GUI install, use the [headless agent guide](docs/headless-agent.md) and the `Token-Monitor-Headless-<version>.tar.gz` release asset.

For this single-user project, `TOKEN_MONITOR_SECRET` is the one Hub key used by every device and it covers read, ingest, and administrative operations, including manually managed quota accounts. Older split admin/viewer/device credentials remain available only as a compatibility mode. Remote connections require HTTPS by default; desktop/agent HTTP needs an explicit trusted-LAN opt-in, while Android release builds always require HTTPS.

An older profile that points to a non-loopback `http://` Hub is not silently weakened during upgrade: local collection continues, while Hub read/upload/stream remain blocked until HTTPS is configured or the user explicitly enables the trusted-LAN option. The sync settings panel reports those channels separately and can recover them in the same process after the setting changes.

#### Option A — Local only (default)

Use the widget's local mode for a single device. It reads this machine's local data directly and does not require a Hub or an agent.

#### Option B — Connect to a Docker Compose Hub

Deploy the root `docker-compose.yml` on an always-on machine:

```bash
cp .env.example .env
# set TOKEN_MONITOR_SECRET and the MySQL passwords in .env
docker compose up -d
```

In every widget, choose **Connect to a hub** under Settings → Multi-device Sync, then enter the Hub URL and the same Hub key. On machines without a widget, configure the same URL and key and run `npm run agent`.

The root Docker Compose stack is the only supported Hub deployment. It provides the HTTP API, dashboard, PWA, device ingest, and SSE stream for every connected client.

## App data

App state lives in the OS user-data dir — delete it along with the app to fully uninstall.

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Token Monitor/` |
| Windows | `%APPDATA%/Token Monitor/` |
| Linux | `~/.config/Token Monitor/` |

## Build from source

To build your own installer, use Node.js 22.13+ on the **target** OS (electron-builder can't cross-build a macOS `.dmg` on Windows, or vice-versa).

```bash
npm install
npm run dist:mac     # macOS arm64 .dmg           → dist/
npm run dist:mac:x64 # macOS Intel x64 .dmg       → dist/
npm run dist:win     # Windows x64 installer .exe → dist/
npm run dist:linux   # Linux x64 AppImage         → dist/
npm run pack         # unpacked app dir (no installer), for quick local testing
```

Output lands in `dist/`. Windows and Linux use the matching `dist:*` script above on the target OS. Packaging the macOS release build requires a local Developer ID Application signing identity; use `npm start` for local development or unsupported platforms.

## How it works

```text
Mode A — Local (default, no setup)
    widget (Electron) ──▶ tokscale ──▶ ~/.claude, ~/.codex, $HERMES_HOME

Mode B — Sync (opt-in, multi-device)
    device A agent ──▶
    device B agent ──▶  hub  ──▶  widget on any device
    device C agent ──▶
```

The widget chooses local vs sync mode based on Settings → Multi-device Sync. The Docker Compose Hub receives each device's normalized summary and pushes aggregated stats to connected clients over Server-Sent Events, so updates on one device appear on the others within a few seconds.

## Session data retention

With **Preserve deleted session usage** enabled (Settings → Collection), Token Monitor archives observed daily tool/model usage locally with no time limit — so even after a source tool prunes its own sessions, the heatmap and trends are unaffected.

<details>
<summary><strong>Advanced: extend the source tool's own retention</strong></summary>

<br>

The heatmap and sync payload use a rolling 370-day window (older observations remain available locally for future views). **Claude Code keeps only 30 days of transcripts by default** (`cleanupPeriodDays`); to keep the full rolling year before the archive kicks in, raise it in `~/.claude/settings.json` before the window passes:

```json
{
  "cleanupPeriodDays": 370
}
```

A larger value keeps more, at the cost of transcripts living on disk for as long as you set. tokscale's [Session Data Retention](https://github.com/junhoyeo/tokscale#session-data-retention) table covers the other tools' defaults and config paths.

This archive only covers days Token Monitor has already observed; data deleted before it started tracking cannot be recovered.

</details>

## Settings

There are two places to configure Token Monitor; day-to-day use only needs the first:

- **Widget (GUI)** — click the `⚙` button in the bottom-right corner. Sections, in order: General (language, launch at login, updates), Main (Home modules and display currency), Window (window behavior, menu bar and floating-bubble layout, tray mode, shortcut), Appearance (theme and vendor colours), Collection (tracked tools, collection cadence, Preserve deleted session usage, data export), AI Tool Limits (provider selection, limits, and credentials), Subscriptions (what you pay per account), and Multi-device Sync. The `⇧` button in the title bar cycles the window behavior.
- **Headless agent & hub** — no UI; configured with a `.env` file at the project root (copy from `.env.example`), precedence CLI flag → env var → built-in default.

See the [configuration reference](docs/configuration.md) for every setting and all environment variables.

## Tested Environments & Platform Compatibility

Token Monitor is developed and tested primarily in the environments below. **Platforms and setups outside this list have not been fully verified and may encounter unexpected issues.** Feedback and PRs are welcome:

- **Docker Compose Hub**: Verified for multi-device sync, aggregation, and SSE streaming.
- **Windows 11**: Primary development and testing platform.
  - Main tested coding tools: **Codex**, **OpenCode**.
  - Lightly tested tools: **Antigravity**, **Claude Desktop**.
- **Ubuntu**: Only headless agent **data reporting/ingest** has been tested; day-to-day coding workflows and complete client operation have not been comprehensively verified on this platform.

## Privacy

Token Monitor processes usage logs locally and sends no analytics or telemetry to the project maintainer. Network access occurs only for documented or user-enabled features. See the [privacy policy](docs/privacy.md) for the data used by updates, provider integrations, Discord Rich Presence, and optional multi-device sync.

## Star History

<a href="https://github.com/IGNGserver/token-monitor-suite/tree/star-history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IGNGserver/token-monitor-suite/star-history/star-history-dark.svg" />
   <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/IGNGserver/token-monitor-suite/star-history/star-history.svg" />
   <img alt="Star History Chart" src="https://raw.githubusercontent.com/IGNGserver/token-monitor-suite/star-history/star-history.svg" />
 </picture>
</a>

## Contributing

Issues and PRs are welcome. Project conventions, architecture notes, and the command reference live in [AGENTS.md](AGENTS.md) — written for coding agents, but it doubles as the contributor guide.

## Acknowledgments

- [tokscale](https://github.com/junhoyeo/tokscale) for log parsing and token accounting.
- [CodexBar](https://github.com/steipete/CodexBar) for AI Tool Limits research.
- [Token Monitor](https://github.com/Javis603/token-monitor) by [@Javis](https://github.com/Javis603) for the initial desktop architecture and inspiration.
- **[Code signing policy](docs/code-signing.md):** Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## Token Monitor Suite

This repository is an independent suite providing full cross-platform coverage and deployment surfaces:

- **Claude Desktop Local Agent / Cowork** usage and session details.
- **Android client** for viewing synced usage from the MySQL-backed Docker Compose Hub.
- **MySQL Hub** with the Docker Compose deployment for ingest, stats, history, and SSE surfaces.
- The project release stream and package metadata live at [IGNGserver/token-monitor-suite](https://github.com/IGNGserver/token-monitor-suite).

## License

[MIT](LICENSE) © [IGNGserver](https://github.com/IGNGserver) & [@Javis](https://github.com/Javis603)
