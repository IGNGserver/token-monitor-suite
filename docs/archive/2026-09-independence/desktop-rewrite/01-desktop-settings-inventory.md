# Desktop (Electron) client — complete settings inventory

> **Historical Archive / 历史归档说明**
> 
> 本文档是 2026-09 分支独立与桌面端重构过程中的内部审计/计划快照，**不再维护**。
> 文中提及的旧路径（如 `worker/`、`native/macos/`、旧版 `app.js` 等）在当前代码库中已不存在。

---


Scope: the **current** floating-widget Electron client, as a baseline for the planned rewrite.

Sources of truth (all line numbers verified against the working tree at
`/home/lvziw/项目/token记录系统`):

| File | Role |
|---|---|
| `src/electron/main.js` | `defaultSettings()` (L317–417), `readSettings()` (L983–1118), `settingsForRenderer()` (L2386–2408), `settings:update` IPC (L3822–4021) |
| `src/electron/renderer/index.html` | static settings panel markup (`<section id="settingsPanel">`, L34–567) |
| `src/electron/renderer/app.js` | renderer read/write logic; `saveSettings()` (L7380), `syncSettingsForm()` (L5984–6090) |
| `src/electron/preload.js` | `window.tokenMonitor` bridge (L5–97) |
| `src/shared/credentialStore.js` | credential split + legacy migrations |
| `src/electron/runtimeConfig.js` | which settings are "structural" (restart the collector/mode) |
| `docs/configuration.md` | prose description (partly stale — see §6) |

Two important structural facts discovered while verifying (they change how a rewrite must model this):

1. **There is no `hubMode: 'host'` in `defaultSettings()`.** L322 sets `hubMode: envHubUrl ? 'client' : 'local'`. Legacy `'host'` is downgraded to `'local'` in `readSettings()` (L1011).
2. **The credential file is the real store for `secret`.** `settings.json` is written through `stripCredentialSettings()`, so `secret` lives only in `userData/credentials.json` under `credentials.hub.clientSecret` (`CREDENTIAL_SETTING_PATHS`, `credentialStore.js` L11–13). `readSettings()` merges it back (L1002–1004). Only `secret` is allow-listed to the renderer (`settingsForRenderer()`, L2388–2390).

---

## 1. Every key in `defaultSettings()`

84 keys, in source order (extracted mechanically from L321–416).
Legend for the last column:

- **device-local** — only describes this machine / this window; the Hub never sees it (or sees it only as a local display preference).
- **shared-usage** — the widget's value is sent to the Hub *as part of the device record* on every collect (`trackedClients`, `projectsEnabled`, `allTimeSince`, `periodWindows`, `wslStatus`; see `src/shared/collector.js` L1635–1651 and `src/shared/usage.js` `normalizeDeviceRecord` L942–1000).
- **sync** — it is the identity/authentication/transport of this device against the Hub.

### 1.1 Sync / Hub connection

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `hubMode` | `'local'` (or `'client'` when `TOKEN_MONITOR_HUB_URL` set) — L322 | — (derived from `TOKEN_MONITOR_HUB_URL`) | **Sync** → `input[name="hubMode"][value="local"]` / `[value="client"]` (index.html L533, L537; handler app.js L7557) | sync |
| `hubUrl` | env `TOKEN_MONITOR_HUB_URL` normalized, else `''` — L318, L323 | `TOKEN_MONITOR_HUB_URL` | **Sync** → `#hubUrlInput` (L542) + `#saveSettingsButton` (L562; app.js L7541) | sync |
| `secret` | env `TOKEN_MONITOR_SECRET` or `''` — L324 | `TOKEN_MONITOR_SECRET` | **Sync** → `#secretInput` (L546) + `#saveSettingsButton`; paste helper `#secretPasteButton` (L547). Stored in `credentials.json`, not `settings.json` | sync |
| `allowInsecureHubHttp` | `parseBoolean(TOKEN_MONITOR_ALLOW_INSECURE_HTTP, false)` — L325 | `TOKEN_MONITOR_ALLOW_INSECURE_HTTP` | **Sync** → `#allowInsecureHubHttpInput` (L550) + save button | sync |

> `hubMode`/`hubUrl`/`allowInsecureHubHttp`/`secret`/`deviceId` are the **MODE_STRUCTURAL_KEYS** — changing them calls `startMode()`, i.e. a full re-init of the collector/SSE (`runtimeConfig.js` L5–11, used at main.js L3991–3993).

### 1.2 Window behaviour & presence

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `windowBehavior` | `'floating'`, or `'normal'` when `TOKEN_MONITOR_ALWAYS_ON_TOP==='0'` — L319, L326 | `TOKEN_MONITOR_ALWAYS_ON_TOP` (indirect) | **Window** → `#windowBehaviorInput` (L177) | device-local |
| `alwaysOnTop` | `windowBehavior === 'floating'` — L327 | — | **no direct control**; derived and forced by `normalizeWindowBehaviorSettings()` (main.js L3872, `windowBehavior.js` L66–83) | device-local |
| `windowBounds` | `null` — L396 | — | **renderer-only / not in UI** — persisted from `resized`/`moved` events (`persistBoundsSoon()` main.js L840–869, L3525–3526) | device-local |
| `zoomFactor` | `1` — L397 | — | **Appearance** → `#zoomInput` (range 70–160, L274), reset `#resetZoomButton` (L274; app.js L7816) | device-local |
| `showTrayIcon` | `true` — L398 | — | **Window** → `#showTrayIconInput` (L227) | device-local |
| `trayMode` | `false` — L399 | — | **Window** → `#trayModeInput` (L248), force-cleared when tray icon off (`normalizeTrayModeSettings`, `trayModeSettings.js` L13–19) | device-local |
| `closeToTray` | `false` — L400 | — | **Window** → `#closeToTrayInput` (L197) | device-local |
| `startInTray` | `false` — L401 | — | **General → Startup** → `#startInTrayInput` (L62) | device-local |
| `trayContent` | `'tokens'` — L402 | — | **Window** → `#trayContentInput` (L230) | device-local |
| `trayCustomLayout` | `createDefaultTrayLayout()` — L403 (`trayLayout.js` L493–500) | — | **Window** → generated `#trayComposer` (L246) when `trayContent === 'custom'`; commit via app.js L8909 | device-local |
| `showTrayProviderBadge` | `false` — L404 | — | **Window** → `#showTrayProviderBadgeInput` (L247) | device-local |
| `windowToggleShortcut` | `''` — L405 | — | **Window** → `#windowToggleShortcutValue` recorder (L187) + `#windowToggleShortcutClearButton` (L188) | device-local |
| `floatingBubbleEnabled` | `false` — L345 | — | **Window → Floating & Tray** → `#floatingBubbleInput` (L196) | device-local |
| `floatingBubbleTrigger` | `'click'` — L346 | — | **Window** → `#floatingBubbleTriggerInput` (L201, row `#floatingBubbleTriggerRow`) | device-local |
| `floatingBubbleContent` | `'icon'` — L347 | — | **Window** → `#floatingBubbleContentInput` (L207, row `#floatingBubbleContentRow`) | device-local |
| `floatingBubbleCustomLayout` | `createDefaultTrayLayout()` — L348 | — | **Window** → generated `#floatingBubbleComposer` (L223) | device-local |
| `floatingBubbleBounds` | `null` — L349 | — | **renderer-only / not in UI** — written by drag/collapse (`main.js` L735, L866, L4074) | device-local |

