# Configuration

Token Monitor has two configuration surfaces:

- **Desktop app (GUI)** — everything the desktop app does, configured from Settings. This is the only surface most people need.
- **`.env`** — for the headless agent and the Docker Compose Hub, which have no UI.

The desktop app reads `.env` values as *first-run defaults*; once you change a setting in the GUI, the saved value takes over. The agent and Docker Compose Hub follow the precedence **CLI flag → env var (real or `.env`) → built-in default**.

---

## Desktop app (GUI)

Open **Settings** from the sidebar or the app menu. The desktop app and the Hub
web dashboard share one interface, so the shared preferences below are also
available in a browser; the device-local groups only appear in the desktop app.

Shared preferences (both hosts):

| Group | What it controls |
|---|---|
| Language & currency | Interface language and the display currency (USD, TWD, HKD, or CNY; daily auto rate or a manual override). |
| Theme | Light / dark / system, applied to whichever host renders the page. |
| Home limits | How many accounts the home screen's limit block shows. |
| Accounts / Management | Hub-owned quota accounts (including OAuth sign-in), subscriptions, and model pricing. |
| Connection & PWA | The web host's own panel: current origin, authorized role, live stream state, advertised capabilities, and the install prompt. |

Device-local groups (desktop app only):

| Group | What it controls |
|---|---|
| Collection | Tracked tools, collection mode (`live` / `smart` / `interval`) and interval, project metadata, trend history and its interval, **Keep usage from deleted sessions**, `allTimeSince`, and — on Windows — the built-in WSL scan toggle. |
| Data export | Automatic export toggle, export folder, export interval, and export-now. |
| Window & appearance | Native window backdrop (plus the macOS glass style choice), motion, tool icons, live indicator, compact token total, title icon, and zoom. |
| Limit display | Presentation of received quota windows only: show source, mask account e-mails, remaining vs used bars. Accounts and credentials live on the Hub — the device does not discover local developer-tool accounts. |
| Startup & updates | Start at login (with the Linux AppImage caveat), automatic update downloads, check-for-updates now, Discord Rich Presence, and open the data folder. |
| Device identity | The device ID this machine reports to the Hub. |
| View & list preferences | Per-list visibility and order for views, tools, home modules, home limit providers, and service providers; the home limit bar count; the service-status refresh cadence; the heatmap metric; and the active-days window. |
| Currency & advanced | The exchange-rate override map and the theme colour map, both edited as JSON. |
| Hub connection | **Local only** (no Hub) or **Connect to a hub** (Docker Compose Hub URL, upload interval, and the trusted-LAN HTTP opt-in). |

### Central Hub accounts and quotas

Quota accounts are a Hub-owned resource. Add an account from the app's
**Accounts** view (or the Hub dashboard) while connected to the Docker Compose
Hub, or call the Hub's `/api/accounts` admin API. The request contains a provider, display name, and
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

Antigravity (`agy`) accounts can be added with the OAuth wizard instead of pasting
an endpoint and CSRF token: the Hub generates a Google consent link and the user
pastes back the authorization code Google displays on its page. That code — not
the page URL, which does not carry it — is what the Hub exchanges. The Hub pins
the public installed-app client secret that Google requires for this client;
`AGY_OAUTH_CLIENT_SECRET` overrides it if Google ever rotates that value.

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

The collection and upload controls above are shared by the desktop app's Hub client
mode and the headless agent. A saved GUI value overrides the first-run
`.env` default; the headless agent uses CLI flags first, then environment, then
the shared built-in default. `smart` is useful on machines where a periodic,
activity-aware scan is preferable to continuous file watching.

Provider credentials for quota accounts are entered manually in the Hub and
are not read from a device's local developer-tool installation. Proxy settings
used by a Hub-side provider probe remain environment configuration. **`.env.example`
is the authoritative operator-facing list** — start from it rather than copying keys
by hand, since it stays in sync with the code. It deliberately does not carry the
lower-level Hub runtime knobs (bind host and port, TLS paths, staleness window,
stats TTL, account concurrency, probe deadline, trusted-proxy) that the supported
deployment passes in `docker-compose.yml`, nor per-provider CLI/timeout overrides;
those are read from the environment but are not meant to be configured by hand.

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

For a trusted LAN/VPN Hub that still uses non-loopback HTTP, keep the default blocked state until the user explicitly enables the trusted-LAN option in the app (or sets `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` for the agent). Upgrading an old HTTP profile does not silently enable cleartext transport; the app continues local collection while Hub read/write/stream status reports the blocked transport.

The desktop app reads these as first-run defaults; the agent and Docker Compose Hub take a CLI flag over an env var over the built-in default.

One-shot run (collect once and exit — useful for cron / launchd):

```bash
npm run agent -- --clients=claude,codex,opencode --once
```

---

## Further reading

- [Hub deployment with Docker Compose](hub-compose.md) — the only supported Hub deployment.
- [Headless agent](headless-agent.md) — running the collector without the desktop app.
- [Hub HTTP API](API.md) — the device ↔ Hub wire contract and every endpoint.
- [Data export](export.md) — the tool-agnostic CSV + JSON format.
- [GitHub Copilot OTel](github-copilot-otel.md) — what the Copilot integration reads from the editor's OTel output.
- [Upstream tokscale usage providers](upstream-tokscale-usage-providers.md) — what the bundled tokscale actually scans, verified against its source.
- [Tokscale alignment plan](TOKSCALE_ALIGNMENT_PLAN.md) — why this project's client coverage matches tokscale's, and where it still differs.
- [Limits provider expansion research](LIMITS_PROVIDER_EXPANSION_RESEARCH.md) — per-provider quota endpoints and how each account-limit surface was chosen.
- [Provider accounts and limits analysis](PROVIDER_ACCOUNTS_AND_LIMITS_ANALYSIS.md) — the Hub-owned account model and the current quota surfaces.
