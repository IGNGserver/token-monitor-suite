# Configuration

Token Monitor has two configuration surfaces:

- **Desktop app (GUI)** — display, behaviour, and Hub connection, configured from Settings.
- **`.env` / `settings.json`** — collection cadence, export, custom pricing, and the
  other device-local keys; also the only surface for the headless agent and the
  Docker Compose Hub, which have no UI.

The desktop app reads `.env` values as *first-run defaults*; once a value is in
`settings.json` it takes over. The agent and Docker Compose Hub follow the
precedence **CLI flag → env var (real or `.env`) → built-in default**.

**Every supported tool is always tracked.** There is no client-selection setting
on any surface: the desktop app and the agent both collect the full wired list,
so a persisted or `TOKEN_MONITOR_CLIENTS`-style subset is ignored and removed.

---

## Desktop app (GUI)

Open **Settings** from the sidebar or the app menu. The desktop app and the Hub
web dashboard share one interface, so the shared preferences below are also
available in a browser; the device-local groups only appear in the desktop app.

Shared preferences (both hosts):

| Group | What it controls |
|---|---|
| Preferences | Interface language, theme, and display currency (USD, TWD, HKD, or CNY; daily auto rate or a manual override). The browser host additionally sets the home-screen limit-account count and holds the Hub key. |
| Accounts / Management | Hub-owned quota accounts (including OAuth sign-in), subscriptions, and model pricing. |

Device-local groups (desktop app only):

| Group | What it controls |
|---|---|
| Display | Interface language, native window surface (Windows acrylic/mica included), and motion. |
| Behaviour | Start at login (with the Linux AppImage caveat), start hidden when launched at sign-in, keep running in the tray when the window is closed, automatic update downloads, and check-for-updates / install-now actions. |
| Connection | **Local only** (no Hub) or **Connect to a hub** (Docker Compose Hub URL, the single Hub key, the trusted-LAN HTTP opt-in, and the device ID). |
| Device data transfer | Move this device's ledger, sessions, periods, and history onto another device on the same Hub. |

Keys without a GUI keep their normal `settings.json` / `.env` behaviour:
collection mode and interval, project metadata, trend history, the file-watch
toggle and debounce, session archiving, data export, custom model pricing,
per-list view preferences, and the JSON colour/rate maps. Tracked tools are not
among them — that list is fixed and every supported tool is always collected.

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
CLI accounts, and they do not upload account credentials. In other words, the
desktop app does not discover local developer-tool accounts; quota accounts are
added to the Hub by the operator. Incoming device
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
TOKEN_MONITOR_PROJECTS_ENABLED=      # optional — defaults off; 1 collects project metadata
TOKEN_MONITOR_HISTORY_ENABLED=       # optional — defaults on; 0 skips trend history
TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED= # optional — defaults on; 0 stops archiving deleted-session usage
TOKEN_MONITOR_LIMITS_ENABLED=        # legacy compatibility; device quota probing is removed
TOKEN_MONITOR_LIMIT_PROVIDERS=       # legacy compatibility; Hub accounts select providers
TOKEN_MONITOR_HUB_CREDENTIAL_KEY=    # optional legacy account-encryption override; normally leave empty
TOKEN_MONITOR_QODER_TRANSCRIPTS_DIR=    # optional direct override for the international Qoder JSONL transcripts
TOKEN_MONITOR_QODER_MAIN_DB_PATH=       # optional direct override for the international Qoder main.sqlite store
QODERCN_CONFIG_DIR=                   # Qoder CN's optional config root; transcript default is $QODERCN_CONFIG_DIR/projects
TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR= # optional direct override for Qoder CN JSONL transcripts
TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH=    # optional direct override for the Qoder CN main.sqlite store
```

For a trusted LAN/VPN Hub that still uses `http://<lan-ip>:17321`, also set
`TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` on the connecting agent. Remote HTTP is
rejected by default; prefer HTTPS whenever possible. In the single-user mode,
all devices intentionally use the same Hub key. Split admin/viewer/device
credentials remain available only for legacy deployments.