### 1.3 Appearance

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `glassOpacity` | `68` — L329 | — | **Appearance** → `#glassInput` (range, L272), reset `#resetGlassButton` | device-local |
| `glassBlur` | `32` — L330 | — | **Appearance** → `#blurInput` (labelled "Depth", L273), reset `#resetDepthButton` | device-local |
| `systemGlass` | `true` — L331 | — | **Appearance** → `input[name="systemGlassOption"]` value `system`/`off` (L265) | device-local |
| `macosGlassStyle` | `liquid-glass` if macOS 26+, else `vibrancy` — L332–334 | — | **Appearance** → `#macosGlassInput` (L266). Whole row `#macosGlassRow` is `hidden` unless macOS **and** `systemGlass !== false` (`macosGlass.js` L22, applied app.js L5197) | device-local |
| `windowsBackdrop` | `'acrylic'` — L335 | — | **no UI control** — the Windows backdrop selector was removed; `windowsGlass.js` L30–37 keeps `showBackdropControl: false` and only echoes the legacy value | device-local |
| `reduceMotion` | `'system'` — L336 | — | **Appearance** → `input[name="reduceMotionOption"]` system/on/off (L280–282) | device-local |
| `showLiveDot` | `true` — L337 | — | **Appearance** → `#liveDotInput` (L267) | device-local |
| `showToolIcons` | `true` — L338 | — | **Appearance** → `#toolIconsInput` (L268) | device-local |
| `titleIconOnly` | `true` — L339 | — | **Appearance** → `#titleIconInput` (L269); row `#titleIconRow` hidden **on Windows** (`app.js` L5237, control forced on) | device-local |
| `showCompactTotalTokens` | `false` — L340 | — | **Appearance** → `#showCompactTotalTokensInput` (L270) | device-local |
| `themeColors` | `{}` — L343 | — | **Appearance → Interface Theme** → generated `#themeColorGrid` (L313) + `#themePresetChips` (L294), and **import/export** via `#themeCodeInput`/`#copyThemeCodeButton`/`#applyThemeCodeButton` (L298–300) | device-local (shareable only through an explicitly copied theme code) |
| `vendorColors` | `{}` — L344 | — | **Appearance → Vendor Colors** → generated `#vendorColorList` (L330), reset `#resetVendorColorsButton` | device-local |

Plus one **renderer-only** appearance control: `settingsInTitlebar` (see §3.2).

### 1.4 Main view / Home preferences

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `heatmapMetric` | `'cost'` — L341 | — | **Main** → generated inside `#viewDisplayList` → Home subgroup → `input[name="homeHeatmapMetric"]` (app.js L6742); also the **separate trends dashboard** window (dashboard.js L748) | device-local |
| `homeActiveDaysWindow` | `'all'` — L342 | — | **Main** → same Home subgroup → `input[name="homeActiveDaysWindow"]` (app.js L6771) | device-local |
| `lastViewState` | `{period:'today', breakdown:'tool'}` — L350 | — | **renderer-only / not in UI** — written on period/view change (`app.js` L4756 → `window:viewState`), persisted main.js L639–652 | device-local |
| `clientDisplayOrder` | `''` — L356 | — | **Collection** → generated `#clientDisplayList` (L351), reset `#resetClientDisplayOrderButton` | device-local |
| `hiddenClients` | `''` — L357 | — | **Collection** → `#clientDisplayList` eye toggle; `#showAllClientsButton` clears it | device-local |
| `pinnedClients` | `''` — L358 | — | **Collection** → `#clientDisplayList` pin toggle | device-local |
| `viewDisplayOrder` | `''` — L359 | — | **Main** → `#viewDisplayList` (L139), reset `#resetViewDisplayOrderButton` | device-local |
| `hiddenViews` | `'status'` (`defaultViewDisplayPreferences()`) — L360 | — | **Main** → `#viewDisplayList` eye toggle; `#showAllViewsButton` clears it. Also written indirectly when enabling Trends/Projects (app.js L6857, L6867) | device-local |
| `homeModuleOrder` | `'limits,tool,device,model,trends'` — L361 | — | **Main → Home subgroup** → generated `#homeSettingsList` (app.js L6610) | device-local |
| `hiddenHomeModules` | `'tool,device'` — L362 | — | **Main → Home subgroup** → `#homeSettingsList` eye toggle | device-local |
| `showHomeLimitBars` | `false` — L363 | — | **Main → Home → Limits subgroup** → generated checkbox `#homeLimitProviderList` (app.js L6500) | device-local |
| `showHomeLimitProviderNames` | `false` — L364 | — | **Main → Home → Limits subgroup** → generated `#homeLimitProviderList` (app.js L6525); disabled+forced when `showToolIcons === false` | device-local |
| `serviceProviderDisplayOrder` | `''` — L381 | — | **Main → Status subgroup** → generated `#serviceProviderList` (app.js L7232) | device-local |
| `hiddenServiceProviders` | `''` — L382 | — | **Main → Status subgroup** → `#serviceProviderList` eye toggle | device-local |
| `serviceStatusRefreshMs` | `60000` — L383 | — | **Main → Status subgroup** → generated `<select id="serviceStatusRefreshSelect">` (app.js L6912); allowed `[0,60000,120000,300000,900000,1800000]` | device-local |

