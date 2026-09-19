# API

The hub exposes a JSON HTTP API and serves a same-origin web dashboard (PWA) from the hub root (`/`). Static UI assets and `/api/health` are public; private API routes require a scoped credential. Remote connections use HTTPS by default. Docker Compose Hub/agent/desktop require `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` for an intentional non-loopback HTTP deployment. The Android client supports the same intentional LAN/VPN plain-HTTP Hub behind an explicit opt-in: the platform permits cleartext (so the OS does not silently contradict the in-app switch), while `HubApiFactory` rejects a non-HTTPS URL unless that switch is on. User-installed CAs are trusted in debug builds only.


For pricing refreshes, the Hub invokes `tokscale pricing <model> --json` first. If tokscale cannot complete its upstream catalog request, the Hub retries against the configured `TOKSCALE_PRICING_CATALOG_URL` (default `https://models.dev/api.json`), which is a public catalog tokscale also uses. The catalog is cached in the Hub process for six hours; the resulting `model_pricing` row remains durable.

## Authentication

For the single-user deployment, configure one key:

- `TOKEN_MONITOR_SECRET`: shared by the Hub and every desktop app / agent. It grants read, ingest, and every administrative mutation, including manually managed Hub accounts.

The Hub still accepts the following optional split variables for older deployments:

- `TOKEN_MONITOR_ADMIN_SECRET`: read, ingest, and every administrative mutation. When this is set, `TOKEN_MONITOR_SECRET` keeps its legacy scoped meaning.
- `TOKEN_MONITOR_VIEWER_SECRET`: read-only dashboard/API access. This is the only credential accepted through `?secret=` for header-limited clients.
- `TOKEN_MONITOR_INGEST_CREDENTIALS`: JSON object mapping the exact `deviceId` to a device token, for example `{"workstation":"...","laptop":"..."}`. A device token can read shared stats and ingest only its bound identity.
- `TOKEN_MONITOR_ALLOW_LEGACY_INGEST` and `TOKEN_MONITOR_ALLOW_LEGACY_ADMIN`: temporary elevation flags for the legacy `TOKEN_MONITOR_SECRET` path.
- `TOKEN_MONITOR_HUB_CREDENTIAL_KEY`: optional legacy override for encrypting manually added Hub account credentials at rest. When empty, the Hub derives this key from `TOKEN_MONITOR_SECRET`; changing the effective key makes existing account credentials unreadable and requires manual re-login.

In split mode, every configured admin, viewer, legacy, and device credential must be distinct. In unified mode, `TOKEN_MONITOR_SECRET` intentionally resolves to the admin principal.

An unconfigured Docker Compose Hub is restricted to loopback. A remote Hub refuses all private routes until at least one unified or split credential is configured.

Use either:

```http
Authorization: Bearer <secret>
```

or:

```http
X-Token-Monitor-Secret: <secret>
```

Privileged credentials are rejected in query strings. Query credentials can appear in browser, proxy, CDN, or diagnostic logs, so use a rotatable viewer token only when the client cannot send a header.

The Hub rate-limits repeated authentication failures per source and ingest bursts per authenticated principal. Successful administrative mutations emit structured `[hub-audit]` records containing the time, principal ID, action, and target; secret values are never logged.

## `GET /api/health`

Health check. Does not require authentication.

Example response:

```json
{
  "ok": true,
  "role": "hub",
  "version": 1,
  "apiVersion": 2,
  "capabilities": {
    "stats": true,
    "history": true,
    "statsStream": true,
    "subscriptions": true,
    "usageRange": true,
    "pricing": true,
    "deviceDelete": true,
    "deviceRename": true,
    "publicStats": false,
    "hubAccounts": true,
    "centralLimits": true,
    "limitsAuthority": "hub"
  },
  "deviceCount": 2,
  "secretRequired": true,
  "now": "2026-05-18T00:00:00.000Z"
}
```

`version` remains `1` for compatibility. `apiVersion` versions the capability/authentication contract. The Docker Compose Hub exposes the full capability set shown above.

## `GET /api/capabilities`