The collection and upload controls above are shared by the desktop app's Hub
client mode and the headless agent. The desktop app reads them from
`settings.json` (seeded from `.env` on first run); the headless agent uses CLI
flags first, then environment, then the shared built-in default. `smart` is
useful on machines where a periodic, activity-aware scan is preferable to
continuous file watching. The tracked-tool list is not configurable on either
side: every supported tool is always collected.

Provider credentials for quota accounts are entered manually in the Hub and
are not read from a device's local developer-tool installation. Proxy settings
used by a Hub-side provider probe remain environment configuration. **`.env.example`
is the authoritative operator-facing list** — start from it rather than copying keys
by hand, since it stays in sync with the code. It deliberately does not carry the
lower-level Hub runtime knobs (bind host and port, TLS paths, staleness window,
stats TTL, account concurrency, probe deadline, trusted-proxy) that the supported
deployment passes in `docker-compose.yml`, nor per-provider CLI/timeout overrides;
those are read from the environment but are not meant to be configured by hand.

`qoder` quota accounts are manual Hub accounts. The `qoder` and `qodercn` local
usage integrations are separate from them, and separate from each other: the
international and China editions keep distinct profiles, so each is tracked as
its own client. Each site probes three sources and uses whichever exist:
the transcript tree under its profile (`~/.qoder/projects`, or
`QODERCN_CONFIG_DIR/projects` defaulting to `~/.qoder-cn/projects`), which is the
primary source in current builds; the desktop `com.qoder.app.stable/main.sqlite`
(or `com.qodercn.app.stable/main.sqlite`) conversation store, auto-detected under
the platform application-support directory and overridable with
`TOKEN_MONITOR_QODER_MAIN_DB_PATH` / `TOKEN_MONITOR_QODER_CN_MAIN_DB_PATH`; and
the legacy `Qoder/SharedClientCache/cache/db/local.db` (or the same path under
`QoderCN/`) cache database, overridable with `TOKEN_MONITOR_QODER_DB_PATH` /
`TOKEN_MONITOR_QODER_CN_DB_PATH`. `TOKEN_MONITOR_QODER_TRANSCRIPTS_DIR` and
`TOKEN_MONITOR_QODER_CN_TRANSCRIPTS_DIR` override each transcript tree directly.
`com.qoder.app.stable` is claimed by both sites, so one reads it only when that
site's own footprint is also present — an international-only machine is never
billed to `qodercn`, and a Qoder CN 0.1.x-only machine is never billed to
`qoder`. Rows from every present source are merged additively and de-duplicated
by request identity; where a transcript row cannot be proven distinct from a
database row, the database row wins. The two SQLite sources need a `sqlite3` CLI
on PATH or a Node runtime with unflagged `node:sqlite`; the transcript tree needs
neither. Main-database and transcript token counts and costs are content
estimates and are marked `estimated` in the record; they do not include provider
billing fields, system-prompt, or tool-schema overhead.

For a target-machine Qoder CN check, run `npm run evidence:qodercn -- --version-file ~/.qoder-cn/.qoder-app-status.json --require-version --require-data`, or pass `QODERCN_VERSION=<installed version>` instead of `--version-file`. The command prints only platform/version, source presence, bounded read diagnostics, row counts, model names, and period totals; it never prints source paths, transcript content, cookies, account IDs, or session IDs. A result of `NOT RUN` means the machine has no readable source or no non-zero usage yet; a result of `FAIL` requires investigation before claiming the real-environment acceptance as complete.

For a trusted LAN/VPN Hub that still uses non-loopback HTTP, keep the default blocked state until the user explicitly enables the trusted-LAN option in the app (or sets `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` for the agent). Upgrading an old HTTP profile does not silently enable cleartext transport; the app continues local collection while Hub read/write/stream status reports the blocked transport.

The desktop app reads these as first-run defaults; the agent and Docker Compose Hub take a CLI flag over an env var over the built-in default.

One-shot run (collect once and exit — useful for cron / launchd):

```bash
npm run agent -- --once
```

Every supported tool is collected; `--clients` and `TOKEN_MONITOR_CLIENTS` were
removed and are ignored with a warning.

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