### 1.5 Collection

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `clients` | `clientsCsvForSetting(TOKEN_MONITOR_CLIENTS)` — L354 | `TOKEN_MONITOR_CLIENTS` | **Collection** → `#clientDisplayList` checkboxes (app.js L7106) | **shared-usage** (sent as `trackedClients`) |
| `migratedDefaultClients` | `''` — L355 | — | **renderer-only / not in UI** — internal marker for the one-time "new default client" migration (`ensureSettingsLoaded()` L613–619) | device-local |
| `projectsEnabled` | `parseBoolean(TOKEN_MONITOR_PROJECTS_ENABLED, false)` — L365 | `TOKEN_MONITOR_PROJECTS_ENABLED` | **Main → Projects subgroup** → generated `#projectSettingsList` (app.js L6837) | **shared-usage** (`projectsEnabled` on the wire, `usage.js` L965) |
| `historyEnabled` | `parseBoolean(TOKEN_MONITOR_HISTORY_ENABLED, true)` — L366 | `TOKEN_MONITOR_HISTORY_ENABLED` | **Main → Trends subgroup** → generated `#trendSettingsList` (app.js L6792) | device-local |
| `historyIntervalMs` | `normalizeHistoryIntervalMs(TOKEN_MONITOR_HISTORY_INTERVAL_MS)` — L367 | `TOKEN_MONITOR_HISTORY_INTERVAL_MS` | **Main → Trends subgroup** → generated `<select id="trendIntervalSelect">` (app.js L6805), options 5/10/15/30/60 min | device-local |
| `sessionUsageArchiveEnabled` | `parseBoolean(TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED, true)` — L368 | `TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED` | **Collection → Session history** → `#sessionUsageArchiveInput` (L374); clear action `#clearSessionUsageArchiveButton` (L379) | device-local |
| `wslScanEnabled` | `parseBoolean(TOKEN_MONITOR_WSL_SCAN, true)` — L369 | `TOKEN_MONITOR_WSL_SCAN` | **Collection** → `#wslScanInput` (L387) inside `#wslScanRow`, which is `hidden` unless `platform === 'win32'` (`renderWslPanel()` app.js L6968–6972) | **shared-usage** (`wslStatus` on the wire, `collector.js` L1650) |
| `collectionMode` | `normalizeCollectionMode(TOKEN_MONITOR_COLLECTION_MODE)` — L320, L373 | `TOKEN_MONITOR_COLLECTION_MODE` | **Collection → Collection frequency** → `#collectionCadenceInput` (L358); one `<select>` encodes *two* keys (`live`/`smart`/`300000`/`900000`/`1800000`) (app.js L7639) | **shared-usage** (structural: restart) |
| `collectionIntervalMs` | `normalizeCollectionIntervalMs(TOKEN_MONITOR_INTERVAL_MS, mode default)`; 5 min live / 10 min smart — L374–377 | `TOKEN_MONITOR_INTERVAL_MS` | same `#collectionCadenceInput` as above | **shared-usage** (structural) |
| `watchEnabled` | `parseBoolean(TOKEN_MONITOR_WATCH, true)` — L378 | `TOKEN_MONITOR_WATCH` | **no UI control** — forced by `collectionMode`: chokidar watching is on for `live`, off for `interval` (`runtimeConfig.js`→`usageConfigFromSource` `collectorConfig.js` L60–63; main.js `collectorWatchEnabled()` L444–446) | **shared-usage** (structural) |
| `watchDebounceMs` | `normalizeSharedWatchDebounceMs(TOKEN_MONITOR_WATCH_DEBOUNCE_MS)` (1500) — L379 | `TOKEN_MONITOR_WATCH_DEBOUNCE_MS` | **no UI control** | **shared-usage** (structural) |
| `syncUploadIntervalMs` | `normalizeSyncUploadIntervalMs(TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS)` — L380 | `TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS` | **Sync** → `#syncUploadIntervalInput` (L552): Live / 10m / 20m / 30m | sync (SINK_STRUCTURAL_KEY) |
| `allTimeSince` | env `TOKEN_MONITOR_ALL_TIME_SINCE` or `'2024-01-01'` — L385 | `TOKEN_MONITOR_ALL_TIME_SINCE` | **no UI control** — explicitly called out as raw-JSON-only in **General → Advanced** note (L109) | **shared-usage** (structural) |
| `customModelPricing` | `[]` — L386 | — | **Collection → Custom model pricing** accordion: `#customPricingList`, `#customPricingAddButton`, `#customPricingModelSelect`/`#customPricingModelInput`, `#customPricingCacheRead`, `#customPricingInput`, `#customPricingOutput`, `#customPricingSaveButton`, `#customPricingCancelButton` (L441–466; app.js L9312, L9455) | device-local (local cost computation only) |
| `archivedClientUsage` | `{version:1, clients:{}}` — L384 | — | **renderer-only / not in UI** — internal archive; migrated out to `clientUsageArchive` shared file (`ensureClientUsageArchiveLoaded()` L1227–1243) | device-local |
| `exportAutoEnabled` | `false` — L370 | — | **Collection → Data export** → `#exportAutoInput` (L403) | device-local |
| `exportDir` | `''` — L371 | — | **Collection → Data export** → `#exportPickDirButton` (L410) writes `exportDir` (app.js L7673) | device-local |
| `exportIntervalMs` | `60000` — L372 | — | **Collection → Data export** → `#exportIntervalInput` (L414) | device-local |
| `deviceId` | env `TOKEN_MONITOR_DEVICE_ID` or `defaultDeviceId()` — L352 | `TOKEN_MONITOR_DEVICE_ID` | **no UI control** — the renderer resolves `#deviceIdInput`, but that element does **not exist** in index.html; `syncSettingsForm()` guards with `if (els.deviceIdInput)` (app.js L5996) | sync (MODE_STRUCTURAL_KEY) |
| `lastPostedDeviceId` | `''` — L353 | — | **renderer-only / not in UI** — legacy identity, migrated to the shared `deviceIdentity` file (`ensureDeviceIdentityLoaded()` L1251–1264) | device-local |