Requires read scope and returns the server feature set plus the authenticated credential's `role` and `scopes`. Clients use this endpoint to validate a saved token and gate administrative or runtime-specific UI.

```json
{
  "apiVersion": 2,
  "capabilities": { "stats": true, "usageRange": true, "pricing": true },
  "role": "device",
  "scopes": ["read", "ingest"]
}
```

## `POST /api/ingest`

Posts one device usage summary.

Requires ingest scope. A device credential is accepted only when the payload `deviceId` exactly matches its configured identity. Reposting an unchanged cumulative snapshot is idempotent: the Hub derives zero ledger delta and replaces the same current record.

First-party agents send `Prefer: return=minimal` and receive only
`{"ok":true,"deviceId":"..."}`. This avoids aggregating and returning the full
multi-device snapshot when no SSE consumer needs it. For compatibility, callers
that omit the header still receive the legacy `stats` field; when SSE consumers
are connected, the Hub computes one snapshot and reuses it for the broadcast.

Example payload:

```json
{
  "deviceId": "macbook",
  "hostname": "macbook.local",
  "platform": "darwin-arm64",
  "osName": "macOS",
  "osVersion": "26.0",
  "updatedAt": "2026-05-18T00:00:00.000Z",
  "agentVersion": "0.3.0",
  "agentRuntime": "headless-agent",
  "syncUploadIntervalMs": 1200000,
  "projectsEnabled": true,
  "trackedClients": ["codex"],
  "today": {
    "totalTokens": 1234,
    "costUsd": 0.01,
    "cacheReadTokens": 1100,
    "cacheWriteTokens": 0,
    "outputTokens": 34,
    "clients": {
      "codex": 1234
    },
    "clientCosts": {
      "codex": 0.01
    },
    "clientCacheReads": {
      "codex": 1100
    },
    "clientCacheWrites": {
      "codex": 0
    },
    "clientOutputs": {
      "codex": 34
    },
    "models": {
      "gpt-5": 1234
    },
    "modelCosts": {
      "gpt-5": 0.01
    },
    "modelCacheReads": {
      "gpt-5": 1100
    },
    "modelCacheWrites": {
      "gpt-5": 0
    },
    "modelOutputs": {
      "gpt-5": 34
    },
    "clientModels": {
      "codex": {
        "gpt-5": 1234
      }
    },
    "clientModelCosts": {
      "codex": {
        "gpt-5": 0.01
      }
    },
    "sessions": {
      "codex:rollout-2026-05-30T11-44-50-abc": {
        "client": "codex",
        "sessionId": "rollout-2026-05-30T11-44-50-abc",
        "totalTokens": 1234,
        "costUsd": 0.01,
        "messageCount": 3,
        "inputTokens": 100,
        "outputTokens": 34,
        "cacheReadTokens": 1100,
        "cacheWriteTokens": 0,
        "reasoningTokens": 0,
        "startedAt": "2026-05-30T03:44:50.000Z",
        "lastUsedAt": "2026-05-30T04:07:32.679Z",
        "projectId": "sha256:opaque-project-identifier",
        "projectLabel": "token-monitor",
        "models": {
          "gpt-5": 1234
        },
        "modelCosts": {
          "gpt-5": 0.01
        },
        "providers": {
          "openai": 1234
        }
      }
    }
  },
  "month": {
    "totalTokens": 4567,
    "costUsd": 0.04,
    "clients": {},
    "clientCosts": {}
  },
  "allTime": {
    "totalTokens": 8901,
    "costUsd": 0.08,
    "clients": {},
    "clientCosts": {},
    "projects": {
      "token monitor": {
        "label": "Token Monitor",
        "tokens": 8901,
        "costUsd": 0.08,
        "clients": { "codex": 8901 }
      }
    }
  },
  "periodWindows": {
    "today": { "key": "2026-05-18", "endsAt": "2026-05-19T00:00:00.000Z" },
    "month": { "key": "2026-05", "endsAt": "2026-06-01T00:00:00.000Z" }
  }
}
```

The hub normalizes records before storing them. The Node hub accepts JSON ingest bodies up to 1 MiB; larger bodies return `413 payload_too_large`.

