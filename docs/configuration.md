# Configuration

Token Monitor has two configuration surfaces:

- **Widget (GUI)** — everything the desktop app does, configured from the `⚙` settings panel. This is the only surface most people need.
- **`.env`** — for the headless agent and the Docker Compose Hub, which have no UI.

The widget reads `.env` values as *first-run defaults*; once you change a setting in the GUI, the saved value takes over. The agent and Docker Compose Hub follow the precedence **CLI flag → env var (real or `.env`) → built-in default**.

---

## Widget (GUI)

Click the `⚙` button in the bottom-right corner of the widget to open the settings panel. Sections appear in this order:

| Section | What it controls |
|---|---|
| **General** | Language, launch at login, app updates, Discord Rich Presence, About, and Advanced (open the raw `settings.json` for less-common options such as `allTimeSince`). |
| **Main** | Which Home modules appear and their order, plus the display currency (USD, TWD, HKD, or CNY; daily auto rate or a manual override). |
| **Window** | Window behavior (float above other apps / normal / desktop-pinned), tray mode (macOS menu bar or Windows system tray, and what shows next to the icon), the floating bubble, and the global show/hide shortcut. |
| **Appearance** | Interface theme (presets such as Default and Obsidian, a porcelain light mode, or custom colors), per-vendor tool colors, and system glass opacity / blur. |
| **Collection** | Tracked tools (and hide / pin / drag-reorder for the main list), collection cadence, **Keep usage from deleted sessions**, custom pricing, data export, and — on Windows — the built-in WSL scan toggle. |
| **AI Tool Limits** | View quota windows received from the Hub. Accounts and credentials are added manually to the Hub; the device does not discover local developer-tool accounts or switch a local provider login. |
| **Multi-device Sync** | **Local only** (no Hub) or **Connect to a Hub** (paste the Docker Compose Hub URL and this device's secret). |

The `⇧` button in the title bar cycles the window behavior.

### Central Hub accounts and quotas

Quota accounts are a Hub-owned resource. Add an account from the widget's
**AI Tool Limits** section while connected to the Docker Compose Hub, or call the Hub's
`/api/accounts` admin API. The request contains a provider, display name, and
the credential supplied by the user. The Hub encrypts the credential at rest,
refreshes the provider on its own schedule, and publishes only normalized quota
snapshots to connected devices. Account listing and quota responses never
return the stored credential.

The device and headless agent collect local usage only. They do not inspect
developer-tool login files, browser profiles, environment credentials, or local
CLI accounts, and they do not upload account credentials. Incoming device
`limits` fields are ignored by the Hub; the `limits` object in `/api/stats` is
the Hub's central result.

The first version using this model intentionally invalidates old device-local
provider credentials and removes the legacy local credential files/settings.
There is no automatic secret migration: every account must be logged in again
manually in the Hub after upgrading. In the single-key deployment, configure
only `TOKEN_MONITOR_SECRET`; the Hub uses it for authentication and derives the
account-encryption key from it. `TOKEN_MONITOR_HUB_CREDENTIAL_KEY` remains an
optional legacy override. Changing the effective encryption key requires
re-adding the affected accounts.

---

## Headless agent & Docker Compose Hub (`.env`)

The agent and Docker Compose Hub have no UI. Configure them with a `.env` file in the project root (copy it from `.env.example`):

```env
TOKEN_MONITOR_HUB_URL=               # required in sync mode — HTTPS Docker Compose Hub URL
TOKEN_MONITOR_SECRET=                # the single Hub key; use the same value on every device
TOKEN_MONITOR_DEVICE_ID=             # optional — defaults to the hostname
TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS= # optional — 0/live, 600000/10min, 1200000/20min, 1800000/30min
TOKEN_MONITOR_COLLECTION_MODE=live    # live, interval, or smart
TOKEN_MONITOR_INTERVAL_MS=300000      # shared periodic collection interval
TOKEN_MONITOR_WATCH=1                 # shared file-watch switch
TOKEN_MONITOR_WATCH_DEBOUNCE_MS=1500  # shared source-event debounce
TOKEN_MONITOR_CLIENTS=               # optional — defaults to all supported tools; empty disables tracking
TOKEN_MONITOR_PROJECTS_ENABLED=      # optional — defaults off; 1 collects project metadata
TOKEN_MONITOR_HISTORY_ENABLED=       # optional — defaults on; 0 skips trend history
TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED= # optional — defaults on; 0 stops archiving deleted-session usage
TOKEN_MONITOR_LIMITS_ENABLED=        # legacy compatibility; device quota probing is removed
TOKEN_MONITOR_LIMIT_PROVIDERS=       # legacy compatibility; Hub accounts select providers
TOKEN_MONITOR_HUB_CREDENTIAL_KEY=    # optional legacy account-encryption override; normally leave empty
QODERCN_CONFIG_DIR=                   # Qoder CN's optional config root; transcript default is $QODERCN_CONFIG_DIR/projects
TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR= # optional direct override for Qoder CN 0.1.x JSONL transcripts
TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH=    # optional direct override for the Qoder 0.1.x main.sqlite store
```

For a trusted LAN/VPN Hub that still uses `http://<lan-ip>:17321`, also set
`TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` on the connecting agent. Remote HTTP is
rejected by default; prefer HTTPS whenever possible. In the single-user mode,
all devices intentionally use the same Hub key. Split admin/viewer/device
credentials remain available only for legacy deployments.

The collection and upload controls above are shared by the widget's Hub client
mode and the headless agent. A widget's saved GUI value overrides its first-run
`.env` default; the headless agent uses CLI flags first, then environment, then
the shared built-in default. `smart` is useful on machines where a periodic,
activity-aware scan is preferable to continuous file watching.

Provider credentials for quota accounts are entered manually in the Hub and
are not read from a device's local developer-tool installation. Proxy settings
used by a Hub-side provider probe remain environment configuration. **`.env.example`
is the complete, authoritative list** — start from it rather than copying keys
by hand, since it stays in sync with the code.

`qoder` quota accounts are manual Hub accounts. `qodercn` is a separate local
usage integration: it reads local Qoder CN usage from its legacy SQLite database
and, for 0.1.x installs, the `com.qoder.app.stable/main.sqlite` conversation
store plus the transcript tree under `QODERCN_CONFIG_DIR/projects` (default
`~/.qoder-cn/projects`). The main database is auto-detected under the platform
application-support directory and can be overridden with
`TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH`; `TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR`
overrides the transcript tree directly. Main-database and transcript token
counts and costs are content estimates and are marked `estimated` in the record;
they do not include provider billing fields, system-prompt, or tool-schema
overhead.

For a target-machine Qoder CN check, run `QODERCN_VERSION=0.1.x npm run evidence:qodercn -- --require-version --require-data`. The command prints only platform/version, source presence, bounded read diagnostics, row counts, model names, and period totals; it never prints source paths, transcript content, cookies, account IDs, or session IDs. Use `--version-file <path>` when the installed app exposes its version in a local manifest. A result of `NOT RUN` means the machine has no readable source or no non-zero usage yet; a result of `FAIL` requires investigation before claiming the real-environment acceptance as complete.

For a trusted LAN/VPN Hub that still uses non-loopback HTTP, keep the default blocked state until the user explicitly enables the trusted-LAN option in the widget (or sets `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` for the agent). Upgrading an old HTTP profile does not silently enable cleartext transport; the widget continues local collection while Hub read/write/stream status reports the blocked transport.

The widget reads these as first-run defaults; the agent and Docker Compose Hub take a CLI flag over an env var over the built-in default.

One-shot run (collect once and exit — useful for cron / launchd):

```bash
npm run agent -- --clients=claude,codex,opencode --once
```