### 1.6 Limits

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `limitsEnabled` | `parseBoolean(TOKEN_MONITOR_LIMITS_ENABLED, true)` — L387 | `TOKEN_MONITOR_LIMITS_ENABLED` (legacy) | **no UI control** — kept as a render-side gate (`app.js` L1994, L2963) | device-local (legacy) |
| `limitProviders` | `parseLimitProviders(TOKEN_MONITOR_LIMIT_PROVIDERS).join(',')` — L388 | `TOKEN_MONITOR_LIMIT_PROVIDERS` (legacy) | **no UI control**; the renderer only *reads* it (`app.js` L1988). The only write path constructs it for a tray-icon render call (app.js L8177) | device-local (legacy) |
| `limitProviderOrder` | `defaultLimitProviderOrder()` — L389 | — | **no direct control**; used as the fallback order for the Home limits list (`app.js` L6123 L7251–7265) | device-local |
| `homeLimitProviderOrder` | `''` — L390 | — | **Main → Home → Limits subgroup** → generated `#homeLimitProviderList` drag order (app.js L7252, L7260), reset L7265 | device-local |
| `hiddenHomeLimitProviders` | `''` — L391 | — | **Main → Home → Limits subgroup** → `#homeLimitProviderList` visibility toggles (app.js L7246, L7270) | device-local |
| `homeLimitAccountCount` | `3` (`HOME_LIMIT_ACCOUNT_COUNT_DEFAULT`) — L392 | — | **Main → Home → Limits subgroup** → generated number input in `#homeLimitProviderList` (app.js L6545; clamp 1–12) | device-local |
| `showLimitSource` | `parseBoolean(TOKEN_MONITOR_SHOW_LIMIT_SOURCE, false)` — L393 | `TOKEN_MONITOR_SHOW_LIMIT_SOURCE` | **AI Tool Limits** → `#showLimitSourceInput` (L479) | device-local |
| `maskLimitAccountEmails` | `false` — L394 | — | **AI Tool Limits** → `#maskLimitAccountEmailsInput` (L480) | device-local |
| `showLimitUsed` | `parseBoolean(TOKEN_MONITOR_SHOW_LIMIT_USED, false)` — L395 | `TOKEN_MONITOR_SHOW_LIMIT_USED` | **AI Tool Limits** → `#showLimitUsedInput` (`remaining`/`used`, L482) | device-local |

### 1.7 General / integrations / misc

| key | default | env var seed | edited in UI | semantics |
|---|---|---|---|---|
| `refreshMs` | `Number(TOKEN_MONITOR_WIDGET_REFRESH_MS || 15000)` — L328 | `TOKEN_MONITOR_WIDGET_REFRESH_MS` | **no UI control**; renderer reads it for the local poll timer only (`app.js` L5149, min 5000 enforced at main.js L3878) | device-local |
| `discordRpcEnabled` | `false` — L351 | — | **General → Integrations** → `#discordRpcInput` (L66) | device-local |
| `startAtLogin` | `false` — L408 | — | **General → Startup** → `#startAtLoginInput` (L59); disabled when the platform has no login-item support (`app.js` L6063) | device-local |
| `automaticAppUpdates` | `false` — L409 | — | **General → App Updates** → `#automaticAppUpdatesInput` (L74, row `#automaticAppUpdatesRow`) | device-local |
| `language` | `'auto'` — L410 | — | **General → Interface language** → `#languageInput` (L43) | device-local |
| `appUpdate` | `{lastCheckedAt:null, lastKnownLatest:null, dismissedVersion:null}` — L411–415 | — | **renderer-only / not in UI as a setting** — written by the update checker and by the dismiss button `#appUpdatePillDismiss` → `appUpdate:dismiss` (main.js L3291–3299, L4420) | device-local |
| `currency` | `normalizeCurrency(TOKEN_MONITOR_CURRENCY || 'USD')` — L406 | `TOKEN_MONITOR_CURRENCY` | **Main** → `#currencyInput` (L141) | device-local |
| `currencyRates` | `{}` — L407 | — | **Main** → `#currencyRateModeAuto`/`#currencyRateModeManual` (L152–153) + `#currencyRateOverrideInput` (L159); row `#currencyRateRow` hidden for USD (app.js L733) | device-local |

**Env seeds that exist in `defaultSettings()` but are *not* documented in `.env.example`**
(verified by `grep -c` against `.env.example`): `TOKEN_MONITOR_ALWAYS_ON_TOP`,
`TOKEN_MONITOR_WIDGET_REFRESH_MS`, `TOKEN_MONITOR_CURRENCY`,
`TOKEN_MONITOR_HISTORY_INTERVAL_MS`, `TOKEN_MONITOR_WSL_SCAN`,
`TOKEN_MONITOR_SHOW_LIMIT_SOURCE`, `TOKEN_MONITOR_SHOW_LIMIT_USED`,
`TOKEN_MONITOR_ALL_TIME_SINCE`. `AGENTS.md` explicitly allows this ("Lower-level runtime knobs may still be accepted without being listed there").

---

## 2. Settings UI structure as it appears today

Eight collapsible sections in `#settingsPanel`, each a `.settings-collapsible-group` with a
`button.settings-section-toggle[data-settings-section=…]` and a `…SettingsDetails` body.

| # | Section | `data-settings-section` | Details id | Subgroups (in order) |
|---|---|---|---|---|
| 1 | **General** | `general` | `#generalSettingsDetails` | Interface language · Startup (`#startupGroup`) · Integrations · App Updates · Tokscale (`#tokscaleGroup`) · Advanced · About |
| 2 | **Main** (i18n key `settings.sections.main`) | `main` | `#mainSettingsDetails` | View list + currency (single subgroup; Home/Trends/Projects/Status sub-accordions are generated inside `#viewDisplayList`) |
| 3 | **Window** | `window` | `#windowSettingsDetails` | Window (behavior + shortcut) · Floating & Tray |
| 4 | **Appearance** | `appearance` | `#appearanceSettingsDetails` | Glass/appearance controls · Interface Theme (presets, theme code, Advanced customization `#themeAdvancedDetails`, Vendor Colors `#themeVendorDetails`) |
| 5 | **Collection** (label `settings.sections.collection`) | `tools` | `#toolsSettingsDetails` | Tools list · Collection frequency · Session history · WSL (`#wslScanRow`) · Data export · Custom model pricing |
| 6 | **AI Tool Limits** | `limits` | `#limitsSettingsDetails` | (no subgroups — 3 flat controls) |
| 7 | **Accounts** | `accounts` | `#accountsSettingsDetails` | Hub accounts (`#hubAccountGroup`) |
| 8 | **Multi-device Sync** | `sync` | `#syncSettingsDetails` | Hub mode radios + `#hubClientFields` |

### Input ids per section

**1. General** — `#languageInput`, `#startAtLoginInput`, `#startInTrayInput`, `#discordRpcInput`,
`#automaticAppUpdatesInput`, `#appUpdateCheckButton`, `#appUpdateViewReleaseButton`,
`#appUpdateReleaseNotesButton`, `#checkTokscaleButton`, `#downloadTokscaleButton`,
`#resetTokscaleButton`, `#openTokscaleLinkButton`, `#openConfigButton`,
`#openRepositoryButton`, `#reportIssueButton`.
Static status nodes: `#generalSettingsSummary`, `#startupNote`, `#automaticAppUpdatesNote`,
`#appUpdateInstalled`, `#appUpdateLatest`, `#appUpdateNotes`/`#appUpdateNotesTitle`/`#appUpdateNotesBody`,
`#appUpdateMessage`, `#tokscaleInstalled`, `#tokscaleBundledLine`, `#tokscaleBundled`,
`#tokscaleNpm`, `#tokscaleMessage`, `#aboutVersion`.