Device `limits` and `limitsOnly` fields are accepted only for mixed-version
compatibility and are discarded before persistence. Devices and agents do not
probe or report local provider accounts. Quota data shown by `/api/stats` is
owned by the Hub account service.

The MySQL Node hub stores each change between a device's cumulative all-time snapshots in an append-only `usage_events` ledger. A row records the time that the difference was recorded (`recorded_at`), not an individual provider API request time. The synchronized protocol intentionally omits unbounded `allTime.sessions`; in that case the hub uses a `snapshot:<client>:<model>` session id to preserve the client/model aggregate without implying an original conversation id. Counter resets never produce negative events: the newly reported cumulative value is recorded as the start of a new counter cycle.

`projects` is a bounded rollup keyed by a canonicalized workspace-folder label. Each entry carries the deterministic display `label`, token/cost totals, and a per-client token breakdown. Agents upload `allTime.projects` because synchronized payloads intentionally omit the unbounded `allTime.sessions`; `today.projects` and `month.projects` are normally omitted on upload and rebuilt by the hub from their synchronized sessions. If adding the all-time rollup would exceed the safe ingest budget, the agent drops only that rollup, sets `allTimeProjectsOmitted: true`, and keeps core totals and session data uploadable. If monthly or daily session detail would still exceed the budget, the agent keeps the newest rows that fit, sends the complete project rollup for that period, and sets `sessionDetailsOmitted` to the number of omitted rows per affected period. If that project rollup cannot fit even after all session rows are removed, the agent omits it too and sets `periodProjectsOmitted`; token/cost and client/model totals remain complete while the affected project breakdown is marked incomplete. A normal later upload clears these diagnostics; limits-only updates preserve them. `projectsEnabled: false` tells the hub that project metadata collection is disabled for this device; sync payloads then remove project rollups plus session `projectId` / `projectLabel` fields.

Authenticated stats expose `projectsIncomplete: true` when a device omitted its rollup, disabled project tracking while contributing usage, or could not preserve exact all-time attribution after its tracked-client list changed. Affected device entries expose `allTimeProjectsOmitted`, `allTimeProjectsIncomplete`, or `projectsEnabled: false` as the reason.

`trackedClients` is optional but recommended for agents and the desktop app. When it is present, the hub treats omitted clients as intentionally not collected in this payload and preserves their previous usage for that device. This keeps "tracking" as "collect future data" rather than "hide existing history".

Current agents and the desktop app include `osName` and, when known, `osVersion` so device details can show a user-facing operating-system release. macOS uses the product version from Electron or `sw_vers`; Windows uses the product family and display version from the registry; Linux uses the distribution name and version from `os-release`. Detection failures fall back to an explicitly labelled Windows build or Linux kernel release. The hub continues to accept older payloads without these fields.

`syncUploadIntervalMs` is optional. A remote-hub desktop app or headless agent includes `0` for live uploads or the selected fixed interval in milliseconds (`600000`, `1200000`, or `1800000`). The hub uses a positive interval to keep the device and its limits fresh for at least twice the upload interval; omitted or `0` values retain the configured `staleAfterMs` behavior. Local collection remains independent of upload cadence.

`periodWindows` is optional. Agents and the desktop app stamp each snapshot with the UTC instant its `today`/`month` windows end, computed in the device's own local time (`endsAt` = next local midnight / next local month start; `key` is the device-local day/month for reference). The hub uses it to expire a device's `today`/`month` from both the aggregate and the per-device view once `now >= endsAt`, so a device that goes offline before re-posting does not keep contributing or displaying a stale day/month snapshot (`allTime` never expires). Payloads without `periodWindows` fall back to a UTC day/month comparison against `updatedAt`.

`limits` is optional for mixed-version compatibility but is ignored by current device ingest. AI Tool Limits are owned and refreshed by the Hub account service; current agents and the desktop app do not probe local provider accounts or upload credentials. Raw OAuth credentials, access tokens, refresh tokens, and provider response bodies must never be sent.

