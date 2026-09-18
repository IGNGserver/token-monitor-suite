# 02 — Hub Web Dashboard: Complete Architectural Inventory

Target: reuse the Hub's web dashboard (`src/hub/web/`) as the UI of a rewritten Electron desktop client.

Scope of evidence (all read in full):

| File | Lines | Role |
|---|---|---|
| `src/hub/web/index.html` | 195 | Static shell: sidebar, topbar, hero, auth gate, settings drawer, range popover, PWA banner |
| `src/hub/web/js/app.js` | 3989 | The entire SPA: state, router, all view renderers, all data fetching |
| `src/hub/web/js/api.js` | 224 | Fetch wrapper, Bearer auth, localStorage prefs/secret, SSE client |
| `src/hub/web/js/data.js` | 695 | Pure transforms over the Hub wire payload + client label/color/icon tables |
| `src/hub/web/js/format.js` | 96 | Number/currency/relative-time formatting + exchange-rate table |
| `src/hub/web/js/i18n.js` | 1732 | Translations (5 locales) + DOM applier |
| `src/hub/web/css/app.css` | 1764 | The only stylesheet |
| `src/hub/web/sw.js` | 75 | Service worker (PWA offline shell) |
| `src/hub/web/manifest.webmanifest` | — | PWA manifest |
| `src/hub/static.js` | 177 | Static asset server |
| `src/hub/server.js` | 1632 | Hub HTTP API |

Environment note: `app.js` is a **single 3989-line module with no framework** — no build step, no bundler, no imports beyond four sibling ES modules (`/js/api.js`, `/js/i18n.js`, `/js/format.js`, `/js/data.js`, `index.html:193` loads it as `<script type="module">`). Rendering is `innerHTML = templateString` against one `#content` container.

---

## 1. Page / view inventory

### 1.1 The `VIEWS` list

`VIEWS` is defined at `app.js:86-95` — 8 entries, each `{id, icon}`:

| # | `id` | `icon` | Route path | Renderer | Auth/capability gate |
|---|---|---|---|---|---|
| 1 | `overview` | `home` | `/` | `renderHome()` `app.js:1004` | always visible |
| 2 | `usage` | `usage` | `/usage` | `renderUsage()` `app.js:1312` | always visible |
| 3 | `devices` | `device` | `/devices` | `renderDevices()` `app.js:1359` | always visible |
| 4 | `limits` | `limits` | `/limits` | `renderLimits()` `app.js:1597` | always visible |
| 5 | `trends` | `trends` | `/trends` | `renderTrends()` `app.js:2139` | always visible |
| 6 | `accounts` | `accounts` | `/accounts` | `renderAccountsPage()` `app.js:2739` | `capabilities.hubAccounts !== false` (`app.js:627`) |
| 7 | `management` | `management` | `/management` | `renderManagement()` `app.js:1851` | `capabilities.subscriptions !== false \|\| (capabilities.pricing !== false && admin)` (`app.js:628`) |
| 8 | `settings` | `settings` | `/settings` | `renderSettingsPage()` `app.js:1864` | always visible |

`renderChrome()` (`app.js:623-675`) filters `VIEWS` by capability, falls back to `overview` if the current view was filtered out (`app.js:631`), and builds the sidebar buttons at `app.js:632-637` with label `tr('nav.' + id)`.

Routing details:

- `VIEW_PATHS` — `app.js:114-123` (id → path).
- `LEGACY_VIEWS` — `app.js:100-110`; a 9-entry legacy id list kept only so old bookmarks resolve.
- `LEGACY_ROUTE_ALIASES` — `app.js:125-139`; maps `/home`, `/tool`, `/tools`, `/model`, `/models`, `/project`, `/projects`, `/session`, `/sessions`, `/device`, `/status`, `/subscriptions`, `/pricing` onto new views plus a default sub-tab.
- `routeFromLocation()` — `app.js:148-173`: parses pathname **or** hash (`#/usage?tab=models`), then resolves via alias table or `VIEW_PATHS`; `?tab=` is validated against each view's allowed set (`app.js:165-171`).
- `syncUrlForView()` — `app.js:179-207`: `history.pushState`/`replaceState`, suppressing no-op pushes (`app.js:198`).
- `switchView()` — `app.js:3263-3303`: the single navigation entry point; persists `view`/`usageTab`/`managementTab`/`limitTab` to prefs (`app.js:3281-3286`), closes the mobile nav, and lazily triggers `loadSubscriptions`/`loadPricing`/`loadAccounts`/`ensureHistory`.
- `popstate` handler — `app.js:3306-3312`.
- Dispatch — `render()` `app.js:2179-2222`, `switch` at `app.js:2195-2219`, default = `renderHome()`.

### 1.2 Global chrome (present on every view)

From `index.html`:

- **Sidebar** `index.html:23-39`: brand (`index.html:24-30`), `#primaryNav` (`31`), stream status pill `#streamStatus` with `data-state` (`33-36`), Settings button (`37`).
- **Topbar** `index.html:42-60`: mobile menu toggle (`44`), `#pageTitle` (`46`), `#pageMeta` (`47`), **device filter `<select id="deviceFilter">`** (`51-54`), **period tabs `#periodTabs`** (`55`), **custom-range button `#customRangeBtn`** (`56`), refresh `#refreshBtn` (`57`), settings shortcut (`58`).
- **Hero strip** `#heroStrip` (`index.html:62-79`): 4 cards — Tokens `#totalTokens`, Cost `#totalCost`, Devices `#deviceCount`, Live `#liveLabel`. Rendered by `renderHero()` `app.js:924-936`; **hidden on every view except `overview`** (`app.js:925-929`).
- **`#content`** (`index.html:81`) — the only render target.
- **Auth gate** `#authGate` (`index.html:85-101`).
- **Settings drawer** `#settingsDrawer` (`index.html:103-154`) — quick settings: language, theme, currency, home-limit-account-count, hub secret, Save, Clear secret, about line.
- **Range popover** `#rangePopover` (`index.html:156-178`) — `datetime-local` From/To, Apply/Clear, inline error.
- **PWA banner** `#pwaBanner` (`index.html:180-189`), toast `#toast` (`190`), nav scrim `#navScrim` (`191`).

Three global controls are gated by `viewUsesUsageScope()` (`app.js:609-611`, true for `overview|usage|devices|trends`): the device filter, the period tabs, and the custom-range button are hidden otherwise (`app.js:638-641`). The custom-range button additionally requires `capabilities.usageRange !== false` (`app.js:641`).

Period tabs are rebuilt in `renderChrome()` at `app.js:643-650`: always `today | month | allTime` (`PERIODS` `app.js:112`), plus a 4th `custom` tab **only while `state.customPeriod` is set** (`app.js:649`). Labels come from `tr('period.'+id)`.

The page header is composed at `app.js:652-665`: `#pageTitle` = `tr('nav.'+view)`; `#pageMeta` = description + `"{period} · {n} devices[ · hostname]"` for scoped views, or `kicker · description` otherwise.

### 1.3 Per-view content

#### `overview` — `renderHome()` `app.js:1004-1165`

Data: `activePeriod()` (`app.js:370`), `viewStats()`, `toolRows` (top 5), `modelRows` (top 5), `deviceRows` (top 5), `limitCards` (clamped by `homeLimitAccountCount`), `historySource()`.

Controls / sub-blocks:
- Completeness notice + history-scope notice (`app.js:1154-1155`).
- **Activity sparkline panel** (`app.js:1156`) — header pills (active days, streak, peak day, active time; `app.js:1122-1132`) + `renderSparkline(daily14)` (`app.js:1938-1978`).
- **2×2 grid** (`app.js:1157-1162`): Tools, Models, Devices, Limits. Tools/models rows are interactive `data-jump-view` buttons with share meters (`app.js:1027-1071`); devices rows jump + show stale badge (`app.js:1075-1091`); limits cards show a remaining-percent meter with tone class (`app.js:1096-1114`).
- **Summary panel** (`app.js:1163`) — `renderHeatmap(daily90, metric)` plus a **segmented control** for heatmap metric (`tokens|cost`) and active-days window (`all|year`) at `app.js:1141-1148`.

Per-view jump targets: `data-jump-view="tool"`, `"model"` (+`data-jump-usage-tab="models"`), `"device"` (+`data-jump-device`), `"limits"`, `"trends"` — handled at `app.js:3405-3418`.

#### `usage` — `renderUsage()` `app.js:1312-1325`

- Page intro + **sub-nav tabs** `tools | models | projects | sessions` (`renderUsageSubnav()` `app.js:1253-1260`; gated by `state.prefs.usageTab`).
- History-scope notice (`app.js:1324`).
- **Metric strip** (`renderUsageMetricStrip()` `app.js:1221-1231`): total tokens (+ tools/models counts), input (+ uncached), output, cache rate (+ cache-read).
- Body per tab:
  - `tools` → `renderTools()` `app.js:1168-1215`: master list of tools (selectable via `data-select-tool`) + detail panel with a token-mix breakdown (`renderTokenMix` `app.js:1233-1251`) and client→model split (needs `period.clientModels`, derived from sessions under a custom range — see §2).
  - `models` → `renderUsageModels()` `app.js:1281-1284`.
  - `projects` → `renderUsageProjects()` `app.js:1286-1295`: incomplete banner, custom-range "range details unavailable" banner.
  - `sessions` → `renderUsageSessions()` `app.js:1297-1310`: truncation notice, relative last-used time.
- Rows render through `renderUsageMetricRows()` `app.js:1270-1279` — each row is a `<details>` with an expandable token-mix, capped at `MAX_SESSION_ROWS = 200` (`data.js:494`).

#### `devices` — `renderDevices()` `app.js:1359-1453`