**2. Main** — `#currencyInput`, `#currencyRateModeAuto`, `#currencyRateModeManual`,
`#currencyRateOverrideInput`, `#resetViewDisplayOrderButton`, `#showAllViewsButton`.
Generated inside `#viewDisplayList`: `#homeSettingsList` (Home) with module rows,
`#homeLimitProviderList` (Limits) with a show-bars checkbox, provider-name checkbox and
1–12 account-count number input, `#homeActivitySettingsContainer` (`input[name="homeHeatmapMetric"]`,
`input[name="homeActiveDaysWindow"]`), `#trendSettingsList` (`#trendIntervalSelect` and a
history checkbox), `#projectSettingsList` (projects checkbox),
`#serviceProvidersContainer` → `#serviceProviderList` (`#serviceStatusRefreshSelect`).
Static status nodes: `#mainSettingsSummary`, `#currencyRateStatus`, `#currencyRateRow`,
`#currencyRateManualField`.

**3. Window** — `#windowBehaviorInput`, `#windowToggleShortcutValue`,
`#windowToggleShortcutClearButton`, `#floatingBubbleInput`, `#closeToTrayInput`,
`#floatingBubbleTriggerInput`, `#floatingBubbleContentInput`, `#showTrayIconInput`,
`#trayContentInput`, `#showTrayProviderBadgeInput`, `#trayModeInput`.
Generated containers: `#floatingBubbleComposer`, `#trayComposer`.
Conditionally hidden wrappers: `#floatingBubbleOptions` (hidden unless
`floatingBubbleEnabled === true`), `#trayIconOptions` (hidden unless `showTrayIcon`),
`#trayOptions` (hidden unless tray icon **and** tray mode).
Status nodes: `#windowSettingsSummary`, `#windowToggleShortcutNote`.

**4. Appearance** — `input[name="systemGlassOption"]` (×2, values `system`/`off`),
`#macosGlassInput`, `#liveDotInput`, `#toolIconsInput`, `#titleIconInput`,
`#showCompactTotalTokensInput`, `#swapSettingsRefreshInput`, `#glassInput`,
`#resetGlassButton`, `#blurInput`, `#resetDepthButton`, `#zoomInput`, `#resetZoomButton`,
`input[name="reduceMotionOption"]` (×3), `#themeCodeInput`, `#copyThemeCodeButton`,
`#applyThemeCodeButton`, `#resetThemeColorsButton`, `#resetVendorColorsButton`.
Generated containers: `#themePresetChips`, `#themeColorGrid`, `#vendorColorList`.
Status nodes: `#appearanceSettingsSummary`, `#windowGlassEffectLabel`, `#macosGlassRow`,
`#macosGlassNote`, `#titleIconRow`, `#glassSliderLabel`, `#depthSliderLabel`,
`#zoomSliderLabel`, `#themeCodeStatus`.

**5. Collection** — `#resetClientDisplayOrderButton`, `#showAllClientsButton`,
`#collectionCadenceInput`, `#sessionUsageArchiveInput`, `#clearSessionUsageArchiveButton`,
`#wslScanInput`, `#exportAutoInput`, `#exportPickDirButton`, `#exportIntervalInput`,
`#exportNowButton`, `#customPricingSettingsToggle`, `#customPricingAddButton`,
`#customPricingModelSelect`, `#customPricingModelInput`, `#customPricingCacheRead`,
`#customPricingInput`, `#customPricingOutput`, `#customPricingSaveButton`,
`#customPricingCancelButton`.
Generated containers: `#clientDisplayList`, `#wslPanel`, `#customPricingList`.
Status nodes: `#toolsSettingsSummary`, `#collectionCadenceNote`,
`#sessionUsageArchiveStatus`, `#exportAutoStatus`, `#exportAutoDetails`, `#exportDirLabel`,
`#customPricingStatus`, `#customPricingHint`, `#customPricingError`,
`#customPricing*Approx`, `#customPricingForm`.

**6. AI Tool Limits** — `#showLimitSourceInput`, `#maskLimitAccountEmailsInput`,
`#showLimitUsedInput`. Status node `#limitsSettingsSummary`.

**7. Accounts** (all inside `#hubAccountsSettingsDetails`, i.e. collapsed by default) —
`#hubAccountsSettingsToggle`, `#hubAccountProvider`, `#hubAccountName`, `#hubAccountLabel`,
`#hubAccountCredential`, `#hubAccountAddButton`, `#hubAccountsRefreshButton`.
Generated `#hubAccountsList`. Status `#hubAccountsStatus`, `#hubAccountError`.

**8. Multi-device Sync** — `input[name="hubMode"]` (×2), `#hubUrlInput`, `#secretInput`,
`#secretPasteButton`, `#allowInsecureHubHttpInput`, `#syncUploadIntervalInput`,
`#saveSettingsButton`. Status `#syncSettingsSummary`, `#syncClientStatus`,
`#syncHealthStatus`.

### Rendered but conditionally hidden

| Element | Condition | Source |
|---|---|---|
| `#wslScanRow` (with `#wslScanInput`, `#wslPanel`) | visible only when `appInfo.platform === 'win32'` | `app.js` L6968–6972 |
| `#macosGlassRow` (+ `#macosGlassNote`) | visible only on macOS **and** `systemGlass !== false` | `macosGlass.js` L22; `app.js` L5197, L5200 |
| `#titleIconRow` (+ `#titleIconInput` disabled) | hidden/forced on Windows | `app.js` L5237–5238 |
| `#hubClientFields` (URL, secret, insecure-HTTP, upload interval, save) | visible only when `hubMode === 'client'` | `app.js` L5904 |
| `#floatingBubbleOptions` | visible only when `floatingBubbleEnabled` | `app.js` L6056 |
| `#floatingBubbleComposer` | visible only when `floatingBubbleContent === 'custom'` | `syncTrayComposerVisibility()` L8916–8918 |
| `#trayIconOptions` | visible only when `showTrayIcon` | `app.js` L6063 |
| `#trayComposer` | visible only when `trayContent === 'custom'` | L8916–8918 |
| `#trayOptions` | visible only when tray icon **and** tray mode | `app.js` L6064 |
| `#currencyRateRow`, `#currencyRateManualField` | row hidden for USD; manual field hidden in Auto mode | `app.js` L730–755 |
| `#tokscaleGroup` | hidden when `tokscaleStatus.supported === false` | `app.js` L1064–1070 |
| `#tokscaleBundledLine` | hidden unless a downloaded CLI **and** a bundled CLI both exist | `app.js` L1075 |
| `#downloadTokscaleButton`, `#resetTokscaleButton`, `#appUpdateViewReleaseButton`, `#appUpdateNotes` | hidden/shown according to status payloads | `app.js` L946–968, L1088–1089 |
| `#automaticAppUpdatesRow` | `is-disabled` class when updates unavailable | `app.js` L1002 |
| `#homeLimitProviderNames` (generated) | disabled + forced on when `showToolIcons === false` | `app.js` L6517–6520 |
| `#sessionUsageArchiveInput` note / `#clearSessionUsageArchiveButton` | status text varies with archive state | `renderSessionUsageArchiveStatus()` |
| `#startAtLoginInput` | disabled when `appInfo.loginItemSupported` is false | `app.js` L6063 |
| Windows-only absent control: `windowsBackdrop` selector | **removed from markup entirely** | `windowsGlass.js` L30–32 |