`limits.providers[].provider` is one of `claude`, `codex`, `opencode`, `cursor`, `antigravity`, `kimi`, `grok`, `copilot`, `commandcode`, `mimo`, `zai`, `zaiteam`, `kiro`, `qoder`, `deepseek`, `openrouter`, `minimax`, `volcengine`, `ollama`, or `thirdparty`.
`limits.providers[].accountKey` is a stable hashed account identifier (`sha256:…`) used to dedupe the same account across devices. `accountEmail` is the account email when available, and `accountName` is a sanitized display/profile name. Codex may additionally send `workspaceKind: "personal"` when the workspace has no provider-supplied name, allowing account-management UI to localize the Personal label without persisting translated text. `accountLabel` is the legacy provider-defined short label retained for mixed-version compatibility: older OpenCode renderers use it as the profile name, while existing providers may use it for the plan. `planLabel` is the explicit plan label (for example `Plus`, `Go`, or `Zen`) when identity and plan must be carried separately; readers fall back to `accountLabel` for payloads produced before `planLabel` existed. These fields MAY be sent to the authenticated hub so devices can identify each account and its plan. Hub ingest requires an admin, explicitly elevated legacy, or device-bound credential; the **public** stats endpoints (`publicLimits`) strip `accountKey`, `accountEmail`, `accountName`, `accountLabel`, `planLabel`, and `workspaceKind` so neither account identity nor plan labels are exposed publicly.
`limits.providers[].source` is one of `oauth`, `cli`, `web`, `rpc`, `local`, or `api`; it describes how the Hub-side provider probe obtained the result. It does not imply that a device discovered or uploaded a local account.
`limits.providers[].credentialOrigin` is `manual` for accounts created through the Hub account API. `automatic` is retained only for mixed-version records and must not be produced by the new device path.
`limits.providers[].balanceUsd` is an optional prepaid credit balance in USD (OpenCode Zen); `null` when the provider has no balance concept or none could be read. A genuine `0` (no remaining credit) is distinct from `null`.
`limits.providers[].balance` is an optional native-currency prepaid balance block. DeepSeek uses `{ amount, currency, todaySpend, monthSpend, allTimeSpend, trackingSince, monthSinceTracking }`: `amount` is the spendable balance in the account's own currency (e.g. `CNY`/`USD`); the spend fields are derived from locally observed paid-balance drawdown, `allTimeSpend` keeps accumulating after old daily buckets are pruned, `trackingSince` records when that local observation began, and `monthSinceTracking` is `true` until a full month of history has accrued. OpenRouter uses USD: `/key` supplies `todaySpend`, `weekSpend`, `monthSpend`, and the provider-reported lifetime `allTimeSpend`; when OpenRouter authorizes `/credits` (officially documented for Management keys), `amount` and the corresponding real Credits meter are also included. Other API keys can still report their own spend and configured key limit without inventing an account balance. MiMo may additionally send `giftBalance`, `cashBalance`, Token Plan usage fields, and `planStatus` (`active`, `expired`, `none`, or `null`). An expired MiMo Token Plan has no quota window even when its prepaid balance remains available. `null` when not applicable. DeepSeek uses `source: "api"` with an empty `windows` array (it has no rate-limit windows). OpenRouter, GLM/Z.ai, Volcengine, Qoder, Kimi, and Ollama report quota/credit windows through the same `windows` array.
`windows[].kind` is `session`, `weekly`, `billing`, `named`, or `credits`. `named` marks an allowance that is metered separately from the plan cadence and therefore carries its own bounded `label` (Codex's Luna Reserve and Spark allowances, code review, per-account individual spend limits); `credits` is a purchased credit pool reported as an absolute `remaining` amount without a percentage, because the provider never reports its maximum. `windows[].metric` is an optional stable machine-readable role; `credits` identifies the OpenRouter account-credits meter independently of its display label. `windows[].detail` is an optional bounded display-only description for a window, such as the Kimi-vs-Code composition of the single shared monthly membership meter; it must not contain credentials or raw provider response data.

Qoder CN local usage is opt-in as the `qodercn` client. Its legacy SQLite adapter, the 0.1.x `com.qoder.app.stable/main.sqlite` message adapter, and transcript adapter may all contribute to a record; main-database and transcript-derived periods, sessions, and costs carry `estimated: true` because those sources do not expose exact provider token billing. `qoderCnDiagnostics` is optional, bounded, and non-secret; it reports source selection, candidate/read counts, byte/event counts, last-data time, truncation, fallback, and stable failure codes. It never contains transcript paths, content, cookies, account credentials, or session identifiers.

## `GET /api/stats`

Returns aggregate stats for the dashboard and desktop client.

Response includes:

- `staleAfterMs`, the effective Hub threshold used to recompute device and provider freshness
- `periods.today`
- `periods.month`
- `periods.allTime`
- `periods.*.clientModels` and `periods.*.clientModelCosts` for preserving model breakdowns when a tracked tool is disabled
- `periods.*.projects` for workspace-level tokens, cost, and client attribution; the same canonical folder label aggregates across devices
- `periods.today.sessions` / `periods.month.sessions` keyed by `client:sessionId` for session-level usage when tokscale exposes session groups; clients may use `lastUsedAt` for recent-first sorting and optional `projectId` / `projectLabel` for workspace-level aggregation. Absolute workspace paths stay on the collecting device and are never part of the wire shape. Synchronized clients omit the unbounded `allTime.sessions` collection and may bound `today` / `month` detail when required by the ingest limit while preserving all aggregate totals and breakdowns.
- `sessionDetailsOmitted`, when one or more synchronized devices omitted session rows to stay within the ingest limit; the aggregate contains summed `today` / `month` counts and each affected device reports its own counts
- `periodProjectsOmitted`, when a daily or monthly project rollup was itself too large to fit; the aggregate and affected devices expose omitted project counts and the client marks that period's project breakdown incomplete
- `projectsIncomplete` plus the corresponding `devices[].allTimeProjectsOmitted`, `devices[].allTimeProjectsIncomplete`, or `devices[].projectsEnabled` diagnostic
- `historyPreview.daily[].activeTimeMs`, `historyPreview.monthly[].activeTimeMs`, and `historyPreview.summary.activeTimeMs` when tokscale graph exposes session active-time metrics
- `limits.providers` aggregated by provider account
- `devices`, including each device's normalized `periods`, `receivedAt`, `osName` / `osVersion` when reported, optional `syncUploadIntervalMs`, and optional `periodWindows`; device-level `limits` are not stored or returned
- stale status for devices that have not reported recently

The top-level `limits` object is the Hub-owned account snapshot. Public
stats omit account identifiers. The Hub does not merge device-reported quota
rows because the device protocol does not accept them as authoritative.

## `GET /api/stats/stream`

Requires read scope. Server-Sent Events: the Hub pushes a full aggregate after
every change, so a client never polls to stay live.

- The first frame is `event: snapshot`, carrying the same `stats` payload as
  `GET /api/stats`.
- Later frames are `event: stats` with
  `{ type: "stats", reason, stats, at }`. `reason` is one of `ingest`,
  `account-update`, `subscriptions`, `delete`, `rename`, or the generic
  `update`.
- A `: hb` comment line is written on a fixed 30-second cadence purely to keep
  the connection alive; it never queries MySQL.
- Streams are bounded. At capacity the Hub answers `503` with
  `{"error":"too_many_streams"}` and a `Retry-After: 30` header rather than
  evicting an existing viewer.

The response sets `x-accel-buffering: no` and `no-cache, no-transform` so
proxies do not coalesce frames. Behind a reverse proxy, buffer-free delivery
also requires the proxy not to buffer responses (see `TOKEN_MONITOR_TRUST_PROXY`
in [hub-compose.md](hub-compose.md)).

## `GET /api/history`

Requires read scope. Returns the cross-device history rollup used by the Trends
view: `aggregateHistory()` over every stored device record, so it is the same
shape the desktop app serves locally through its own transport. Only devices
that report the optional `history` field contribute — collection is controlled by
`TOKEN_MONITOR_HISTORY_ENABLED` / Settings → Collection.

## `GET /api/subscriptions` / `PUT /api/subscriptions`

`GET` requires read scope and returns `{ ok, version, subscriptions, updatedAt }`: the
manually recorded plan ledger (plan name, amount, currency, billing cadence,
dates, and the account each record is bound to). Values are typed by the user,
never read from a provider, and stored once per Hub rather than per device.

`PUT` requires the admin scope and replaces the whole ledger:

```json
{ "subscriptions": [ ... ], "baseUpdatedAt": "2026-05-18T00:00:00.000Z" }
```

`baseUpdatedAt` makes the write compare-and-swap. When it is older than the
stored revision the Hub answers `409 {"error":"stale_write"}` with the current
document, so two open dashboards cannot silently overwrite each other. An
unknown currency returns `400 {"error":"bad_request"}` and an oversized body
returns `413 {"error":"payload_too_large"}`.

## `GET /api/rates`

No authentication. Returns the display exchange rates the UI uses to render
costs outside USD: `{ ok, rates, date, source }`. `date` is the day the block was
fetched (rates refresh daily), and `source` reports whether the numbers came from
the live provider or the built-in fallback.

## Hub account management

These routes require the admin scope. `GET /api/accounts` requires read scope
and returns account metadata plus the current normalized quota snapshot; it
never returns the stored credential.

### `GET /api/accounts`

Returns `{ "authority": "hub", "providers": [...], "accounts": [...] }`.
Each account includes its `id`, provider, display fields, status, refresh
timestamps, identity metadata, and `limits`; credential material is omitted.

### `POST /api/accounts`

Adds a manually supplied account, probes it immediately, encrypts its credential
in the Hub database, and schedules refreshes. Request body:

```json
{
  "provider": "qoder",
  "name": "work",
  "label": "Work account",
  "credential": { "cookie": "<provider credential>" }
}
```

The credential shape is provider-specific and is never echoed in the response.

### `PATCH /api/accounts/:id`

Updates `name`, `label`, or `enabled`. Supplying `credential` replaces the
encrypted credential and performs an immediate probe.

### `POST /api/accounts/:id/refresh`

Performs an immediate Hub-side quota refresh and returns the sanitized account.

### `DELETE /api/accounts/:id`

Deletes the account, its encrypted credential, and its stored quota snapshot.

### `POST /api/accounts/oauth/start`

Requires the admin scope. Begins the Hub-side OAuth sign-in for a provider whose
flow can be completed without a device-local login (`codex`, `antigravity`).

Body: `{"provider":"codex"}`.

Returns `{"ok":true,"sessionId","authUrl","provider"}`. The caller opens
`authUrl` in a browser, completes the provider sign-in, and pastes what the
provider hands back into the exchange call below. The session carries the PKCE
verifier and `state` in memory only and expires after 10 minutes.

### `POST /api/accounts/oauth/exchange`

Requires the admin scope. Exchanges the authorization result for a credential,
stores it encrypted, and adds the account in one step.

Body: `{"sessionId","redirectUrl","name"?,"label"?}`.

`redirectUrl` is deliberately permissive, because providers hand the user one of
three shapes: a full callback URL, a schemeless URL or bare query string, or a
bare authorization code (Google's Antigravity page shows a code with a copy
button and never puts it in the address bar). Missing `sessionId` or
`redirectUrl` returns `400 {"error":"invalid_params"}`; an unusable paste returns
`400 {"error":"code_missing"}` with a hint naming the accepted shapes.

`name` defaults to a generated `<provider>-<stamp>`; the response is the same
redacted account record as `POST /api/accounts`.

## `GET /api/devices`

Returns normalized records for all stored devices.

## `GET /api/pricing`

Returns the currently configured model prices. Each entry has `model`, the four `*PricePerMillion` fields, `source` (`manual` or `tokscale_upstream`), and `updatedAt`.

## `PUT /api/pricing/:model`

Creates or replaces manual pricing for a model. All four non-negative per-million values are required:

```json
{
  "inputPricePerMillion": 2.5,
  "outputPricePerMillion": 10,
  "cacheReadPricePerMillion": 0.25,
  "cacheWritePricePerMillion": 3.75
}
```

## `POST /api/pricing/:model/fetch-upstream`

Runs `tokscale pricing <model> --json`, converts its per-token values to per-million values, and saves the result as `tokscale_upstream`. A model with no upstream pricing returns `422 pricing_not_found`; the hub never silently writes zeroes.

## `POST /api/pricing/fetch-upstream-all`

Fetches upstream pricing for every model observed in the event ledger or current device snapshots. The response lists each model with its individual success or failure result.

When an ingest event has configured pricing, the hub copies those four values, source, timestamp, and computed `costUsd` into the event row. Later changes to `model_pricing` do not alter historical events. Without a configured price, the hub uses the payload's tokscale cost delta and marks the row `pricingSource: "payload_fallback"`.

## `DELETE /api/devices/:id`

Requires admin scope. Removes the device from visible stats. The Node/MySQL Hub keeps its ingest baseline and immutable event ledger as a tombstone, so re-ingesting the same identity does not duplicate historical usage.

## `POST /api/devices/:id/rename`

Requires admin scope. Body: `{"deviceId":"new-id"}`. Atomically moves the current record and measurement identity to the new ID; the Node/MySQL Hub also moves its baseline, ledger, and session rows. Returns `409 target_exists` rather than merging two identities.

For the Docker Compose Hub, credential bindings are deployment configuration rather than database rows. Use this order: stop the old client's uploads; provision a distinct token bound to the new ID and reload the Hub configuration; call the rename endpoint; change the client's Device ID and token together; resume it and verify one successful upload; then remove the old binding. Uploading the new ID before the rename creates a conflicting target, while resuming the old binding afterwards recreates the old identity.

## `GET /api/usage/range`

Query a client/model token & cost aggregate for a custom calendar range. Desktop (hub mode) and Android both call this endpoint so custom-range totals stay aligned. This endpoint is implemented by the Docker Compose Node/MySQL Hub.

Preferred query parameters (local calendar days, same family as day/month tabs and tokscale `--since`/`--until`):

- `startDate` / `endDate` — inclusive `YYYY-MM-DD` bounds (aliases: `since` / `until`)
- `startHour` / `endHour` — optional `0–23` (defaults `0` / `23`). Hours are accepted for UI labels and future precision, but **totals are day-rounded**: the hub sums whole local days in `[startDate, endDate]`.

Legacy Instant bounds (still supported):

- `from` — inclusive lower bound (ISO-8601 timestamp)
- `to` — exclusive upper bound (ISO-8601 timestamp)

When only `from`/`to` are provided, the hub maps them to inclusive local calendar day keys on the hub host (`to` is exclusive, so the last included day is the calendar day of `to - 1ms`).

Response:

```json
{
  "from": "2026-07-20T00:00:00.000Z",
  "to": "2026-07-21T00:00:00.000Z",
  "startDate": "2026-07-20",
  "endDate": "2026-07-20",
  "startHour": 0,
  "endHour": 23,
  "source": "history_daily",
  "totalTokens": 12345,
  "costUsd": 1.23,
  "clients": { "codex": 8000 },
  "clientCosts": { "codex": 0.8 },
  "models": { "gpt-5": 12345 },
  "modelCosts": { "gpt-5": 1.23 },
  "clientModels": { "codex": { "gpt-5": 8000 } },
  "clientModelCosts": { "codex": { "gpt-5": 0.8 } }
}
```

`source` preference:

1. **`history_daily`** (primary) — sum device `history.daily` rows whose `date` keys fall in the inclusive range. History dates are local `YYYY-MM-DD` keys from the tokscale graph (same scan family as trends / day-month rollups). Do **not** attribute custom-range totals from session timestamps.
2. **`usage_events`** (fallback only) — used when no overlapping history day exists for the window. The event ledger can mis-date first-ingest / counter-reset dumps via `lastUsedAt`, so it must not win over history.

`clientModels` / `clientModelCosts` are populated for the `usage_events` path; the `history_daily` path fills per-client and per-model maps from daily rollups when present, and may leave nested client→model maps empty.