- Custom-range notice (`app.js:1381-1383`).
- **Fleet strip** (`app.js:1370-1375`): total, live, stale, distinct runtimes.
- Left panel: **device table** (`app.js:1392-1424`) with columns Id/Platform/Updated/Tokens/Actions; row click selects (`data-select-device`), admin-only **Rename**/**Delete** buttons (`app.js:1417`) shown only when `state.authorization.scopes` includes `admin`.
- Right panel: selected-device detail (`app.js:1426-1450`) with its **own period segmented control** `today|month|allTime` (`data-device-period`, `app.js:1436-1440`), token/cost summary chips, token mix, `renderDeviceStatusBlocks()` (`clientStatus` badges + WSL status, `app.js:1336-1357`), tools panel with nested per-tool model bars, models panel.
- Detail period is an independent pref `deviceDetailPeriod` (`app.js:1360`, `1367`).

#### `limits` — `renderLimits()` `app.js:1597-1626`

- Page intro, **health strip** (accounts / healthy / attention / stale, `app.js:1607-1612`).
- `state.prefs.limitTab === 'health'` renders `renderStatus()` (`app.js:1628-1638`) inline — this is the legacy `/status` route target (`app.js:136`).
- **Provider filter** `<select data-limit-provider>` (`app.js:1613-1623`) with an "all providers" option; selection is `state.limitProvider` (not persisted, `app.js:1601-1603`).
- `renderLimitCards()` `app.js:1564-1595` → per-provider cards with badge, window meters, last-fetched footer. `renderLimitCardWindows()` (`app.js:1521-1545`) groups Antigravity's `5-hour`/`weekly` windows under a heading (`groupAntigravityWindows()` `app.js:1467-1493`).

#### `trends` — `renderTrends()` `app.js:2139-2177`

- History-scope notice + range summary strip (`app.js:2148-2156`).
- **Three segmented control groups** (`app.js:2157-2173`): stack-by `client|model`; range `7|30|90|365|all`; heatmap metric `tokens|cost`; trend metric `tokens|cost|activeTime`.
- Two panels: `renderStackedBars()` (`app.js:2039-2137`, top-8 series with legend, falls back to a single `total` series when per-client/per-model stacks are absent, `app.js:2056-2063`) and `renderHeatmap()` (`app.js:1980-2023`).
- Requires full `/api/history` for the per-client/per-model stacks; `/api/stats.historyPreview` is totals-only (`app.js:2225-2226`).

#### `accounts` — `renderAccountsPage()` `app.js:2739-2741` → `renderAccounts()` `app.js:2424-2737`

- Summary chips (total / healthy / error / disabled, `app.js:2438-2443`).
- Account list (`app.js:2445-2493`) with badge, provider icon, email/label/last-refresh, and admin-only Refresh / Enable-Disable / Edit / Delete actions (`app.js:2485-2490`).
- **Add/Edit form** (`app.js:2675-2730`) — admin only (`app.js:2732-2734`), with:
  - A **custom provider combobox** (`app.js:2499-2520`), options from `HUB_ACCOUNT_PROVIDERS` (`data.js:116-134`), with full keyboard handling (`app.js:3721-3752`).
  - **Three credential modes** `oauth | simple | json` (`app.js:2683-2687`), auto-selected: `oauth` for `codex`/`antigravity` new accounts (`app.js:2522-2526`).
  - Per-provider simple credential fields — a `switch` over `claude`, `commandcode`, `ollama`, `codex`, `antigravity`, `qoder`, `mimo`, `copilot`, `volcengine`, `zaiteam`, `thirdparty`, `zai`, `kimi`, `opencode`, default `deepseek|openrouter|minimax` (`app.js:2530-2625`).
  - **OAuth wizard** (`app.js:2632-2664`): start → auth URL + open/copy → paste redirect URL → exchange.
  - A required disclaimer checkbox for `codex`/`antigravity` (`app.js:2711-2723`).
- Requires `capabilities.hubAccounts !== false`; write actions require the `admin` scope.

#### `management` — `renderManagement()` `app.js:1851-1858`

Sub-nav `subscriptions | pricing` (`renderManagementSubnav()` `app.js:1839-1849`); the Pricing tab is hidden unless `capabilities.pricing !== false && admin` (`app.js:1844`).

- **Subscriptions** `renderSubscriptions()` `app.js:1739-1809`: per-currency monthly totals (`subscriptionMonthlyTotals()` `app.js:1687-1706`, which amortises yearly/interval counts and sums only the current month's top-ups), record list with next-renewal computation (`nextSubscriptionRenewal()` `app.js:1657-1680`), and an admin-only form with a **subscription/top-up kind toggle** and a dynamic top-up ledger (`app.js:1787-1806`, row template `app.js:1728-1737`). A **merge-conflict banner** appears on `409` (`app.js:1761-1763`).
- **Pricing** `renderPricing()` `app.js:1811-1820`: one form per model (`pricingForm()` `app.js:1822-1837`) with four price fields, per-model "fetch upstream" and a global "refresh all".

#### `settings` — `renderSettingsPage()` `app.js:1864-1895`

- A **web-settings form** (`app.js:1877-1888`): language, theme, currency, home-limit-account-count, hub secret, plus Save / Clear-secret.
- A three-panel side stack: connection info (current origin, role/scopes, stream status), PWA status, and a **desktop-boundary panel** that renders `settings.desktopOnly` / `settings.desktopOnlyHint` (`app.js:1892`) — i.e. the dashboard already declares which settings are desktop-local. The i18n string enumerates them: "Window, tray, startup, collector cadence, tracked clients, WSL scanning, exports, and local session archives remain device-local" (`i18n.js:1457`). **This is the exact boundary the rewrite must preserve.**
- Note `viewKicker('settings')` returns `tr('settings.webOnly')` (`app.js:614`).

---

## 2. Data / state model

### 2.1 The `state` object

Declared at `app.js:261-347`. Full shape:

**`state.prefs`** (`app.js:262-282`) — persisted; defaults then `...storedPrefs`, then route-derived `view`/`usageTab`/`managementTab`/`limitTab`:

| Key | Default | Line |
|---|---|---|
| `language` | `'auto'` | `263` |
| `theme` | `'system'` | `264` |
| `currency` | `'USD'` | `265` |
| `period` | `'today'` | `266` |
| `trendsRange` | `'30'` | `267` |
| `trendsStack` | `'client'` | `268` |
| `trendsMetric` | `'tokens'` | `269` |
| `heatmapMetric` | `'cost'` | `270` |
| `activeDaysWindow` | `'all'` | `271` |
| `homeLimitAccountCount` | `3` | `272` |
| `deviceFilter` | `''` | `273` |
| `selectedDeviceId` | `''` | `274` |
| `selectedToolId` | `''` | `275` |
| `deviceDetailPeriod` | `'today'` | `276` |
| `view` | route → `storedPrefs.view` → `'overview'` | `278` |
| `usageTab` | route → stored → `'tools'` | `279` |
| `managementTab` | route → stored → `'subscriptions'` | `280` |
| `limitTab` | route → stored → `'limits'` | `281` |

**Server / derived state** (`app.js:283-347`): `secret`, `locale`, `health`, `authorization`, `stats`, `history`, `historyRequest`, `historyLoading`, `subscriptions`, `subscriptionsLoading/Error/Saving/Conflict/Pending`, `subscriptionEditId`, `pricing`, `pricingLoading/Error/Saving`, `accounts`, `accountsLoading/Error/Saving`, `accountFormError`, `accountEditId`, `accountFormMode`, `accountSelectedProvider`, `accountProviderMenuOpen`, `oauthSession`, `oauthLoading`, `limitProvider`, `loading`, `error`, `customRange`, `customPeriod`, `stream`, `dataAsOf`, `stopStream`, `toastTimer`, `navOpen`, `overlayFocus{settings,range}`, `deferredInstall`, `formDrafts` (a `Map`, `app.js:330`), `managementRequestSeq{subscriptions,pricing,accounts}` (`331-335`), `managementControllers{…}` (`336-340`), `managementPromises{…}` (`341-345`), `pwaDismissed` (`346`).

`state.customPeriod` is a **synthetic period object** built from `/api/usage/range` (`app.js:3233-3247`) and takes precedence over the preset period in `activePeriod()` (`app.js:370-382`).

### 2.2 `prefs` storage keys and defaults

`api.js:1-3` defines the three localStorage/sessionStorage keys:

| Key | Store | Purpose | Written by |
|---|---|---|---|
| `token-monitor.hub.prefs` | `localStorage` | JSON blob of the prefs table above | `savePrefs()` `api.js:13-17` |
| `token-monitor.hub.secret` | `localStorage` | Bearer secret, only if "Remember on this device" | `saveSecret()` `api.js:25-32` |
| `token-monitor.hub.secret.session` | `sessionStorage` | Bearer secret for the session only | `saveSecret()` `api.js:30-31` |

One additional key lives outside `api.js`: `token-monitor.hub.pwaDismissed` (`app.js:346`, `3875`, `3896`).

`loadPrefs()` tolerates corrupt JSON and returns `{}` (`api.js:5-11`). `savePrefs(patch)` is a shallow merge that returns the new object (`api.js:13-17`). **There is no schema version and no migration** — an Electron port that stores prefs in `settings.json` instead must map these keys explicitly.

### 2.3 SSE stream

`openStatsStream()` — `api.js:84-224`. It is hand-rolled over `fetch` + `ReadableStream` (not `EventSource`, because the secret cannot ride an `EventSource` header):

- Connects to `/api/stats/stream` with `accept: text/event-stream` and the Bearer header (`api.js:124-128`).
- **Connect timeout** 15 s (`SSE_CONNECT_TIMEOUT_MS` `api.js:82`) aborts the handshake (`api.js:117-119`).
- **Idle watchdog** 90 s (`SSE_IDLE_TIMEOUT_MS` `api.js:81`) cancels the reader and aborts (`api.js:149-154`).
- Parses `event:`/`data:` frames manually, splitting on `\n\n` (`api.js:162-185`); `heartbeat` events are deliberately ignored so they cannot be mistaken for freshness (`api.js:173-175`); malformed JSON is swallowed (`api.js:182-184`).
- `onStats(stats, event, {at, lastEventAt})` fires for `snapshot`/`stats` frames or any payload with `.stats` (`api.js:178-181`).
- Status is only `'live'` **after a frame arrives**, not on response headers (`api.js:144-146`).
- Reconnect uses exponential backoff `min(30s, 1s · 2^attempt)` capped at attempt 5 (`api.js:94-96`, `199-209`).
- Returns a disposer that clears the retry timer and aborts (`api.js:214-223`), stored as `state.stopStream`.

Wiring: `connectStream()` `app.js:2276-2293`; status mapping `setStreamStatus()` `app.js:425-449`; backoff countdown surfaced in the status tooltip (`app.js:2290`). `state.dataAsOf` records the last frame's wall-clock time and is shown as the status tooltip (`app.js:443-447`). A `401` on the stream triggers the auth gate (`app.js:448`).

### 2.4 How each dataset is fetched and cached

| Dataset | Fetcher | Endpoint | Cache / invalidation |
|---|---|---|---|
| Health + secret requirement | `fetchHealth()` `api.js:46-50` | `GET /api/health` | Fetched once at boot (`app.js:3972`); fallback `{secretRequired:true}` on failure (`app.js:3974`) |
| Capabilities + scopes | inline `fetchJson` `app.js:3013` | `GET /api/capabilities` | Once per successful connect; gates `accounts`, `management`, `usageRange`, `pricing` |
| Stats | `refreshStats()` `app.js:2269-2274` | `GET /api/stats` | In-memory only; pushed by SSE via `applyStatsSnapshot` |
| History | `ensureHistory()` `app.js:2224-2244` | `GET /api/history` | Single-flight; skipped if `historyHasBreakdown(state.history)` (`app.js:2228`, `964-970`); dropped+refetched when `historyRevision`/`deviceHistoryRevision` changes (`app.js:2249-2262`) |
| Subscriptions | `loadSubscriptions()` `app.js:2312-2348` | `GET /api/subscriptions` | Cached in `state.subscriptions`; `force` re-fetches; refetched when `subscriptionsUpdatedAt` changes (`app.js:2263-2265`) |
| Pricing | `loadPricing()` `app.js:2350-2378` | `GET /api/pricing` | Same pattern (`state.pricing`) |
| Accounts | `loadAccounts()` `app.js:2380-2408` | `GET /api/accounts` | Same pattern (`state.accounts`) |
| Custom range | `applyCustomRange()` `app.js:3213-3254` | `GET /api/usage/range?from=&to=` | `state.customPeriod` + `state.customRange`; cleared by `clearCustomRange()` (`app.js:3256-3261`) |
| Rates | raw `fetch` `app.js:3962` | `GET /api/rates` | Applied via `configureRates()` (`format.js:26-41`); failure never blocks boot (`app.js:3967-3969`) |

`applyStatsSnapshot()` (`app.js:2246-2267`) is the funnel for both SSE pushes and manual refreshes. Its revision-diffing is the only cross-invalidation mechanism: history change → clear `state.history` + refetch if on `overview`/`trends`; subscriptions change → refetch, but **preserving a dirty form draft** (`app.js:2264`, `hasDirtyFormDraft('subscription:')` `app.js:767-769`).

Boot sequence: `init()` `app.js:3940-3987` → static icons → theme → locale → `bindEvents()` → `renderChrome()` → register SW → rates → health → `tryConnect()` when no secret is required (`app.js:3977-3980`), else reuse a stored secret (`app.js:3982-3985`), else show the auth gate (`app.js:3986`). `tryConnect()` `app.js:3009-3031` validates by calling `/api/stats`, then `/api/capabilities`, then persists the secret, then `bootstrapAuthorized()` (`app.js:2992-3007`) which fans out `refreshStats` + `ensureHistory` + the three management loads in parallel and then opens the stream.

### 2.5 Request sequencing, abort, and conflict handling (already implemented)

This is the part most worth preserving verbatim in an Electron port.

1. **Per-kind sequence numbers + `AbortController`.** `startManagementRequest(kind)` (`app.js:2295-2302`) aborts the in-flight controller for that kind, increments `state.managementRequestSeq[kind]`, stores a fresh controller, and returns `{controller, seq}`. `isCurrentManagementRequest(kind, seq)` (`app.js:2304-2306`) is checked **on resolve, on error, and in `finally`** (`app.js:2322`, `2333`, `2338`) so a stale response can never overwrite newer state and a stale request cannot clear another request's `loading` flag. Three independent lanes: `subscriptions`, `pricing`, `accounts`.
2. **Single-flight de-duplication.** Each loader stores its in-flight promise in `state.managementPromises[kind]` and returns it when a second call arrives while loading (`app.js:2314`, `2352`, `2382`). `ensureHistory` does the same with `state.historyRequest` (`app.js:2229`).
3. **Abort-error discrimination.** `isAbortError()` (`app.js:2308-2310`) recognises both `AbortError` and `ABORT_ERR` so a superseded request is silently dropped instead of surfacing as an error (`app.js:2333`).
4. **Optimistic-concurrency (409) handling for subscriptions.** Writes send `baseUpdatedAt` (`app.js:3113`). On `409` with `error.payload.subscriptions`, the conflict is stored as `state.subscriptionsPending` and `state.subscriptionsConflict = true` (`app.js:3125-3128`), rendering a banner with a "reload latest" action (`app.js:1761-1763`, handler `app.js:3588-3603`). A background refresh that lands while a form is dirty is **not applied**; it becomes `subscriptionsPending` instead (`app.js:2323-2325`).
5. **Form-draft survival across re-renders.** `state.formDrafts` (`app.js:330`) snapshots form fields on `input`/`change` (`app.js:3702-3708`, `rememberFormDraft` `app.js:744-761`), is re-applied after every `innerHTML` swap (`restoreFormDrafts()` `app.js:771-789`), and is cleared on successful save (`app.js:763-765`). Top-up ledger rows are snapshotted separately (`app.js:750-760`).
6. **Focus/scroll preservation across re-render.** `captureRenderState()` (`app.js:861-872`) records a semantic description of the focused element (`describeActiveElement()` `app.js:791-831`, which encodes form-control name+index+selection and specific `data-*` attributes) and the scroll offset; `restoreRenderState()` (`app.js:874-892`) re-finds the element (`findActiveElement()` `app.js:833-859`) and restores focus, caret selection, and scroll.
7. **401 convergence.** Every loader routes `error.status === 401` to `showAuth(true)` (`app.js:2236`, `2335`, `2365`, `2395`; also `app.js:3804`, `3631`).

### 2.6 Hub payload shape consumed by the views

Consumed via `data.js` directly off `stats`:

- `stats.devices[]` — `deviceId`, `hostname`, `platform`, `osName`, `osVersion`, `updatedAt`, `receivedAt`, `stale`, `agentRuntime`, `clientStatus`, `wslStatus`, `projectsEnabled`, `periods{today,month,allTime}`, `allTimeProjectsOmitted/Incomplete` (`data.js:531-562`, `app.js:353-368`).
- `stats.periods[period]` — `totalTokens`, `costUsd`, `clients`, `clientCosts`, `models`, `modelCosts`, `projects`, `sessions`, per-row `clientCacheReads/CacheWrites/Outputs` and `model*` counterparts (`data.js:346-397`), plus `clientModels`/`clientModelCosts` (present on the device period and on `/api/usage/range` responses).
- `stats.limits.providers[]` — `provider`, `accountKey`, `accountEmail/Name/Label`, `plan/planLabel`, `status`, `stale`, `updatedAt`, `windows[]` (`remainingPercent`|`usedPercent`|`remaining`, `kind`, `label`, `resetsAt`, `value`, `metric`, `showMeter`, `detail`), `balanceUsd`, `balance{amount,monthSpend,todaySpend,weekSpend,allTimeSpend,currency}`, `resetCredits` (`data.js:564-689`).
- `stats.historyPreview.daily[]` — `{date, tokens, cost, perClient, perModel}`; the full `/api/history` adds per-client/per-model stacks (`app.js:964-970`, `data.js:691-695`).
- Revision/watermark fields used for invalidation: `historyRevision`, `deviceHistoryRevision`, `subscriptionsUpdatedAt`, `sessionDetailsOmitted[period]`, `periodProjectsOmitted[period]` (`app.js:2249-2253`, `941-945`).

---

## 3. Module boundaries

### 3.1 Plain ES modules vs inline

| Module | Exports | Character |
|---|---|---|
| `js/api.js` | `loadPrefs`, `savePrefs`, `loadSecret`, `saveSecret`, `clearSecret`, `fetchHealth`, `fetchJson`, `openStatsStream` | **Browser-coupled**: `localStorage`/`sessionStorage`, `fetch`, `AbortController`, `TextDecoder`, relative URLs |
| `js/data.js` | 35 exports (5 consts + 30 functions): `CLIENT_LABELS` (43 entries), `CLIENT_COLORS` (43), `PROVIDER_LABELS` (20), `HUB_ACCOUNT_PROVIDERS` (17), `MAX_SESSION_ROWS` (200), `clientLabel`, `clientColor`, `clientIconPath`, `modelVendorFor`, `modelColor`, `platformLabel`, `devicePlatformLabel`, `countActiveDays`, `heatmapValue`, `limitRemainingTone`, `clampHomeLimitAccountCount`, `personalWorkspaceLabel`, `providerPlanLabel`, `providerDisplayName`, `statusRows`, `agentRuntimeLabel`, `clientStatusEntries`, `wslStatusSummary`, `periodTokenMetrics`, `tokenMetricsForRow`, `periodActivityCounts`, `deviceBreakdownRows`, `mapRows`, `toolRows`, `modelRows`, `projectRows`, `sessionRows`, `deviceRows`, `limitCards`, `historyDaily` | **Pure** — no DOM, no fetch, no storage (verified by grep; the only `window` hits at `data.js:574-592` are a loop variable named `window` for quota windows, not the global). Already imported under bare Node by `tests/hub/webDataHelpers.test.js` |
| `js/format.js` | `configureRates`, `currentRates`, `formatNumber`, `formatCompact`, `formatCost`, `formatRelative`, `formatReset`, `toDatetimeLocalValue` | **Pure** (uses `Intl`), plus one mutable module-level rate table |
| `js/i18n.js` | `resolveLocale`, `t`, `applyI18n` | Mostly pure; `resolveLocale` reads `navigator.languages` (`i18n.js:1711`) and `applyI18n` takes a DOM root |
| `js/app.js` | none (side-effecting entry, `void init()` at `app.js:3989`) | **All UI**: 8 view renderers, ~60 helpers, the state object, the router, event delegation, all fetching |

So the split is: **4 small reusable data/format/i18n modules, and one monolithic ~4 000-line app module.** There is no component abstraction, no view-module split, and no template layer — `app.js` mixes state, networking, routing, and HTML generation.

### 3.2 Reusable in Electron vs browser/PWA-specific

**Reusable with an injected base URL + secret:**
- All of `data.js` (pure) and `format.js` (pure).
- The view renderers and helpers in `app.js` — every string is produced by a `tr()` call, so they are locale-neutral already; they read only `state` and pure `data.js` functions.
- The `state` shape, the request-sequencing helpers (`app.js:2295-2310`), the draft/focus preservation helpers (`app.js:724-892`), `renderChrome`/`renderHero`/`render` and the router.
- The `UI_ICON_PATHS` inline-SVG icon registry and `uiIcon()` (`app.js:48-84`) — no external dependency.
- `app.css` in full (see §5).

**Browser/PWA-specific and must be removed or adapted:**
- **Service worker**: registration at `app.js:3947-3954`, `sw.js` in full (precache list `sw.js:3-19`, cache-first-with-revalidate `sw.js:46-74`). Electron should not register it; the SW `activate` handler also evicts every non-matching cache (`sw.js:29-35`), which is meaningless in a packaged app.
- **Install prompt / PWA banner**: `state.deferredInstall`, `state.pwaDismissed` (`app.js:329`, `346`), `isStandaloneDisplay()` (`app.js:553-556`), `pwaStatusText()` (`app.js:558-564`), `refreshPwaUi()` (`app.js:566-585`), the `beforeinstallprompt`/`appinstalled` listeners (`app.js:3867-3899`), the `data-pwa-install` handler (`app.js:3424-3431`), the banner markup (`index.html:180-189`), and the PWA panel in Settings (`app.js:1891`). All dead in Electron.
- **Auth gate**: the `#authGate` dialog (`index.html:85-101`), `showAuth()` (`app.js:469-476`), `tryConnect()`'s 401 branch (`app.js:3019-3024`), `signOutFromHub()` (`app.js:1921-1928`), and the `loadSecret`/`saveSecret`/`clearSecret` localStorage path in `api.js:19-37`. Electron should replace this with an injected hub URL + secret from `userData/credentials.json` (which already exists for the widget — see `AGENTS.md`).
- **Relative-URL fetches**: every path in `api.js` and `app.js` is origin-relative (`/api/...`), which only works because the dashboard is served by the Hub on the same origin (`server.js:1011-1013`). The Electron renderer runs on `file://` and must get an absolute base URL. This is the single most pervasive change.
- **Web history routing**: `window.history.pushState`/`popstate` (`app.js:148-207`, `3306-3312`). Works in a `BrowserWindow` loading `file://`, but the legacy path aliases would resolve against `file://`; a hash-based router is the safer port.
- **`window.confirm` / `window.prompt`**: used for device delete/rename and subscription/account deletes (`app.js:3035`, `3046`, `3048`, `2971`, `3141`). Electron should route these through a native dialog.
- **`window.open`** for the OAuth auth URL (`app.js:3544`) and **`navigator.clipboard`** (`app.js:3551-3559`) — in Electron these should go through `shell.openExternal` and a clipboard IPC; both handlers already degrade gracefully.
- **`window.location.origin`** displayed in Settings (`app.js:1871-1873`) — meaningless for a `file://` renderer.

### 3.3 What the existing Electron renderer provides that the web UI has no concept of

The desktop-only settings surface is large and remains out of scope for the shared UI. The current renderer is **not** an ES-module app: it uses global-script IIFEs (`src/electron/renderer/i18n.js:3-7`) loaded from `dashboard.html:63-70`. Existing IPC channels the new renderer would keep include (from `src/electron/main.js`):

`settings:get`/`settings:update` (`3800`, `3822`), `stats:get`/`stats:getCustomRange` (`4128-4129`), `stats:stream` status, `session:getDetail` (`4344`), `export:now`/`export:pickAutoDir` (`4325-4336`), `pricing:lookup` (`3815`), `sessionUsageArchive:clear` (`3801`), `sync:recover`/`sync:health` (`4348-4349`), `serviceStatus:get` (`4351`), `hubAccounts:list/add/update/remove/refresh` (`4377-4407`), `tokscale:*` (`4407-4416`), `appUpdate:*` (`4416-4420`), `appearance:preview` (`4022`), `floatingBubble:*` (`4032-4109`), `tray:setIcons` (`4109`), `window:viewState`/`window:contentReady` (`4029`, `3434`), `app:getInfo`/`app:openExternal`/`app:openUserData` (`4355-4376`).

The web dashboard never touches any of these; it reaches the Hub over HTTP from the renderer. A shared-UI port has to decide which of these stay as IPC and which migrate to direct HTTP.

---

## 4. i18n

### 4.1 Storage

Two **flat-key**, per-locale dictionaries that are merged at module load:

- `MESSAGES` — `i18n.js:1-1403`, the legacy/shared table. Locale blocks: `en` 2-284, `'zh-CN'` 285-567, `'zh-TW'` 568-850, `ja` 851-1126, `ko` 1127-1402.
- `PAGE_MESSAGES` — `i18n.js:1408-1699`, an overlay for the new information architecture, deliberately kept separate so "the existing management translations and old deep links can remain untouched" (`i18n.js:1404-1406`). Same five locales: `en` 1409-1466, `'zh-CN'` 1467-1524, `'zh-TW'` 1525-1582, `ja` 1583-1640, `ko` 1641-1698.
- The overlay is folded in by a loop at `i18n.js:1701-1703`: `Object.assign(MESSAGES[locale], PAGE_MESSAGES[locale])`.

Keys are **flat literals** (`'accounts.title'`), not nested objects — lookup is a direct property access, never a dot-path traversal. Values are plain strings with `{name}` placeholders. The two `en` layers are disjoint (0 overlapping keys): the base layer contributes 281 keys and the overlay 56, for 337 total. Both dictionaries are **module-private and not exported**.

Note the five locales are also hardcoded in the `resolveLocale()` branch chain (`i18n.js:1710-1714`) and in the two Settings UIs (`index.html:114-120`, `app.js:1880`); there is no exported `LOCALES` constant.

### 4.2 Locale list

Five locales, in both dictionaries: `en`, `zh-CN`, `zh-TW`, `ja`, `ko` (`i18n.js:2`, `1409`). `resolveLocale()` (`i18n.js:1705-1717`) honours an explicit preference, otherwise sniffs `navigator.languages` with the order zh-TW/zh-Hant → zh-CN → ja → ko → en, falling back to `en`. The same five are offered in the Settings drawer (`index.html:114-120`) and the Settings page (`app.js:1880`).

### 4.3 Lookup API

| Export | Signature | Lines |
|---|---|---|
| `resolveLocale` | `(preference = 'auto') → locale` | `i18n.js:1705-1717` |
| `t` | `(locale, key, params = {}) → string` | `i18n.js:1719-1726` |
| `applyI18n` | `(root, locale) → void` | `i18n.js:1728-1731` |

`t()` resolution order: `MESSAGES[locale][key]` → `MESSAGES.en[key]` → **the key itself** (a missing key silently renders as its own dotted key, `i18n.js:1721`). Params are interpolated with `String.replaceAll('{' + name + '}', value)` (`i18n.js:1722-1725`) — no regex, no escaping, no pluralisation; an absent param leaves the literal `{name}` visible in the output. `t()` never throws and never returns `undefined`.

`applyI18n()` handles **only `[data-i18n]`, setting `textContent`** (`i18n.js:1729-1731`). Despite the shell carrying `data-i18n-aria` (`index.html:44`, `58`), there is **no** code path under `src/hub/web/js/` that reads `data-i18n-aria`, `data-i18n-title`, or `data-i18n-placeholder` — those two attributes are inert (a grep for `data-i18n-aria`/`dataset.i18nAria` matches only the HTML itself). The shell ships 33 `data-i18n` and 2 `data-i18n-aria`, and zero `data-i18n-title`/`-placeholder`. Static labels must therefore come from `data-i18n`, and everything else is localised by `tr()` inside JS templates. `applyI18n` also does **not** touch `document.title`, `documentElement.lang`, or any `<meta>`: `<html lang="en">` and `<title>Token Monitor</title>` are static, there is no `document.title` assignment anywhere in `src/hub/web/js/`, and `html lang` is set by the caller — `document.documentElement.lang = state.locale` at `app.js:463`, immediately before `applyI18n(document, state.locale)` at `app.js:464`.

### 4.4 Key counts

Counted by evaluating the module source with the `export` keywords stripped and reading the two module-private dictionaries (they are not exported, so a plain dynamic import cannot reach them):

- **337 keys in `en`** — the base dictionary, = **281 in the `MESSAGES` layer + 56 in the `PAGE_MESSAGES` overlay**.
- `zh-CN`: 337 (0 missing), `zh-TW`: 337 (0 missing).
- `ja`: 330 — **7 missing** vs `en`.
- `ko`: 330 — **7 missing** vs `en`.
- **Zero locale has extra keys** that `en` lacks.
- 1 670 key literals appear in the raw file, but that counts the same key once per locale (≈334 × 5) plus the overlay merges; the distinct-key figure is **337**.

The seven keys missing from both `ja` and `ko` (they silently fall back to English strings) all come from the base `MESSAGES` layer, none from the overlay:

`accounts.agyEndpointHint`, `accounts.codexOauthLocalhostNotice`, `accounts.mimoServiceToken`, `accounts.mimoUserId`, `accounts.mimoHint`, `accounts.claudeRiskNotice`, `accounts.kimiKeyHelp` — i.e. the Japanese and Korean dictionaries predate the newer account-provider forms and the Claude risk notice.

Keys by top-level prefix (`en`, 29 prefixes): `accounts` 66, `subscriptions` 37, `devices` 35, `settings` 23, `nav` 20, `limits` 17, `usage` 17, `home` 16, `pricing` 16, `status` 11, `pwa` 11, `page` 9, `range` 7, `actions` 6, `empty` 6, `stats` 6, `auth` 6, `data` 5, `trends` 4, `period` 4, `filters` 3, `toast` 3, `error` 2, `management` 2, plus `loading`, `sessions`, `projects`, `brand`, `tools` at 1 each.

### 4.5 Relationship to the Electron renderer's i18n (key-set divergence)

`src/electron/renderer/i18n.js` (5353 lines) uses a completely different module contract — a UMD/IIFE exposing `LANGUAGE_OPTIONS`, `MESSAGES`, `applyTranslations`, `normalizeLanguage`, `resolveLocale`, `translate` on `module.exports` / `window.TokenMonitorI18n` (`i18n.js:3-6`, returned at 5352). Its `MESSAGES` block spans **17-5139** (locale blocks: `en` 18, `'zh-TW'` 1042, `'zh-CN'` 2066, `ko` 3090, `ja` 4114), plus a second `HUB_ACCOUNT_MESSAGES` dictionary at **5140-5276** merged into it at 5277-5279. Its `en` set totals **1047 keys**, present in all five locales (no gaps).

Comparison of the two `en` key sets:

- Hub web: **337** keys. Electron renderer: **1047** keys.
- **Intersection: 7 keys** — `home.activeDays`, `home.activity`, `home.devices`, `home.limits`, `home.models`, `home.tools`, `projects.incomplete`.
- Hub-only: 330. Electron-only: 1040.

**The two translation tables are effectively disjoint — the Hub set is not a subset of the renderer set.** They cannot be merged mechanically; the shared UI must ship the Hub's 337-key table (five locales, 1 685 strings) and the desktop-only settings surface needs the Electron table, or the Hub table needs the ~1040 desktop keys ported into its own format.

Two further contract differences that block a drop-in swap: the Hub's `applyI18n` covers **only `data-i18n`**, while the renderer's `applyTranslations` also handles `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-placeholder` and sets `documentElement.lang` (`renderer/i18n.js:5325-5350`); and the renderer interpolates with a `/\{([a-zA-Z0-9_]+)\}/g` regex that maps `undefined`/`null` to `''`, whereas the Hub uses a literal `replaceAll` that leaves unmatched tokens visible.

---

## 5. Styling

`src/hub/web/css/app.css` is the only stylesheet, loaded at `index.html:18`. Structure, tokens, breakpoints, and the icon system:

### 5.1 Structure

| Lines | Content |
|---|---|
| 1 | File-level design note (B2B SaaS, Linear/Vercel-clean, system type, restrained motion) |
| 2-30 | `:root` theme tokens (light) |
| 32-48 | `html[data-theme="dark"]` token overrides |
| 50-69 | Reset/normalize: `*{box-sizing}` (50), `html, body` (51-61), form-control font inherit (62), `button{cursor}` (63), `a{color:inherit}` (64), `:where(...):focus-visible` ring (66-69) |
| 71-83 | `.skip-link` |
| 85-89 | `.app` grid shell (`--sidebar-width` + `minmax(0,1fr)`, `100dvh`) |
| 91-206 | Sidebar: `.sidebar` (91), `.brand*` (104-127), `.nav` (129), `.nav-btn` (137-155), `.nav-ico` (156), **`.ui-icon`/`.ui-icon-slot`** (164-178), `.sidebar-foot` (180), `.stream-status*` (185-206) |
| 208-254 | `.main` (208), `.topbar` (216), `.device-filter` (228), `.page-title` (244), `.page-meta` (250) |
| 256-312 | `.period-tabs` (256-277), `.icon-btn`/`.ghost-btn`/`.primary-btn`/`.danger-btn` (279-312) |
| 314-460 | `.hero*` (314-345), `.content` (347), `.grid-2`/`.grid-3` (354-363), `.panel*` (364-382), `.stack` (384), `.row*` (390-432), `.swatch` (433), `.client-icon` (440), `.meter` (448-460) |
| 462-538 | `.limit-card*` (462-524), `.badge*` (525-538) |
| 540-570 | Chart SVG: `.chart-wrap` (540), `.chart-svg` (544), axes (550-557), `.heat.lvl-*` (559-570) |
| 572-747 | `.empty-card` (572), `.auth-gate`/`.auth-card*` (578-605), `.field*` (606-632), provider combobox (633-739), `.check-row` (740), `.form-error` (747) |
| 749-945 | Toolbar (749-762), `.loading-stack`/`.skeleton*` + `@keyframes skeleton-shimmer` (764-781), `.error-card*` (782-791), management rows (793-849), `.mode-toggle-group` (855-872), disclaimer (877-906), OAuth wizard (908-945) |
| 947-1015 | Overlays: `.drawer` (947), `.drawer-backdrop` (952), `.drawer-panel` (957), heads/bodies (968-988), top-up ledger (989-1011), `@media 620px` (1012-1015) |
| 1017-1055 | `.popover` (1017), `.popover-card` (1026), `.toast` (1030), `.hidden` (1045), `.mobile-only` (1046), `.nav-scrim` (1047-1055) |
| 1057-1097 | `.device-table*` (1057-1076), `.seg`/`.seg-btn` (1078-1097) |
| 1099-1200 | `@media 1080px` (1099-1102), `@media 860px` incl. the mobile nav drawer (1104-1200) |
| 1202-1204 | `.nav-scrim:not(.hidden)` |
| 1207-1212 | `@media (prefers-reduced-motion: reduce)` |
| 1215-1250 | `.axis-base`, `.axis-y`, `.chart-hit`, hover emphasis, `.chart-svg-heat`, `.chart-tip` |
| 1253-1290 | `.pwa-banner*` (1253-1282) + `@media 860px` (1283-1290) |
| 1293-1350 | Activity summary / device breakdown: `.toolbar-row`, `.summary-*`, `.share-meter`, cost heat `.heat.heat-cost.lvl-*` (1343-1350) |
| 1353-1395 | `.device-status-stack`, `.status-block`, `.status-tags`, `.limit-balance-line`, `.notice*`, `.badge.warn` |
| 1398-1429 | Home sparkline + pills |
| 1431-1455 | Home interactive card rows |
| 1457-1527 | Home limits cards |
| 1529-1549 | Home panel header actions |
| 1551-1565 | Remaining-percent tone: `.meter-*` (1552-1555), `.remaining-tone-*` (1557-1560), `.badge.critical` |
| 1568-1588 | Tool select list |
| 1590-1594 | Shared information-architecture surfaces — **second `:root`**, re-declaring `--font` (1592) and adding `--display` (1593) |
| 1596-1748 | `.page-intro*` (1598-1618), `.eyebrow` (1619), `.page-tabs`/`.page-tab` (1626-1651), `.usage-metric-*` (1652-1686), `.token-mix*` (1687-1699), `.usage-table*` (1700-1730), `.settings-*` (1731-1748) |
| 1750-1756 | `@media 860px` (IA adjustments) |
| 1758-1764 | `@media 520px` |

Anomaly worth noting: the **second `:root` at 1591-1594 late-overrides typography**, so the effective `--font` is line **1592** (Avenir Next / SF Pro Display first — a macOS-first stack), not line 28. Since `html, body` (56) resolves the variable, the override wins globally.

### 5.2 Theme contract — the complete custom-property list

| Selector | Lines |
|---|---|
| `:root` (light) | **2-30** (`color-scheme: light` at 3) |
| `html[data-theme="dark"]` | **32-48** (`color-scheme: dark` at 33) |
| `:root` (2nd: typography) | **1591-1594** |
| `@media (prefers-color-scheme: …)` | **absent** — the CSS never consults the OS scheme |

**26 custom-property names total**, of which 15 are re-declared in the dark block:

- **Surfaces** (5; all dark-redefined): `--bg` (4; dark 34), `--bg-elevated` (5; 35), `--bg-soft` (6; 36), `--panel` (12, `= var(--bg-elevated)`, not redefined), `--panel-2` (13, `= var(--bg-soft)`, not redefined)
- **Text / border** (4; all dark-redefined): `--text` (7; 37), `--muted` (8; 38), `--line` (9; 39), `--line-strong` (10; 40)
- **Compatibility aliases** (2): `--surface` (14, `= var(--bg)`), `--border` (15, `= var(--line-strong)`)
- **Accent / status** (6; all dark-redefined): `--accent` (16; 41), `--accent-soft` (17; 42), `--good` (18; 43), `--warn` (19; 44), `--bad` (20; 45), `--stale` (21; 46)
- **Shadow** (1; dark-redefined): `--shadow` (22; 47)
- **Radius** (2): `--radius` (23, 16px), `--radius-sm` (24, 12px)
- **Layout** (1): `--sidebar-width` (25, 248px)
- **Safe area** (2): `--safe-bottom` (26, `env(safe-area-inset-bottom, 0px)`), `--safe-top` (27, `env(safe-area-inset-top, 0px)`)
- **Typography** (3): `--font` (28, **redefined 1592**), `--mono` (29), `--display` (1593)

**There are no spacing tokens and no z-index tokens** — spacing is hardcoded px, and z-index is bare integers forming an untokenised stacking contract: 18 (`.nav-scrim` 1050), 20 (mobile sidebar 1117), 30 (`.drawer` 950), 35 (`.popover` 1020), 40 (`.auth-gate` 581), 50 (`.toast` 1035), 55 (`.pwa-banner` 1258), 60 (`.account-provider-select.is-open` 638; base 1 at 636), 80 (`.chart-tip` 1235), 100 (`.skip-link` 75). An Electron host must preserve this order or drawer/popover/toast layering breaks.

Usage frequency (`var()` references, same file): `--bg` 50, `--line` 47, `--muted` 35, `--accent` 30, `--bg-soft` 26, `--text` 20, `--bg-elevated` 16, `--line-strong` 14, `--bad` 12, `--safe-bottom` 8, `--shadow` 7, `--good`/`--warn` 6, `--panel`/`--border`/`--radius` 5, `--stale`/`--mono`/`--safe-top` 3, `--accent-soft` 2, remainder 1.

### 5.3 Light/dark

Attribute-based, JS-driven: `applyTheme()` (`app.js:451-459`) resolves `system` through `matchMedia('(prefers-color-scheme: dark)')` (453) and sets `document.documentElement.dataset.theme` (455), matching the `html[data-theme="dark"]` selector. A `matchMedia` change listener re-applies while the pref is `system` (`app.js:3935-3937`). JS also rewrites the non-media `theme-color` meta (`app.js:456-458`), duplicating the literals in `index.html:7-8`. Selector shape matters for reuse: `--panel`/`--panel-2`/`--surface`/`--border` are **not** re-declared in the dark block, but resolve through their aliases — except in the few places they are used with fallbacks (`var(--panel-2, var(--surface))` 1361; `var(--border)` 1362/1374/1576/1583/1585).

### 5.4 Responsive breakpoints

All 7 `@media` blocks:

| Line | Condition | Effect |
|---|---|---|
| 1012 | `max-width: 620px` | `.topup-row` → 2 columns (1013); `.topup-remove` full-row (1014) |
| 1099 | `max-width: 1080px` | `.hero` 4→2 columns (1100); `.grid-3` 3→2 (1101) |
| **1104** | **`max-width: 860px`** | primary mobile threshold — see below |
| 1207 | `prefers-reduced-motion: reduce` | `* { transition: none !important; animation: none !important }` (1208-1211) |
| 1283 | `max-width: 860px` | `.pwa-banner` stacks, moved above the bottom nav (1284-1288) |
| 1750 | `max-width: 860px` | `.page-intro` stacks (1751); `.page-tabs` becomes a full-width scroller (1752-1753); `.usage-metric-strip` 4→2 (1754); `.settings-layout` → 1 column (1755) |
| 1758 | `max-width: 520px` | metric-strip gap (1759), card padding (1760); `.usage-table-row-main` 3→2 columns + chevron/metrics repositioned (1761-1763) |

The 860px block (1104-1200) is the important one: `.app` becomes single-column with bottom-nav padding (1105-1108); `.sidebar` becomes a **fixed bottom tab bar** (`z-index: 20`, 1109-1127); brand/footer/settings-button hide (1128); `.nav` becomes a horizontal scroller (1129-1135); labels hide except on the active item (1136-1142); `.topbar` stacks (1146-1149); `.grid-2`/`.grid-3`/`.limit-windows` collapse to one column (1150); forms/skeletons collapse (1151); management rows and OAuth rows reflow (1153-1156); and **`.app.nav-open .sidebar` reopens the same element as a left drawer** `min(300px, 86vw)` / `100dvh` (1160-1192) with `body.nav-open { overflow: hidden }` (1197-1199).

**860px is the single mobile/desktop boundary and is duplicated in JS**: `isMobileNav()` = `matchMedia('(max-width: 860px)')` (`app.js:541-543`), which gates `openNav()` (`app.js:546`). There are no `min-width`, orientation, `hover`, or `pointer` queries.

Also flagged: `.app.nav-open ~ .nav-scrim` (1193) can never match — `#navScrim` (`index.html:191`) is a sibling of `#app`, not of `.sidebar`. The effective rule is the generic `body.nav-open .nav-scrim` (1194), which depends on JS setting the class on `<body>` (`app.js:548`). And `.nav-scrim:not(.hidden)` (1202-1204) displays the scrim at any viewport whenever `hidden` is absent; JS compensates by toggling `hidden` in lockstep (`app.js:549`). An Electron port that keeps a permanent desktop sidebar should delete both.

### 5.5 Icon system

- **CSS defines only a generic inline-SVG primitive.** `.ui-icon, .ui-icon-slot` (164-169) are 18×18 inline-blocks; `.ui-icon` (170-177) uses `fill: none; stroke: currentColor; stroke-width: 1.8` so icons inherit text colour and theme for free. Context sizing overrides only: 16px (695, 1724), 15px (739, 815), 17px (894); `.management-icon` is a 24px accent-soft tile (805-814); `.nav-ico` (156-163) is a separate 18px grid wrapper.
- **The SVG bodies live in JS**, not CSS: `UI_ICON_PATHS` (`app.js:48-73`, 24 named paths) + `uiIcon(name)` (`app.js:75-78`). Static placeholders `<span data-ui-icon="…">` (`index.html:44`, `56`, `57`, `58`, `108`, `160`) are filled once by `renderStaticUiIcons()` (`app.js:80-84`). Unknown names fall back to the `status` icon (`app.js:76`).
- **Zero `mask-image`, zero `background-image`, zero CSS rules keyed on `data-ui-icon`, and zero `.row-icon-*` rules** in `app.css` — unlike the Electron renderer's `styles.css`, which does use `.row-icon-<id>` rules (per `AGENTS.md`).
- **Per-client icons are plain `<img>` elements**: `.client-icon` (440-447) is 22×22, 6px radius, `object-fit: contain`; enlarged to 28px/8px inside `.account-management-row` (845-849). The URL comes from `clientIconPath(id)` = `` `/icons/clients/${ICON_ALIASES[id] || id}.svg` `` (`data.js:162-165`), used at 11 sites in `app.js` (679, 681, 907, 1033, 1105, 1185, 1264, 1579, 2475, 2502, 2512). Every one carries `onerror="this.style.display='none'"`, so a missing icon degrades to blank rather than a broken image.
- Client *colour* identity is inline-styled `.swatch` (433-439) from `row.color` (`app.js:682`, `908`, `1057`, `1079`, `1265`) — the palette is JS data (`data.js:47-92`), not CSS.

### 5.6 Browser/PWA-specific CSS

- `env(safe-area-inset-*)` as tokens (26, 27), consumed at 98, 213, 1033, 1107, 1121, 1169, 1257, 1287 — resolves to 0px in Electron.
- `-webkit-font-smoothing: antialiased` (59), `text-rendering: optimizeLegibility` (60), `-webkit-overflow-scrolling: touch` (1134, obsolete in Chromium), `-webkit-details-marker` reset (1712, still needed).
- `backdrop-filter` blur (101, 1247, 1268) — supported but forces compositing layers.
- `100dvh` (86, 94, 1165); `color-mix()` with **50 uses** (the core theming mechanism — do not transpile away); `clamp()` (1608, 1670); `text-wrap: balance` (1611).
- `.pwa-banner` (1253-1290) and `.auth-gate` (578-605) are PWA/web-only surfaces; the auth card in particular is dead once Electron injects credentials.
- **Verified absent:** `-webkit-tap-highlight-color`, `user-select`, `::-webkit-scrollbar` styling, `@supports`, `@import`, `@font-face`, `@layer`, `@media print`, `overscroll-behavior`, appearance resets, `forced-colors`/`prefers-contrast`.

### 5.7 Non-token hardcoded colours (refactor candidates)

Totals: 29 hex literals, of which 20 are token definitions; 31 `rgb()/rgba()` calls, of which 8 are token definitions. The rest is hardcoded:

- 9 hex outside token blocks: `#0b0c0e` (305, duplicates dark `--bg` at 34), `#fff` (871, theme-blind on `--accent`), `#e5a50a` ×3 (883, 884, 891), `#f0a202` ×3 (1388, 1389, 1393), `#b7791f` (1394). **Lines 1392-1395 are the clearest bug**: `.badge.warn` re-declares and overrides the tokenised rule at 538 (`var(--warn)`) with literals that are dark-unfriendly.
- 23 `rgba()` outside token blocks: the accent-alpha heat scales at 563-566 (`rgba(37,99,235,…)` = light `--accent` #2563eb) and 567-570 (`rgba(110,168,255,…)` = dark `--accent` #6ea8ff) — the largest cluster; cost heat with no token at 1343-1346 and 1347-1350; three uncoordinated scrims on the same base colour at 955 (.42), 1024 (.28), 1051 (.35) — an obvious `--scrim` token; three shadows bypassing `--shadow` at 276, 1125, 1243; `.swatch` inset ring at 438. The focus ring's literal `white` at 67 also applies in dark theme.

The `color-mix(in srgb, var(--…) N%, transparent)` pattern (50 uses) is *not* a refactor candidate — it is the intended, theme-safe composition mechanism.

---

## 6. Hub HTTP API surface used by the UI

Dispatch has no router table: `handleRequest(req, res)` (`server.js:987-1440`) is a linear `if` chain testing `req.method` + `url.pathname`. Static serving is attempted once, before the auth closure, at `server.js:1013` (comment at 1011-1012: static stays unauthenticated, `/api/*` always requires the secret; `static.js:161` returns `false` for any `/api/` path so API routes keep priority).

### 6.1 Endpoints the web UI actually calls

| Method | Path | Purpose | UI call site |
|---|---|---|---|
| GET | `/api/health` | Capability/auth handshake, `secretRequired` | `api.js:47` ← `app.js:3972` |
| GET | `/api/rates` | Display exchange rates (public, no secret) | raw `fetch` `app.js:3962` |
| GET | `/api/capabilities` | `apiVersion`, `capabilities`, caller `role`/`scopes` | `app.js:3013` |
| GET | `/api/stats` | Aggregated fleet stats | `app.js:2271`, `app.js:3012` |
| GET | `/api/stats/stream` | SSE live stats | `api.js:124` ← `app.js:2281` |
| GET | `/api/history` | Daily history with per-client/per-model stacks | `app.js:2233` |
| GET | `/api/usage/range?from=&to=` | Custom-range aggregation | `app.js:3229` |
| GET | `/api/subscriptions` | Subscription document | `app.js:2321` |
| PUT | `/api/subscriptions` | Replace subscriptions (sends `baseUpdatedAt`) | `app.js:3109` |
| GET | `/api/pricing` | Manual pricing rows | `app.js:2358` |
| PUT | `/api/pricing/:model` | Upsert one model's prices | `app.js:3163` |
| POST | `/api/pricing/:model/fetch-upstream` | Refresh one model from upstream | `app.js:3184` |
| POST | `/api/pricing/fetch-upstream-all` | Refresh all known models | `app.js:3202` |
| GET | `/api/accounts` | List Hub-owned provider accounts | `app.js:2388` |
| POST | `/api/accounts` | Create account | `app.js:2904` |
| PATCH | `/api/accounts/:id` | Update name/label/enabled/credential | `app.js:2897`, `app.js:2952` |
| DELETE | `/api/accounts/:id` | Delete account | `app.js:2975` |
| POST | `/api/accounts/:id/refresh` | Refresh one account's quota | `app.js:2931` |
| POST | `/api/accounts/oauth/start` | Start an OAuth session | `app.js:3526` |
| POST | `/api/accounts/oauth/exchange` | Exchange redirect URL → create account | `app.js:2784` |
| DELETE | `/api/devices/:deviceId` | Delete a device | `app.js:3036` |
| POST | `/api/devices/:deviceId/rename` | Rename a device | `app.js:3049` |

**23 call sites, 22 distinct route+method pairs.** Not used by the UI: the bare `GET /api/devices` list form, `POST /api/ingest`, and `OPTIONS`.

Full server route table (for completeness, including routes the UI never calls):

| Method | Path | Auth scope | Registered |
|---|---|---|---|
| OPTIONS | any | none | `server.js:988` |
| GET | `/api/rates` | none | `991-993` |
| ANY | `/api/health` | none | `995-1009` |
| GET/HEAD | `/api/capabilities` | READ | `1060-1069` |
| GET/HEAD | `/api/accounts` | READ (admin sees credential metadata; viewers redacted) | `1070-1082` |
| GET/HEAD | `/api/stats`, `/api/devices`, `/api/history`, `/api/subscriptions`, `/api/usage/range`, `/api/pricing` | READ (shared gate `1083-1086`) | handlers `1088`, `1089-1096`, `1097`, `1098-1100`, `1129-1143`, `1144` |
| PUT | `/api/subscriptions` | ADMIN (409 `stale_write`) | `1101-1128` |
| POST | `/api/accounts` | ADMIN | `1146-1166` |
| POST | `/api/accounts/oauth/start` | ADMIN | `1168-1180` |
| POST | `/api/accounts/oauth/exchange` | ADMIN | `1182-1212` |
| POST | `/api/accounts/:id/refresh` | ADMIN | `1214-1235` |
| PATCH | `/api/accounts/:id` | ADMIN | `1236-1261` |
| DELETE | `/api/accounts/:id` | ADMIN | `1262-1277` |
| GET | `/api/stats/stream` | READ | `1280-1336` |
| POST | `/api/ingest` | INGEST (checked twice) | `1338-1365` |
| PUT | `/api/pricing/:model` | ADMIN | `1367-1379` |
| POST | `/api/pricing/fetch-upstream-all` | ADMIN | `1381-1387` |
| POST | `/api/pricing/:model/fetch-upstream` | ADMIN | `1389-1401` |
| POST | `/api/devices/:deviceId/rename` | ADMIN | `1403-1428` |
| DELETE | `/api/devices/:deviceId` | ADMIN | `1430-1437` |
| — | anything else | `404 {error:'not_found'}` | `1439` |

Two consistency notes for the rewrite:

- The `readRoute` gate (`1083-1085`) admits `HEAD` for all seven paths, but the handlers at `1088-1144` require `GET`, so `HEAD /api/stats` passes authorization and then falls through to `404`. Authorization is HEAD-permitted; the response is not.
- `/api/accounts/:id` and `/api/pricing/:model` are raw prefix matches with `decodeURIComponent` on the suffix (`1214`, `1371`); an id containing `/` is ambiguous — the UI always `encodeURIComponent`s, so it is safe in practice.

### 6.2 Capabilities / authorization handshake

- **Capabilities object**: `hubCapabilities('node-hub', { hubAccounts: Boolean(accountService) })` (`server.js:382`; `src/shared/hubCapabilities.js:5-21`) → `{stats, history, statsStream, subscriptions, usageRange, pricing, deviceDelete, deviceRename, publicStats: false, hubAccounts, centralLimits, limitsAuthority}`. `HUB_API_VERSION = 2` (`hubCapabilities.js:3`).
- **`GET /api/health`** (`server.js:995-1009`, no method check, no auth) returns `{ok, role:'hub', runtime:'node-hub', version:1, apiVersion, capabilities, hubBuild, deviceCount, secretRequired, auth, now}`. `secretRequired = auth.secretRequired`; `auth = auth.summary = {adminConfigured, unifiedSecretConfigured, viewerConfigured, ingestCredentialCount, legacyAdminEnabled, legacyIngestEnabled}`.
- **`GET /api/capabilities`** (`1060-1069`, READ) adds the caller's `role` and `scopes`. The UI reads `state.authorization.capabilities` and `.scopes` and uses `capabilities.hubAccounts`, `capabilities.subscriptions`, `capabilities.pricing`, `capabilities.usageRange`, plus `scopes.includes('admin')` (`app.js:624-628`, `641`, `1417`, `1747`, `1843-1844`, `2432`, `2732`).
- **Bearer validation** — `authorize()` closure (`server.js:1015-1051`) delegating to `createHubAuthPolicy` (`src/hub/hubAuth.js:88-179`). Credentials are accepted in order: `Authorization: Bearer <secret>` → `x-token-monitor-secret` header → `?secret=` query (`hubAuth.js:68-86`). Secrets are compared constant-time (`hubAuth.js:15-25`). Principals (`113-139`): unified/admin → `admin` with all scopes; viewer → `[read]`; per-device ingest credential → `[read, ingest]` + `deviceId`; legacy secret → read plus opt-in ingest/admin. **With no credential configured at all, every request is allowed as `local-admin`** (`hubAuth.js:143`) — which is the standalone/desktop case the rewrite targets. Query-string credentials are read-only (`151-157`), and a device credential may only ingest its own `deviceId` (`160-162`). Failures return `401 unauthorized` / `403 forbidden` / `403 query_credentials_are_read_only` / `403 device_identity_mismatch`.
- **CORS** — `corsHeaders` (`src/shared/http.js:87-94`) sets `access-control-allow-origin: *`, methods `GET,POST,PUT,DELETE,OPTIONS`, headers `authorization,content-type,prefer,x-token-monitor-secret`, on every `sendJson`/`sendText`/static response. There is no `Vary` header and the wildcard is emitted regardless of auth mode. **This is what makes a `file://` Electron renderer viable without a proxy** — the wildcard origin permits cross-origin calls from the packaged app.
- **Rate / size limits**: auth-failure limiter 30/60s per peer (`server.js:384`, `1044-1048`; proxy headers honoured only when `trustProxy` is on, `1033-1043`); ingest limiter 240/60s per principal (`385`, `1018-1024`); SSE cap 64 clients → `503 too_many_streams` (`50`, `1287-1294`) with a 30 s heartbeat (`317`, `1333`) and a 45 s slow-client drain timeout (`46`, `805`); JSON body cap 1 MiB → `413 payload_too_large` (`shared/http.js:4`, `114-141`); stats aggregation TTL 1 s default (`432`).
- **Transport gate**: a non-loopback bind is rewritten to `127.0.0.1` unless a secret is configured (`133-137`, `386`), and an explicit non-loopback host without TLS throws `insecure_hub_transport` unless `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` (`389-397`).

### 6.3 Static serving (`src/hub/static.js`)

- `tryServeStatic(req, res, {webRoot})` (`157-166`), called at `server.js:1013`; GET/HEAD only (`158`); bails immediately for `/api/` (`161`).
- Web root defaults to `src/hub/web` (`DEFAULT_WEB_ROOT`, `static.js:8`). **There is no `/static` prefix** — every non-`/api/` path is a candidate.
- Traversal defence: `resolveWebFile` (`79-89`) rejects `..`, NUL, `\`, `:` segments (`54-77`) and enforces root containment (`86-87`).
- SPA fallback: extension-less path → `<dir>/index.html` (`108-112`); missing file with no extension or `/` → the shell `index.html` (`115-119`). A miss **with** an unrecognised extension returns `false` → the JSON 404 (`121`, `server.js:1439`). This is what makes `/usage`, `/devices`, `/settings` deep links work.
- MIME map (`18-32`), fallback `application/octet-stream` (`35`).
- Caching (`cacheControlFor` `38-47`): `.html`, `.webmanifest`, and `sw.js` → `no-cache`; `.js/.css/.png/.svg/.webp/.ico` → `public, max-age=3600`; everything else → `no-store`.
- Security headers on every static response: CSP, `referrer-policy: no-referrer`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `permissions-policy` (`10-16`), plus CORS (`125`). `sw.js` also gets `service-worker-allowed: /` (`132-134`).
- `manifest.webmanifest` and `sw.js` are ordinary files under the web root — no special-case routing. `index.html` is served at both `/` and `/index.html` (`84`, `116`).

**Relevance to Electron:** `static.js` is entirely server-side. In the packaged app the same files are read from disk by the renderer (or served by a custom protocol), so the security headers, the SPA fallback, and the MIME map are **not** available and do not transfer. The SPA fallback in particular is what makes `/usage` a valid in-app URL on the web; Electron needs either hash routing or a protocol handler that maps extension-less paths to `index.html`.

---

## 7. Assets

### 7.1 The Hub client icon set

`src/hub/web/icons/clients/` — **42 SVG files**:

`antigravity, claude, cline, codebuddy, codex, cohere, commandcode, copilot, cursor, deepseek, deepseek-harness, doubao, gemini, grok, hermes-agent, kilocode, kiro, meta, minimax, mistral, moonshot, ollama, openclaw, opencode, openrouter, os-apple, os-linux, os-windows, pi, proma, qoder, qodercn, qwen, reasonix, tray-claude, tray-codex, volcengine, workbuddy, xai, xiaomi, zai, zed`

Plus `src/hub/web/icons/`: `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`.

### 7.2 How an id resolves to an icon

`clientIconPath(id)` (`data.js:162-165`):

```js
const key = ICON_ALIASES[id] || id;
return `/icons/clients/${key}.svg`;
```

`ICON_ALIASES` (`data.js:138-152`): `hermes → hermes-agent`, `mimo → xiaomi`, `micode → xiaomi`, `grok → grok` (identity), `zai → zai` (identity), `zaiteam → zai`, `thirdparty → openrouter`, `kimi → moonshot`, `zcode → zai`, `claude-desktop → claude`.

For an unknown id the function still produces a URL, so the request 404s (server.js:1013 → `static.js:157-166` → `server.js:1439` `404 {error:'not_found'}`); the in-source comment at `data.js:146-148` records that this used to happen on every re-render (and `sendJson` sets `cache-control: no-store`, so it re-fetched each time) and that the aliases were added to stop it.

**The `onerror` guard on the 11 call sites does not work.** `src/hub/static.js:14` serves an inline-handler-blocking CSP — `script-src 'self'` with no `'unsafe-inline'` — so `onerror="this.style.display='none'"` never executes. A missing file therefore renders the browser's broken-image glyph rather than degrading silently, and is re-requested on every re-render. The Hub's own test suite acknowledges this (`tests/hub/webDataHelpers.test.js:448-453`). The real protection is the alias table plus test coverage, not the markup.

**Current state: no id 404s.** Coverage was re-checked against the shipped tree: zero misses across `KNOWN_CLIENTS` (26 ids, `src/shared/clientTracking.js:23-27`), `normalizeClientName`'s literal outputs (27, `src/shared/usage.js:173-210`), `LIMIT_PROVIDER_IDS` (20, `src/shared/limitProviders.js:17-21`), and the Hub's own label maps (44). This is enforced by `tests/hub/webDataHelpers.test.js:448` and `:486`. Note `normalizeClientName` has a catch-all slug fallback at `usage.js:209`, so arbitrary upstream ids *can* still reach `clientIconPath`.

`clientIconPath` is used for three id spaces, not one: usage client ids (`app.js:679`, `681`, `907`, `1033`, `1185`, `1264`), limit-card providers (`app.js:1105`, `1579`), and account providers (`app.js:2475`, `2502`, `2512`).

### 7.3 Comparison with the desktop icon trees

**The three trees are not parallel client-icon trees.** A and C are client icons; **B is UI chrome and contains zero client icons** (verified: 21 SVGs under `actions/`, `settings/`, `views/` — `arrow-left`, `calendar`, `spinner`, `accounts`, `appearance`, `collection`, `general`, `limits`, `main`, `sync`, `window`, `device`, `home`, `model`, `project`, `project-row`, `session`, `status`, `tool`, `trends`). The Electron renderer resolves client icons from **C**, never from B, and cannot read A at all — `tests/scripts/electronPackageScope.test.js:34` keeps only `src/electron/**`, `src/shared/**`, `assets/icons/**` in the Electron package.

| Tree | Path | Count | Role |
|---|---|---|---|
| A — Hub web | `src/hub/web/icons/clients/` | 42 SVGs | Hub client icons, served at `/icons/clients/<key>.svg` |
| B — Electron renderer chrome | `src/electron/renderer/icons/` | 21 SVGs under 3 dirs | UI chrome only — local `url("icons/…")` refs at `styles.css:497-498`, `565-566`, `1052-1059`, `2099-2100`, `2268-2269`, `3935-3938` |
| C — Desktop packaged | `assets/icons/` | 45 SVGs + `tray-token-monitor.png` | Electron client/limit/tray icons via `mask-image` and `<img>` |

Set differences (SVG basenames, B walked recursively):

- **A only (1):** `deepseek-harness` — and it is byte-identical to `deepseek.svg` (verified by md5), i.e. a duplicate, not a distinct mark.
- **B only:** all 21 chrome names; `A ∩ B = ∅`, `B ∩ C = ∅`.
- **C only (4):** `claude-desktop`, `hunyuan`, `kimi`, `newapi`.
- **A ∩ C = 41**, and **all 41 are md5-identical** — A is a copy of C minus those four files plus the one duplicate.

How the Electron side resolves instead (two mechanisms, both from C):

- **Rows/limits:** `clientsWithIcon` (`src/electron/renderer/app.js:13-16`, 43 unique ids) gates `iconKindFor()` (`app.js:26-47`), which emits a **class** — `row-icon-<id>` — not a URL. The class resolves to a `mask-image: url(../../../assets/icons/<file>.svg)` rule at `styles.css:2848-2902`. Aliases are inlined per CSS rule (`styles.css:2860` hermes→hermes-agent, `:2865` kimi→moonshot, `:2871` micode→xiaomi, `:2873` zcode→zai, `:2880` deepseek-harness→deepseek, `:2890-2894` zai/zaiteam/mimo→zai/xiaomi) — a second, independently maintained alias table that agrees with the Hub's by convention only.
- **Limit cards:** `renderLimitProviderMark()` (`app.js:2418-2427`) gates on the **same** `clientsWithIcon` set and emits `limit-icon-<id>` (`styles.css:2981-2998`).
- **Tray:** `trayProviderIcons.js:8-29` uses `SPECIAL_ICON_SOURCES` then falls back to `../../../assets/icons/<id>.svg` — here the filename *is* expected to equal the id, so that table must stay exhaustive. All 45 files resolve.

**Do not "fix" `grok`/`xai` by filename.** The ids and files are deliberately crossed (`styles.css:2866` `.row-icon-grok → xai.svg`; `:2885` `.row-icon-xai → grok.svg`) and test-locked at `tests/electron/rendererClientLabels.test.js:47-53`.

Concrete mismatches (each verified):

| Id | A | C | Verdict |
|---|---|---|---|
| `deepseek-harness` | file | no file | **OK** — Hub serves A's copy; Electron aliases to `deepseek.svg` (`styles.css:2880`); the two agree by construction |
| `hermes` | no file | no file | **OK** — both alias to `hermes-agent.svg` (`data.js:139`, `styles.css:2860`); pure naming divergence |
| `kimi` | no file | file | **OK** — Hub `data.js:149` and Electron `styles.css:2865` both → `moonshot.svg`. Note C ships *two* different Kimi marks: `kimi.svg` (774 B) is byte-different from `moonshot.svg` (4028 B) and every code path picks `moonshot`; `kimi.svg` is unreferenced |
| `micode`, `mimo`, `zaiteam`, `zcode` | no file | no file | **OK** — identical aliases both sides |
| `thirdparty` | no file | no file | **BROKEN today** — Hub aliases to `openrouter.svg` (`data.js:145`), but Electron's `renderLimitProviderMark('thirdparty')` fails `clientsWithIcon.has()` and falls to a plain `dot` (`app.js:2420-2424`), so the shipped `.limit-icon-thirdparty → newapi.svg` rule (`styles.css:2991-2994`) is **unreachable** |
| `claude-desktop` | no file | file | **Dead rule** — Hub aliases to `claude.svg` (`data.js:151`) and works; Electron has `styles.css:2858` but the id is absent from `clientsWithIcon` (`app.js:13-16`), so `.row-icon-claude-desktop` is unreachable and the row falls back to `dot` |
| `hunyuan` | no file | file | **Dead asset** — zero references anywhere in `src/`, `docs/`, or the READMEs |
| `tray-claude`, `tray-codex` | file | file | **Dead in A** — no `tray-` reference exists under `src/hub/web/`; copied over from C, which does use them |
| `meta` | file | file | Present in **both** trees (1735 B in A) — it is not an A-only gap |
| `newapi` | no file | file | Reached only through the `thirdparty` alias path, which is exactly the broken one above |

Net: **zero 404s in the Hub today**, but **one real render defect on the Electron side** (`thirdparty` loses its glyph; `claude-desktop` is a dead rule) and **two dead assets in A**.

**No drift guard exists between A and C.** `scripts/generate-transparent-icons.js:9` writes only `tray-token-monitor.png` into `assets/icons`; no script or test re-syncs or diffs the two trees, and no test asserts that every `clientsWithIcon` member has a matching `.row-icon-`/`.limit-icon-` rule (coverage is done by ~10 hand-written `assert.match` checks in `tests/electron/rendererClientLabels.test.js`). That gap is precisely why the `thirdparty` defect is invisible.

**Canonical id lists** (two, both under `src/shared/`, disjoint by design): `KNOWN_CLIENTS` (26 ids, `clientTracking.js:23-27`, derived from `DEFAULT_CLIENTS` at `:8`) for usage clients, and `LIMIT_PROVIDER_IDS` (20 ids, `limitProviders.js:17-21`) for the provider axis. Five `KNOWN_CLIENTS` ids have no A file and four have no C file, but every one is covered by an alias — so the shared source of truth is fine; the *alias tables* are the duplicated, unguarded surface.

**Recommendation for the rewrite:** ship one icon directory (C, since Electron can read it and the Hub can copy it) and derive a single alias table from `KNOWN_CLIENTS` + `LIMIT_PROVIDER_IDS` instead of maintaining `ICON_ALIASES` in `data.js`, the inlined CSS aliases in `styles.css`, and `SPECIAL_ICON_SOURCES` in `trayProviderIcons.js` separately. Also add the missing guard: a test that diffs the two trees and asserts alias coverage for every canonical id — otherwise each new tracked client still needs edits in four places that can silently disagree.

---

## 8. Reuse assessment

### 8.1 Shareable essentially verbatim

| Artifact | Why it is safe | Change needed |
|---|---|---|
| `js/data.js` (695 lines) | Provably pure — no DOM, no fetch, no storage. | Only the one line producing the icon URL (`data.js:164`) needs a configurable base, and `ICON_ALIASES` should be reconciled with `src/shared/clientTracking.js`. |
| `js/format.js` (96 lines) | Pure except the module-level rate table. | None. `configureRates()` is already the injection point. |
| `js/i18n.js` (1732 lines, 337 keys × 5 locales) | Pure except `navigator.languages` in `resolveLocale`. | None for `t()`; `applyI18n` already takes a root. Consider porting the ~1040 desktop-only keys into this table (§4.5). |
| `css/app.css` (1764 lines) | Attribute-driven theming, no build step, no `@import`, no `@font-face`. | Drop `.pwa-banner` + `.auth-gate` blocks; consider deleting the ≤860px bottom-nav/drawer rules if the Electron window has a floor width > 860px; tokenise the literals in §5.7; pin `--font`/`--display` explicitly for Windows/Linux since the effective stack is macOS-first (`app.css:1592`). |
| The 8 view renderers and their helpers in `app.js` (`renderHome` 1004, `renderUsage` 1312, `renderDevices` 1359, `renderLimits` 1597, `renderTrends` 2139, `renderAccountsPage` 2739, `renderManagement` 1851, `renderSettingsPage` 1864, plus `render()` 2179) | They read `state` + pure `data.js` and emit HTML strings; every user-facing string already flows through `tr()`. | Nothing structural — they are only coupled to the module through `state`, `els`, `tr`, and `escapeHtml`. Extracting them into a module that receives a context object is mechanical. |
| `state` shape (`app.js:261-347`) | Plain data. | `prefs` must be backed by `settings.json`; `secret` by the credential store. |
| Request sequencing (`app.js:2295-2310`) | Pure logic over `AbortController`. | None. |
| Draft/focus preservation (`app.js:724-892`) | Pure DOM helpers scoped to a container element. | None. |
| Icon registry (`app.js:48-84`) | Inline SVG strings. | None. |

### 8.2 Needs an adapter layer

1. **Base URL + auth injection — the critical one.** Every request in `api.js:47`, `api.js:124`, `api.js:53`, and every `fetchJson('/api/…')` in `app.js` (23 call sites, §6.1) is origin-relative. The Electron renderer runs on `file://` (or a custom protocol), where `/api/stats` resolves to the filesystem root. `api.js` must take a `baseUrl` and a `secret` provider, and `app.js:3962`'s raw `fetch('/api/rates')` must go through the same wrapper. The Hub's wildcard CORS (`shared/http.js:87-94`) means no proxy is required — only absolute URLs. Also note the mixed-content consequence: a Hub on `http://` behind an `https://` page is fine for the web UI only because it shares the origin; from Electron the app should require `https://` or a loopback `http://` Hub.
2. **Secret storage.** Replace `loadSecret`/`saveSecret`/`clearSecret` (`api.js:19-37`) and the `#authGate` flow with the existing `userData/credentials.json` path (`AGENTS.md`: "The single Hub secret is the only raw credential exposed by the sync UI"). The `401` convergence points (`app.js:2236`, `2335`, `2365`, `2395`, `448`, `3631`, `3804`) should route to a re-auth prompt rather than `showAuth(true)`.
3. **Prefs persistence.** `loadPrefs`/`savePrefs` (`api.js:5-17`) over `token-monitor.hub.prefs` should be swapped for `settings.json` reads/writes (or kept keyed but namespaced). There is no schema version, so the adapter should own the key list from §2.1.
4. **History/routing.** `pushState` + the legacy alias table (`app.js:148-207`) should become hash-based or an in-memory router for `file://`; `static.js`'s SPA fallback (§6.3) does not exist in Electron.
5. **Native dialogs.** `window.confirm`/`window.prompt` at `app.js:2971`, `3035`, `3046`, `3048`, `3141` → Electron dialogs; `window.open` (`3544`) → `shell.openExternal`; `navigator.clipboard` (`3551-3559`) → a clipboard IPC (the handler already degrades on failure).
6. **Desktop-only settings** — the surface the rewrite must keep and the web UI must not claim. The web Settings page already labels it (`app.js:1892`, `i18n.js:1457`): window, tray, startup, collector cadence, tracked clients, WSL scanning, exports, local session archives. In the new Electron app these are backed by the existing IPC channels listed in §3.3, and the shared Settings page should either hide the "desktop-only" panel or replace it with the real controls.

### 8.3 Remove for Electron

`sw.js` entirely and its registration (`app.js:3947-3954`); the PWA install surface (banner markup `index.html:180-189`, `app.js:329`, `346`, `553-585`, `1891`, `3424-3431`, `3867-3899`); the auth gate (`index.html:85-101`, `app.js:469-476`, `1921-1928`, `3019-3024`); the `#navScrim` + mobile drawer mechanism if the desktop window has a minimum width (`index.html:191`, `app.js:545-551`, `css/app.css:1104-1204`); the hero `theme-color` meta rewriting (`app.js:456-458`) once the native window chrome is under our control.

### 8.4 Risk summary

- **Highest risk: the origin-relative URL assumption.** It is spread across 23 call sites and two modules and is invisible until the renderer is loaded from `file://`. Fix `api.js` first and route `app.js:3962` through it.
- **Second: i18n table divergence** (7 shared keys out of 337 and 1047). The desktop-only settings strings cannot come from the Hub table.
- **Third: the `onerror` icon fallback is dead and the alias tables are unguarded.** The Hub's CSP (`static.js:14`, `script-src 'self'`, no `'unsafe-inline'`) blocks the inline `onerror` on all 11 `clientIconPath` call sites, so a missing icon shows a broken-image glyph instead of degrading. The Hub currently 404s on nothing, but Electron has a **live defect**: `thirdparty` is missing from `clientsWithIcon` (`renderer/app.js:13-16`), so its shipped `newapi.svg` glyph never renders, and `claude-desktop`'s CSS rule is unreachable. Nothing diffs `src/hub/web/icons/clients/` against `assets/icons/` (41 of 42 files are byte-identical copies), so the two trees can silently drift. Fix the `thirdparty`/`claude-desktop` set membership and add a coverage test before sharing an icon directory.
- **Fourth: `app.js` is a single 4 000-line module with no view boundaries.** Sharing it means either shipping it whole (with the PWA/auth code removed) or doing the extraction into per-view modules as part of the rewrite. Nothing in the file prevents extraction, but nothing enables it either — the renderers close over module-level `state` and `els`.
- **Fifth: the 860px mobile behaviour is duplicated between CSS and JS** (`app.css:1104`, `app.js:541-543`). If the desktop window can be narrower than 860px, both must be kept in sync; if it cannot, both should be neutralised consistently rather than only one.

---

### Appendix — quick file map

```
src/hub/web/
  index.html                 195  shell: nav, topbar, hero, auth gate, drawer, popover, PWA banner
  manifest.webmanifest         -  PWA manifest (start_url "/", standalone)
  sw.js                       75  precache + cache-first-with-revalidate (PWA only)
  favicon.png, icons/*.png     6  app icons (192/512, maskable, apple-touch)
  icons/clients/*.svg         42  per-client icons, resolved by clientIconPath()
  css/app.css               1764  single stylesheet; 26 CSS custom properties; 860px mobile breakpoint
  js/api.js                  224  fetch + Bearer + localStorage prefs + hand-rolled SSE client
  js/data.js                 695  pure transforms + CLIENT_LABELS/COLORS + ICON_ALIASES
  js/format.js                96  number/currency/relative formatting + exchange rates
  js/i18n.js                1732  337 keys x en/zh-CN/zh-TW/ja/ko; t()/resolveLocale()/applyI18n()
  js/app.js                 3989  the SPA: state, router, 8 view renderers, event delegation
```