---

## 3. Gaps between `defaultSettings()` and the UI

### 3.1 In `defaultSettings()` but with **no UI control** (JSON/env only)

| key | How you would change it today |
|---|---|
| `alwaysOnTop` | derived from `windowBehavior`; a raw JSON edit is overwritten by `normalizeWindowBehaviorSettings()` on the next save |
| `refreshMs` | only `TOKEN_MONITOR_WIDGET_REFRESH_MS` / raw JSON (min 5000) |
| `windowsBackdrop` | raw JSON or `src/electron/windowsBackdropMode.js` constants; the Windows backdrop selector was deliberately removed |
| `watchEnabled` | raw JSON / `TOKEN_MONITOR_WATCH`; at runtime it is re-derived from `collectionMode` |
| `watchDebounceMs` | raw JSON / `TOKEN_MONITOR_WATCH_DEBOUNCE_MS` |
| `allTimeSince` | raw JSON / `TOKEN_MONITOR_ALL_TIME_SINCE`; the UI points users at `settings.json` (index.html L109) |
| `deviceId` | raw JSON / `TOKEN_MONITOR_DEVICE_ID`; `#deviceIdInput` is referenced in `app.js` but does not exist in `index.html` |
| `windowBounds`, `floatingBubbleBounds` | behaviour (drag/resize) only |
| `lastViewState` | behaviour (choosing period/view) only |
| `migratedDefaultClients`, `lastPostedDeviceId`, `archivedClientUsage` | internal persistence |
| `appUpdate` | written by the update checker / dismiss button; no editable field |
| `limitsEnabled` | legacy gate; read by the renderer, no editor (docs call it "legacy compatibility") |
| `limitProviders` | legacy; `TOKEN_MONITOR_LIMIT_PROVIDERS` / raw JSON; renderer reads only |
| `limitProviderOrder` | raw JSON; the Home-level ordering (`homeLimitProviderOrder`) *is* editable, but the base order is not |

Env-only variants of the same list: `TOKEN_MONITOR_ALWAYS_ON_TOP` (seed for `windowBehavior`),
`TOKEN_MONITOR_HISTORY_INTERVAL_MS` (seed for `historyIntervalMs`, which *does* have a control),
`TOKEN_MONITOR_WSL_SCAN` (seed for `wslScanEnabled`, control exists but Windows-only).

### 3.2 Written by the UI but **absent from `defaultSettings()`**

| key | written by | note |
|---|---|---|
| `settingsInTitlebar` | `#swapSettingsRefreshInput` → `appearancePatchFromControls()` (app.js L5869) → `saveSettings({...patch, discordRpcEnabled})` (L5896) | read back at app.js L5244–5245 and L6047. Undeclared key — survives only because `settings:update` spreads arbitrary patches (main.js L3872–3874) |
| `dashboardFlat` | trends dashboard theme toggle (`dashboard.js` L750), read at L667 | separate dashboard window only; new key in `settings.json` |

Related: `#appUpdatePillDismiss` and `appUpdate:dismiss` mutate `settings.appUpdate.dismissedVersion`, a nested field that exists in defaults but is not a user-editable setting.

---

## 4. Settings-related IPC

### 4.1 `preload.js` surface (`window.tokenMonitor`)

| bridge method | channel | direction |
|---|---|---|
| `getSettings()` | `settings:get` | invoke |
| `updateSettings(patch)` | `settings:update` | invoke |
| `previewAppearance(patch)` | `appearance:preview` | invoke |
| `setViewState(patch)` | `window:viewState` | send |
| `onSettingsPush(cb)` | `settings:push` | receive |
| `onOpenSettings(cb)` | `settings:open` | receive |
| `onOpenView(cb)` | `view:open` | receive |
| `onStatsPush(cb)` | `stats:push` | receive |
| `onTokscalePush(cb)` | `tokscale:push` | receive |
| `onAppUpdatePush(cb)` | `appUpdate:push` | receive |
| `onFloatingBubbleState(cb)` | `floatingBubble:state` | receive |
| `clearSessionUsageArchive()` | `sessionUsageArchive:clear` | invoke |
| `pickExportDir()` | `export:pickAutoDir` | invoke |
| `exportNow()` | `export:now` | invoke |
| `getAppUpdateState()` / `checkAppUpdateNow()` / `downloadAppUpdate()` / `installAppUpdate()` | `appUpdate:getState` / `:checkNow` / `:download` / `:install` | invoke |
| `dismissAppUpdate(version)` | `appUpdate:dismiss` | invoke (writes `settings.appUpdate.dismissedVersion`) |
| `getTokscaleStatus()` / `checkTokscaleNpm()` / `downloadTokscaleFromNpm()` / `resetTokscaleToBundled()` | `tokscale:getStatus` / `:checkNpm` / `:downloadFromNpm` / `:resetToBundled` | invoke |
| `getAppInfo()` | `app:getInfo` | invoke (returns `platform`, `loginItemSupported`, `loginItemOpenAtLogin`, `userData`, …) |
| `openUserData()` | `app:openUserData` | invoke (backs the Advanced → Open Config button) |
| `hubAccounts.*` | `hubAccounts:list` / `:add` / `:update` / `:remove` / `:refresh` | invoke (Hub-side accounts, not settings.json) |
| `getStats` / `getCustomRangeStats` / `getSessionDetail` / `getStreamStatus` / `recoverNow` / `getSyncHealth` / `getServiceStatus` | `stats:get`, `stats:getCustomRange`, `session:getDetail`, `stream:status`, `sync:recover`, `sync:health`, `serviceStatus:get` | invoke (read paths that *consume* settings) |
| `expandFloatingBubble` / `peekFloatingBubble` / `collapseFloatingBubbleIfIdle` / `setFloatingBubbleCollapsedSize` / `moveFloatingBubble` | `floatingBubble:*` | invoke (persist `floatingBubbleBounds`) |
| `setTrayIcons(icons)` | `tray:setIcons` | invoke |
| `signalContentReady()` | `window:contentReady` | send |
| `minimize()` / `close()` | `window:minimize` / `window:close` | send |
| dashboard:* | `dashboard:open` / `:getHistory` / `:ready` / `:minimize` / `:close`, `dashboard:historyChanged` | mixed |

### 4.2 What the settings channels actually do (main process)

| Channel | Handler | Behaviour |
|---|---|---|
| `settings:get` | main.js L3800 | returns `settingsForRenderer()` |
| `settings:update` | main.js L3822–4021 | the single write path; see below |
| `appearance:preview` | main.js L4022–4028 | applies a *transient* native material + zoom preview without persisting; used while the Appearance sliders are dragged (`applyAppearanceFromControls()`, app.js L5889–5894) |
| `window:viewState` | main.js L4029–4031 → `updateRendererViewState()` L639–652 | merges `{period, breakdown}` into `lastViewState` **and persists** (calls `saveSettings()`); note the renderer reaches it via `send`, so it is fire-and-forget |
| `settings:push` | main.js L2410–2425 | `settingsForRenderer()` broadcast to **both** the widget and the trends dashboard after every mutation |
| `settings:open` | main.js L2529 | tray/menu command to reveal the panel |
| `sessionUsageArchive:clear` | main.js L3801–3814 | clears the session archive + daily history; refuses while an external agent owns collection; then `startMode()` + `settings:push` |
| `appUpdate:dismiss` | main.js L4420 → L3291–3299 | writes `settings.appUpdate.dismissedVersion`, `saveSettings()`, pushes state |
| `pricing:lookup` | main.js L3815–3821 | read-only model-price lookup for the custom-pricing form |
| `export:now` / `export:pickAutoDir` | main.js L4325–4343 | folder dialog; `export:now` writes immediately, `pickAutoDir` returns the path that the renderer then stores as `exportDir` |

**`settings:update` pipeline (main.js L3822–4021), in order:**

1. Snapshot previous values for change detection (L3823–3843).
2. `stripLegacyLocalLimitSettings(patch)` (L3845) — silently drops all 24 legacy credential keys.
3. **Hard deletes from the patch regardless of input**: `customModelPricing` is deleted (L3846) and re-normalized from `settings` later (L3940–3942); `hubAdminSecret` (L3849), `hubHostPort`, `hubHostSecret`, `hubHostAdminSecret`, `hubAccountCredentialKey` (L3861–3864) are always dropped.
4. Normalizers per key (L3847–3939): `clients`, `hubUrl`, `allowInsecureHubHttp`, `collectionMode`, `collectionIntervalMs`, `syncUploadIntervalMs`, `watchEnabled`, `watchDebounceMs`, `heatmapMetric`, `homeActiveDaysWindow`, `limitProviders`, `limitProviderOrder`, `clientDisplayOrder`, `hiddenClients`, `pinnedClients`, `viewDisplayOrder`, `hiddenViews`, `homeModuleOrder`, `hiddenHomeModules`, `homeLimitProviderOrder`, `hiddenHomeLimitProviders`, `homeLimitAccountCount`, `historyIntervalMs`, `serviceStatusRefreshMs`, `trayContent`, `trayCustomLayout`, `floatingBubbleContent`, `floatingBubbleCustomLayout`, `windowToggleShortcut`, `currency`, `currencyRates`, `language`, `zoomFactor`, `startAtLogin` (forced `false` when the platform has no login item, L3938).
5. **Transport guard**: switching to `client` with a non-empty URL runs `requireSafeHubTransport()` unless `allowInsecureHubHttp === true` (L3858–3860) — this is the only patch that can reject the whole call before persisting.
6. `normalizeWindowBehaviorSettings()` folds `windowBehavior`↔`alwaysOnTop` (L3872).
7. `saveSettings({throwOnError:true})` with rollback to the previous in-memory object on failure (L3947–3952).
8. Side effects: pricing regeneration (L3953–3956), shortcut re-registration (L3957), login item (L3958–3963), update check (L3964–3966), zoom (L3967), Discord RPC start/stop (L3968–3973), window settings, floating-bubble availability, native-material rebuild on Windows (L3974–3990), collector restart classification (L3991–3996), tray create/destroy (L3997–4000), tray-mode enter/exit (L4001–4004), tray redraw (L4004–4012), currency rate refresh (L4013–4018), then `pushSettingsToRenderer()`.
9. Returns `settingsForRenderer()`.

**Renderer write path**: every control funnels through `saveSettings(patch)` (app.js L7380–7401), which calls `updateSettings`, replaces `state.settings` with the returned redacted snapshot, reapplies rates, re-syncs the whole form, restarts the poll timer, and refreshes tray icons.

**Read path**: `init()` → `getSettings()` (app.js L7444) → `onSettingsPush` subscriber (app.js L35–39 preload) → `syncSettingsForm()` (L5984–6090). The trends dashboard has its own `getSettings()` (dashboard.js L661) and an independent settings push.

---

## 5. Deprecated / legacy settings keys and migrations

### 5.1 `LEGACY_LOCAL_LIMIT_SETTING_KEYS` (main.js L274–299, 24 keys)

`claudeWebCookie`, `opencodeCookie`, `opencodeProfiles`, `openrouterProfiles`, `deepseekApiKey`,
`minimaxApiKey`, `copilotApiToken`, `copilotEnterpriseHost`, `zaiApiKey`, `zaiTeamApiKey`,
`zaiTeamOrganizationId`, `zaiTeamProjectId`, `volcengineAccessKeyId`, `volcengineSecretAccessKey`,
`volcengineRegion`, `qoderCookie`, `qoderSite`, `qoderCookieMode`, `cursorManualAccountConfigured`,
`kimiApiKey`, `kimiWebAccessToken`, `ollamaCookie`, `codexManagedAccounts`, `mimoManagedAccounts`.

- **What they were**: device-local developer-tool credentials the widget used to probe quotas itself.
- **Replaced by**: Hub-owned accounts (`/api/accounts`, the Accounts section, `hubAccounts:*` IPC). The Hub encrypts credentials at rest and publishes normalized quotas; devices no longer hold provider credentials (docs/configuration.md L28–51).
- **How they are removed**: `stripLegacyLocalLimitSettings()` (L301–305) runs on every `readSettings()` (`sanitizeSavedSettings()` L962–972 rewrites `settings.json`), on every `settings:update` patch (L3845), and on `settingsForRenderer()` (L2387). This is a deliberate, unrecoverable invalidation — `docs/configuration.md` L44–47 states there is no automatic secret migration.

### 5.2 Credential-store migrations (`src/shared/credentialStore.js`)

| Constant | Version | Keys/paths | Replaced by | Where run |
|---|---|---|---|---|
| `CREDENTIAL_SETTING_PATHS` L11–13 | — | `secret` → `credentials.hub.clientSecret` | — (current design) | `migrateLegacySettings()` L296–313 (moves `settings.json`'s `secret` into the credential store) |
| `REMOVED_HUB_CREDENTIAL_SETTING_KEYS` L15–17 | `REMOVED_HUB_CREDENTIALS_MIGRATION_VERSION` L7 | `hubAdminSecret` (settings.json) | single `secret` (single-key mode) | `clearRemovedHubCredentials()` L341–354, called from `loadCredentialSettings()` main.js L928 |
| `REMOVED_HUB_CREDENTIAL_PATHS` L46–52 | same | `hub.hostSecret`, `hub.adminSecret`, `hub.accountCredentialKey`, `hub.ingestCredentials`, `hub.remoteAdminSecret` | single `hub.clientSecret`; `TOKEN_MONITOR_HUB_CREDENTIAL_KEY` remains an optional legacy *Hub-side* override only | same |
| `LEGACY_LOCAL_LIMIT_CREDENTIAL_PATHS` L19–44 | `LEGACY_LOCAL_LIMIT_CREDENTIALS_MIGRATION_VERSION` L6 | 21 paths: `providers.claude.webCookie`, `providers.opencode.cookie`, `providers.opencode.profiles`, `providers.openrouter.profiles`, `providers.deepseek.apiKey`, `providers.minimax.apiKey`, `providers.copilot.apiToken`, `providers.zai.apiKey`, `providers.zaiTeam.apiKey`, `providers.zaiTeam.organizationId`, `providers.zaiTeam.projectId`, `providers.volcengine.accessKeyId`, `providers.volcengine.secretAccessKey`, `providers.qoder.cookie`, `providers.commandcode.cookie`, `providers.kimi.apiKey`, `providers.kimi.webAccessToken`, `providers.ollama.cookie`, `providers.thirdparty.profiles`, `providers.mimo.accounts`, `providers.qoder.autoCache` | Hub accounts | `clearLegacyLocalLimitCredentials()` L326–339, called from `loadCredentialSettings()` main.js L929; `invalidateLegacyLocalLimitData()` L974–981 also deletes the on-disk `userData/mimo-credentials` and `userData/managed-codex-homes` directories (L948–960) |

Guarantees in the store (`AGENTS.md` contracts, implemented L105–116, L156–192, L215–257):
the store is version-checked (`CREDENTIALS_VERSION = 1`), must be a regular non-symlink file, is written
atomically at `0600`, and unknown/corrupt documents are never replaced with an empty one.
`persistSettingsAndCredentials()` writes credentials first, then `settings.json`, and rolls both back on failure.

### 5.3 Other legacy settings migrations

| Legacy item | Migrated at | Replaced by |
|---|---|---|
| `hubMode: 'host'` (embedded Hub) | main.js L1011 | `'local'` — the embedded Hub is out of product scope |
| absent `hubMode` + non-empty `hubUrl` | main.js L1008–1010 | inferred `'client'` |
| `hubHostPort`, `hubHostSecret`, `hubHostAdminSecret`, `hubAccountCredentialKey`, `hubAdminSecret` | main.js L1012–1015, L1098 | deleted outright |
| `edgeDrawerEnabled` | main.js L1100–1102, L3946 | `floatingBubbleEnabled` |
| `alwaysOnTop` (as the source of truth) | main.js L1088–1090 | `windowBehavior` (`'floating'`/`'normal'`); kept as a derived field |
| `settingsInTitlebar` | app.js L5869, L5244 | **not migrated** — an undeclared key (see §3.2) |
| `dashboardFlat` | dashboard.js L667, L750 | **not migrated** — undeclared key |
| `archivedClientUsage` | `ensureClientUsageArchiveLoaded()` main.js L1227–1243 | merged into the shared `clientUsageArchive` file (union of legacy + shared, legacy wins on conflict) |
| `lastPostedDeviceId` | `ensureDeviceIdentityLoaded()` main.js L1251–1264 | the shared `deviceIdentity` file |
| `migratedDefaultClients` | `ensureSettingsLoaded()` main.js L613–619 + `applyNewDefaultClientMigration()` | one-time marker enabling newly added default clients on existing installs (skipped when `TOKEN_MONITOR_CLIENTS` is explicitly set) |
| `appUpdate.lastKnownLatest` pointing at the old upstream repo | main.js L630–632 | reset to `null` |
| `windowsBackdrop` | — | **not removed**, but no longer selects the surface: Windows picks Mica by OS build; `windowsGlass.js` L30–32 hard-codes `showBackdropControl: false` |

`TOKEN_MONITOR_LIMITS_ENABLED` and `TOKEN_MONITOR_LIMIT_PROVIDERS` are documented as
"legacy compatibility" in `.env.example` L109, L113 and `docs/configuration.md` L79–80 — they still seed
`limitsEnabled` / `limitProviders`, which survive in `defaultSettings()` but have no editor.

---

## 6. Caveats the rewrite must know

1. **`settingsForRenderer()` ships every non-credential setting to the renderer** (main.js L2391–2392). Only `secret` is redacted-but-exposed; every other credential is absent by construction. A rewrite that widens this must add an explicit allowlist.
2. **Undeclared keys round-trip.** `settings:update` spreads arbitrary patch keys (L3872–3874), so `settingsInTitlebar` and `dashboardFlat` persist without appearing in `defaultSettings()`. A rewrite with a strict schema will silently break both.
3. **`docs/configuration.md` is already stale** relative to the code: it lists a **Main** section as "which Home modules appear", omits the **Accounts** section entirely from its 7-row table (L16–24), and describes `TOKEN_MONITOR_LIMITS_ENABLED`/`_LIMIT_PROVIDERS` behaviour that no longer probes devices. Do not treat it as authoritative for the rewrite.
4. **Section noun mismatch**: the markup calls section 5 `tools` (`data-settings-section="tools"`) while its visible label is "Collection" (`settings.sections.collection`); section 2 is `main` with label from `settings.sections.main`. Any persisted "which section was open" state should key off the `data-settings-section` value.
5. **Two settings are shared with the headless agent** but stored separately: `TOKEN_MONITOR_*` env values seed the widget only on first run; the agent reads CLI→env→default itself (`src/agent/agent.js` L33–59). There is no shared JSON config file.
