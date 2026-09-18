# 桌面端重构计划（DESKTOP_REWRITE_PLAN）

目标：把当前的「悬浮小组件」式 Electron 桌面端**一次性重写**为一个**正常桌面应用**，界面与仓库内的**中枢网页端（Hub Web / PWA）同源共享**，后端采集逻辑保持不变，并保证老用户在 `userData/` 下的既有配置无损迁移。

- 审计基线：`5cbbcd2` / `0.45.0-rev.40`
- 对比上游：`Javis603/token-monitor`（本仓库为其 fork，已从上游独立演进；上游 `src/electron/main.js` 8,668 行，重构前本仓库 4,480 行，重构后 3,813 行）
- 证据文件：
  - `docs/desktop-rewrite/01-desktop-settings-inventory.md`（当前桌面端全部 85 个设置项、UI 结构、IPC、遗留项）
  - `docs/desktop-rewrite/02-hub-web-inventory.md`（中枢网页端全部视图、状态、样式、API、资源、复用评估）

## 实施状态（已完成 / 已验证）

实施基线：`5cbbcd2` → `0.46.0`。`npm run verify` 全绿（product-scope + shared-ui 边界 + CSS 变量 + lint + 1970 项测试 / 0 失败）。

| 计划阶段 | 状态 | 落地位置 |
|---|---|---|
| 阶段 1 共享 UI 包 + Transport 抽象 | ✅ | `src/shared-ui/`；`app.js` 从 `src/hub/web/js/` 平移；`transport/{index,httpTransport}.js`；图标合并为单一权威树 |
| 阶段 2 桌面端 IPC Transport | ✅ | `transport/ipcTransport.js`、`src/electron/desktopRequestRouter.js`、`preload.js`、`renderer/boot.js` |
| 阶段 3 桌面端保留设置移植 | ✅ | `src/shared-ui/views/settingsDesktop.js`（全部 68 个保留 key 均有控件；2 个 legacy key 按计划废弃） |
| 阶段 4 正常应用化 | ✅ | 有边框窗口 + 最小尺寸 900×600、`src/electron/appMenu.js`、CSP `style-src` 放宽、移除 `LSUIElement` |
| 阶段 5 切换入口 + 删除旧层 | ✅ | 删除旧渲染层、悬浮气泡、托盘、窗口行为模式、macOS Widget 扩展；`main.js` 4,652 → 3,813 行 |
| 阶段 6 无损迁移 + 文档 | ✅ | `src/electron/viewState.js`（9→8 视图映射）、widget key 清理、`tests/electron/settingsMigration.test.js`、AGENTS/README×5/configuration 更新 |
| 附加：CI/打包清理 | ✅ | 移除 7 个 widget CI 步骤、6 个 npm 脚本、widget 打包分支与 provisioning 步骤 |

**唯一未执行项**：`src/shared-ui/app.js`（4,115 行）的**按视图模块化拆分**。它是纯粹的内部重组、无行为变化，而当前单文件形态已通过全部测试与两端启动验证。考虑到它是本计划中风险收益比最低的一项（不改变任何外部契约），且拆分本身不影响交付能力，故保留现状并在后续增量进行。计划中其余所有条目（含 `data.js`/`format.js`/`i18n.js`/`syncHealth`/`viewContext` 的模块化）均已完成。

---

## 一、结论摘要（先说决策）

| 维度 | 现状 | 目标 |
|---|---|---|
| 窗口形态 | 无边框、透明、置顶悬浮、可折叠为小气泡、可退化为托盘弹层；macOS `LSUIElement: true`（Dock 不显示） | 正常有边框应用窗口：可最小化/最大化/关闭、任务栏/Dock 常驻、有菜单栏与设置中心 |
| 界面代码 | `src/electron/renderer/`：`app.js` 9,506 行 + `styles.css` 5,584 行 + `index.html` 700 行，与中枢**完全不同**的一套 UI | 与中枢**同一套代码**（抽取共享 UI 包），永久同源 |
| 视图结构 | 9 个桌面视图（home/tool/status/device/model/project/session/limits/trends）+ 底部视图切换器 | 8 个中枢视图（overview/usage/devices/limits/trends/accounts/management/settings）+ 侧边栏路由 |
| 设置项 | 8 个折叠分区、85 个 key，其中 15 个是小组件专属（`windowBounds` 属正常应用的窗口几何，**保留**） | 共享设置页 + 桌面端专属设置分组；小组件专属项按废弃处理 |
| 采集逻辑 | `src/shared/collector.js` 等 | **不改**（仅保留必要接线） |
| 配置兼容 | `settings.json` + `credentials.json` | **无损迁移**，沿用现有 key 与文件结构 |

**用户已确认的四项决策**

1. UI 架构：**抽取共享 UI 包，两端同一套代码**（非各自重写）。
2. 小组件能力：**先不保留**——托盘图标/托盘内容、悬浮气泡、置顶与桌面钉住、macOS 原生 Widget 扩展、独立趋势仪表盘窗口，全部不做。
3. 迁移策略：**一次性替换**（旧渲染层在新端落地后删除）。
4. 配置兼容：**必须无损迁移**，老配置继续生效。

---

## 二、目标架构

```
┌─────────────────────────── src/shared-ui/  （新增，两端唯一 UI 来源）───────────────────────────┐
│  views/      8 个视图渲染器（overview/usage/devices/limits/trends/accounts/management/settings）│
│  core/       state 形状、路由、请求时序、表单草稿与焦点保持、i18n、格式化、图标注册表           │
│  styles/     app.css（含主题变量契约）                                                          │
│  icons/      客户端图标（单一权威资产树）                                                       │
│  transport/  Transport 接口定义（唯一的环境差异点）                                             │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                      ▲                                             ▲
        HTTP/SSE 适配器 │                                             │ IPC 适配器
                      │                                             │
        ┌─────────────┴──────────────┐              ┌───────────────┴────────────────┐
        │ 中枢 Web（PWA）             │              │ 桌面端 Electron 渲染层          │
        │ src/hub/web/ 仅剩入口+boot  │              │ src/electron/renderer/ 仅剩入口 │
        │ window.location 路由        │              │ hash 路由 + 原生对话框          │
        └────────────────────────────┘              └────────────────────────────────┘
                                                                  │ preload (contextBridge)
                                                                  ▼
                                                    ┌──────────────────────────────┐
                                                    │ 主进程 src/electron/main.js   │
                                                    │ 采集 / Hub 客户端 / 窗口 / 更新│
                                                    └──────────────────────────────┘
```

### 2.1 为什么用「共享 UI 包 + Transport 适配器」

中枢网页端已经从 Hub 拉取数据，桌面端则从主进程 IPC 取数据，但**两者消费的是同一个数据结构**：主进程 local 模式下 `aggregateDevices()` 的输出（`src/shared/usage.js:1459`）与 Hub `/api/stats` 的 `computeStats()` 输出（`src/hub/server.js:465`）字段几乎一一对应（`devices[]`、`periods{}`、`historyPreview`、`historyRevision`、`limits`、`capabilities`）。差别只在：

- **取数方式**：`fetch('/api/stats')` + SSE ↔ `ipcRenderer.invoke('stats:get')` + `stats:push`。
- **认证**：Bearer secret ↔ 已存在 `credentials.json`。
- **少数环境能力**：浏览器 `window.open`/`clipboard`/`confirm` ↔ `shell.openExternal`/IPC/原生对话框。
- **路由与持久化**：`localStorage` + `pushState` ↔ `settings.json` + hash 路由。

把这四点收敛成一个 `Transport` 接口，其余 95% 的 UI 代码（视图渲染、图表、数据变换、i18n、CSS）就是**同一份文件**，两端不会再漂移。

### 2.2 Transport 接口（新增 `src/shared-ui/transport/index.js`）

以中枢网页端 `js/api.js` 现有能力为基准定义接口，两端各实现一次：

```js
// 接口（文档用途，实际用 JSDoc typedef）
{
  // 数据读取
  getStats({ force, forceHistory })         // → stats 对象（两端同形）
  getCustomRangeStats(range)                // → 归一化区间聚合；不支持时抛 capability 错误
  getHistory()                              // → 完整 history（含 per-client/per-model 栈）
  getSessionDetail({ client, sessionId })   // → 会话明细
  getHealth() / getCapabilities()           // → 能力与权限握手
  getRates()                                // → 汇率表（失败不阻塞启动）

  // 资源管理（Hub 权威）
  listAccounts() / addAccount() / updateAccount() / removeAccount() / refreshAccount()
  // 订阅与定价
  getSubscriptions() / putSubscriptions(doc, baseUpdatedAt)
  getPricing() / putPricing(model, prices) / fetchUpstream(model|all)

  // 实时流
  openStatsStream({ onStats, onStatus })    // → disposer；桌面端由 stats:push 驱动

  // 环境能力（差异点显式化，而不是散落 if 分支）
  capabilities: { nativeDialogs, externalOpen, clipboard, hashRouting, updater, localCollector }

  // 桌面专属（中枢实现返回 unsupported）
  desktop: {
    getSettings() / updateSettings(patch)
    getAppInfo() / checkAppUpdate() / installAppUpdate()
    exportNow() / pickExportDir()
    clearSessionUsageArchive()
  }

  // 偏好持久化（中枢=localStorage，桌面=settings.json）
  loadPrefs() / savePrefs(patch)
}
```

**关键约束**：视图层**不得**直接引用 `fetch`、`localStorage`、`window.tokenMonitor`、`window.open`、`navigator.clipboard`、`confirm`。全部经由 `transport`。这条必须由守卫测试强制执行（见 §6.3）。

---

## 三、现状盘点与差异边界

### 3.1 当前桌面端设置项：保留 / 迁移 / 废弃

以 `docs/desktop-rewrite/01-desktop-settings-inventory.md` 的 85 个 key 为准，逐项处置。**判断依据**：中枢网页端**已经移除**的功能视为废弃（不回流）；中枢网页端**新增**的功能按中枢为准；其余桌面端独有的设备本地设置**必须保留**。

#### A. 采集与设备本地（**必须保留**，桌面端专属设置分组）

| 设置 key | 现状 UI | 处置 |
|---|---|---|
| `clients`（跟踪工具） | 采集 → 工具列表（勾选/隐藏/置顶/拖拽排序） | **保留**，新设置页「采集」分组。这是最核心的迁移项 |
| `projectsEnabled` | 主界面 → Projects 子项 | **保留** |
| `historyEnabled` / `historyIntervalMs` | 主界面 → Trends 子项 | **保留** |
| `sessionUsageArchiveEnabled` | 采集 → 会话历史 + 清除按钮 | **保留**（含 `sessionUsageArchive:clear` IPC） |
| `collectionMode` + `collectionIntervalMs` | 采集 → 采集频率（单下拉编码两个 key） | **保留**，但拆成两个控件（见 §3.3 陷阱） |
| `watchEnabled` / `watchDebounceMs` | 无 UI（由 `collectionMode` 派生） | **保留为后端旋钮**，不进 UI（现状即如此） |
| `wslScanEnabled` | 采集 → WSL（仅 Windows 显示） | **保留**，`win32` 条件显示 |
| `allTimeSince` | 无 UI（原始 JSON） | **保留**，新设置页给出可编辑项（比现状更好） |
| `customModelPricing` | 采集 → 自定义模型定价 | **保留**，注意它被 `settings:update` 特判（§3.3 陷阱） |
| `exportAutoEnabled` / `exportDir` / `exportIntervalMs` | 采集 → 数据导出 | **保留**（含 `export:now` / `export:pickAutoDir`） |
| `refreshMs` | 无 UI | **保留为后端旋钮** |
| `deviceId` | 无 UI（`#deviceIdInput` 在 HTML 中根本不存在，是死代码） | **保留**，在新设置页给出可编辑项 |
| `archivedClientUsage` / `migratedDefaultClients` / `lastPostedDeviceId` / `windowBounds` / `lastViewState` / `appUpdate` | 纯内部持久化 | **保留**（保持 key 名与语义） |

#### B. 界面与外观（**大部分保留**，去掉小组件相关）

| 设置 key | 处置 |
|---|---|
| `language` | **保留**（迁移到共享 UI，两端同一语言列表） |
| `currency` / `currencyRates` | **保留**（中枢网页端也有 currency，语义一致） |
| `themeColors` / `vendorColors` | **保留**。中枢目前只有 light/dark/system 三态，桌面端的完整主题编辑器更强，**作为桌面增强而非冲突**（见 §3.4） |
| `reduceMotion` / `showLiveDot` / `showToolIcons` / `titleIconOnly` / `showCompactTotalTokens` | **保留**。这些控制的是共享视图的呈现，属于桌面端合法差异 |
| `heatmapMetric` / `homeActiveDaysWindow` | **保留**（中枢 `prefs` 里已有同名项，正好统一） |
| `glassOpacity` / `glassBlur` / `systemGlass` / `macosGlassStyle` / `windowsBackdrop` | **保留**。正常应用仍可有用原生材质/毛玻璃的窗口背景；但语义要从「小组件透明悬浮」改为「窗口背景材质」。`windowsBackdrop` 目前无 UI（Windows 由 OS build 决定 Mica），保持无 UI |
| `zoomFactor` | **保留** |
| `lastViewState` | **保留**，但结构需扩展为共享 UI 的路由状态（见 §3.3） |

#### C. 视图偏好（**保留**，但需重新映射）

| 设置 key | 现状 | 处置 |
|---|---|---|
| `viewDisplayOrder` / `hiddenViews` | 9 个桌面视图（home/tool/status/device/model/project/session/limits/trends） | **保留但重映射**到 8 个中枢视图。映射：home→overview，tool/model/project/session→usage（子标签），status→limits(health 标签)，device→devices，limits→limits，trends→trends。**老值必须能解析**，未知项忽略而非清空 |
| `homeModuleOrder` / `hiddenHomeModules` | Home 模块顺序/显隐 | **保留**。中枢 overview 是固定布局，需要把模块顺序能力移植进共享 overview 渲染器 |
| `clientDisplayOrder` / `hiddenClients` / `pinnedClients` | 工具列表排序/隐藏/置顶 | **保留**（`usage` 视图的 tools 标签需要这套偏好） |
| `homeLimitProviderOrder` / `hiddenHomeLimitProviders` / `homeLimitAccountCount` / `showHomeLimitBars` / `showHomeLimitProviderNames` | Home 限额卡片 | **保留**；中枢 `prefs.homeLimitAccountCount` 已存在，正好合并 |
| `limitProviderOrder` | 无 UI（Home 排序的基础序） | **保留为后端数据** |
| `serviceProviderDisplayOrder` / `hiddenServiceProviders` / `serviceStatusRefreshMs` | 主界面 → Status 子项（服务状态页） | **保留**。中枢网页端**没有**服务状态视图（`grep` 无命中），这是桌面端独有能力，必须搬进共享 UI 的 `limits` 视图 health 标签 |
| `showLimitSource` / `maskLimitAccountEmails` / `showLimitUsed` | AI Tool Limits 分区 | **保留**（中枢 limits 视图也消费同一 `stats.limits`） |
| `limitsEnabled` | 无 UI（仅渲染层门控） | **废弃**。`.env.example:109` 与 `docs/configuration.md:79` 均标注为 "legacy compatibility; device quota probing is removed"——配额已由 Hub 权威提供，设备端不再需要开关。迁移时删除；共享 UI 直接渲染 `stats.limits.providers` |
| `limitProviders` | 无 UI（渲染层只读，另有 `homeLimitProviderOrder` 可编辑） | **废弃**。`.env.example:113` 同为 legacy（"Hub accounts select providers"）。设备端不再选择 provider；但 **`limitProviderOrder` 要保留**，因为它是 Home 限额卡片排序的基础序 |

#### D. Hub 连接（**保留**，与中枢对齐）

| 设置 key | 处置 |
|---|---|
| `hubMode`（`local` / `client`） | **保留**。产品边界硬约束：`product-scope.json` 规定只有这两个模式，且 `verify:product-scope` 强制 `main.js` 含 `const HUB_MODE_VALUES = new Set(['local', 'client'])`、只允许 2 个 radio。**不得引入第三种模式** |
| `hubUrl` / `secret` / `allowInsecureHubHttp` | **保留**（`secret` 继续只存 `credentials.json`） |
| `syncUploadIntervalMs` | **保留** |
| Hub Accounts（`hubAccounts:*` IPC） | **保留**。中枢网页端有完整的 accounts 视图（含 OAuth 向导），桌面端目前是简化表单。**共享后自动获得中枢的完整能力**（§3.5） |

#### E. 通用（**保留**）

| 设置 key | 处置 |
|---|---|
| `startAtLogin` | **保留**（正常应用仍需要） |
| `startInTray` | **废弃**（托盘不保留）→ 迁移时删除并忽略 |
| `automaticAppUpdates` + `appUpdate` | **保留**（正常应用应有自动更新） |
| `discordRpcEnabled` | **保留**（与窗口形态无关） |

#### F. 小组件专属（**废弃**，按 §3.2 清理）

`windowBehavior` / `alwaysOnTop` / `floatingBubbleEnabled` / `floatingBubbleTrigger` / `floatingBubbleContent` / `floatingBubbleCustomLayout` / `floatingBubbleBounds` / `showTrayIcon` / `trayMode` / `closeToTray` / `trayContent` / `trayCustomLayout` / `showTrayProviderBadge` / `windowToggleShortcut`。

#### G. 上游已移除、不要加回（**已确认废弃**）

这些在上游存在、本 fork 已删除，**不要**在新桌面端复活：
`edgeDock*`（上游新增的边缘停靠，与小组件同类）、`liveTokenRate*` / `tokenRateMode`、`modelAliases` / `modelAliasGrouping` / `modelRankingMetric`、`interfaceFontFamily` / `displayFontFamily`、`compactTokenUnits`、`periodMonthMode`、`customScanPaths`、`limitsRefreshMode` / `limitsRefreshMs`、`keepAboveTaskbar`、`hideAppIcon`、`windowMaximized`、`claudePrepaidBalanceEnabled`、`codexResetForecastEnabled`、`showCodexAdditionalLimits`、`opencodeAmbientEnabled` / `opencodeLocalLimitsEnabled`、`subscriptions*`（已迁到 Hub）、以及全部 24 个 `LEGACY_LOCAL_LIMIT_SETTING_KEYS` 本地凭据（已被 Hub 账号取代）。

> 注意：`src/electron/renderer/app.js:620` 仍读 `settings.limitsRefreshMs`、`src/electron/main.js:1796` 仍读 `settings.compactTokenUnits`——重写时这两处死引用一并删除。

### 3.2 小组件能力的拆除清单

| 文件/模块 | 行数 | 处置 |
|---|---|---|
| `src/electron/floatingBubble.js` | 9.4 KB | 删除 |
| `src/electron/tray.js` | 7.2 KB | 删除（或只保留最小 `app.quit` 路径） |
| `src/shared/trayLayout.js` | 1,021 | 删除（`trayComposer` 与气泡共用） |
| `src/shared/trayText.js` | 391 | 删除 |
| `src/shared/compactTokens.js` / `compactMoney.js` | 2.2 KB + 2.2 KB | 删除（仅被 `trayText`/`trayLayout` 引用，随托盘链一起变成死代码） |
| `src/electron/renderer/trayComposer.js` | 1,207 | 删除 |
| `src/electron/renderer/trayBars.js` / `trayProviderIcons.js` | 218 | 删除 |
| `src/electron/trayModeSettings.js` | 1.7 KB | 删除 |
| `src/electron/windowBehavior.js` | 2.4 KB | 精简为固定行为（或删除） |
| `src/electron/windowShortcut.js` | 5.8 KB | 删除 |
| `src/electron/macosSpaceBehavior.js` | 2.4 KB | 删除（保留空间行为是悬浮需求） |
| `src/electron/macosGlassMode.js` / `macosGlassNative.js` | 9 KB | **保留**（窗口背景材质仍需要） |
| `src/electron/windowsBackdrop.js` / `windowsBackdropMode.js` | 6.8 KB | **保留**（同上） |
| `src/electron/macWidget*.js` + `src/shared/macWidget*.js` + `native/macos/TokenMonitorWidget*` | 较大 | **删除**（含 `scripts/build-macos-widget.js`、`scripts/macos-packaging.js` 中的 widget 分支、`package.json` 中 **7 个** widget 脚本、`.github/workflows/ci.yml` 的 **7 个** Widget 步骤）。注意 `release.yml:185` 已设 `TOKEN_MONITOR_WIDGET_ENABLED: '0'` |
| `src/shared/macSystemRequirements.js` | 1.4 KB | **部分保留**：`MAC_APP_MIN_VERSION` / `MAC_APP_MIN_DARWIN_VERSION` 被 `scripts/merge-mac-updater-metadata.js` 与 `tests/shared/releaseArtifactNames.test.js` 用于**应用自身**的更新元数据，不能整体删除；只删 `macWidgetRuntimeSupport` 及 `MAC_WIDGET_*` 相关导出 |
| `src/electron/discordRpc.js` | 5.2 KB | **保留** |
| `src/electron/renderer/dashboard.*` | 1,018 | 删除（独立趋势窗口不做；趋势能力由共享 `trends` 视图提供） |
| `src/electron/serviceStatus.js` | 6.6 KB | **保留**（搬进共享 UI） |
| `src/electron/linuxAutostart.js` / `linuxDisplay.js` / `updateInstallQuit.js` | — | **保留** |
| `package.json` → `mac.extendInfo.LSUIElement: true` | — | **删除**（正常应用要在 Dock/任务栏出现） |
| `src/electron/main.js` → `applyMacActivationPolicy()` | L1286–1301 | 删除（`accessory` 策略是托盘/悬浮专用） |
| `main.js` → `shouldCreateTray` / `enterTrayMode` / `hidePopover` / `expandFloatingBubble` 等 | 大量 | 删除 |

**验证方式**：删除后 `npm run verify:product-scope` 与全量测试必须通过；`main.js` 应显著缩小（当前 4,480 行 → 目标约 2,200–2,600 行）。

### 3.3 必须避开的陷阱（来自本次审计）

这些是重写时**最容易踩**的具体坑，逐条给出处置：

1. **`settings:update` 会丢弃 `customModelPricing`**
   `main.js:3846` 无条件 `delete normalizedPatch.customModelPricing`，随后在 L3940 从 `settings` 重新归一化。若新 UI 通过通用 patch 写自定义定价，会**静默不生效**。→ 新实现要么移除该特判，要么给自定义定价单独的 IPC 通道。必须有回归测试。

2. **`settings:update` 会展开任意 patch key**
   `main.js:3872–3874` 直接 spread，导致 `settingsInTitlebar` 与 `dashboardFlat` 两个**未声明**的 key 一直能持久化。→ 若新实现引入严格 schema，这两个 key 会静默失效。处置：显式声明或显式迁移，并在测试中固定行为。

3. **`#collectionCadenceInput` 一个控件写两个 key**
   `app.js:7639` 同时写 `collectionMode` 与 `collectionIntervalMs`（`live`/`smart`/`300000`/`900000`/`1800000`）。→ 新设置页拆成「采集模式」+「采集间隔」两个控件，但**必须保持两个 key 的值域与既有归一化函数一致**（`normalizeSharedCollectionMode` / `normalizeSharedCollectionIntervalMs`）。

4. **结构变更触发语义必须保留**
   `src/electron/runtimeConfig.js` 定义了 MODE_STRUCTURAL（→ 整个 `startMode()`）、USAGE_STRUCTURAL（→ 采集器重启）、SINK_STRUCTURAL（→ 上传调度）。新设置页的任何改动都要经过同一套 `classifySettingsChange()`，否则会出现「改了采集间隔但采集器没重启」。

5. **`secret` 不在 `settings.json`**
   它在 `userData/credentials.json` 的 `credentials.hub.clientSecret`（`CREDENTIAL_SETTING_PATHS`）。`settings.json` 始终经 `stripCredentialSettings()` 写出。→ 新实现**不得**把 secret 写进 settings.json；仅 `secret` 允许 `expose:['secret']` 给渲染层。

6. **`settingsForRenderer()` 目前把全部非凭据设置都发给渲染层**
   `main.js:2391–2392`。当前「脱敏」靠的是凭据文件隔离，不是白名单。→ 重写时改为**显式白名单**，共享 UI 只声明它真正需要的 key。

7. **CSP 与内联样式**
   主进程注入 `style-src 'self'`（`main.js:216`），而共享 UI 大量使用内联 `style="..."`（中枢允许 `'unsafe-inline'`，`static.js:11`）。→ Electron 侧的 CSP 必须放宽 `style-src` 至 `'self' 'unsafe-inline'`（只放宽 style，**不放宽 script**），或者把共享 UI 的内联样式改为 CSS 变量赋值。推荐后者更安全，但前者工作量小；本计划采用**先放宽 style-src 并加注释**，并把「消除内联样式」列为后续优化项。

8. **路由不能用 `pushState`**
   中枢用 `history.pushState` + `static.js` 的 SPA fallback（无扩展名路径回落到 `index.html`）。Electron 走 `file://`，**没有**这个 fallback。→ 桌面端用 **hash 路由**（`#/usage?tab=models`）；共享 UI 的路由层需抽象 `pushRoute`/`readRoute`。

9. **`window.open` / `confirm` / `prompt` / `navigator.clipboard`**
   共享 UI 中用于 OAuth 打开授权链接、删除确认、重命名、复制密钥。→ 全部走 `transport.capabilities` 分支。

10. **图标 id 漂移**
    三套图标树并存：`src/hub/web/icons/clients/`（42 个 SVG）、`assets/icons/`（45 个）、`src/electron/renderer/icons/`（22 个，仅 UI chrome）。已用脚本核实的两处缺陷：① `thirdparty` **不在** `clientsWithIcon`（`renderer/app.js:13-16`）中，`renderLimitProviderMark()`（`app.js:2418-2427`）因此回退为 `dot`，使 `styles.css:2991` 的 `.limit-icon-thirdparty`（指向 `newapi.svg`）**不可达**——第三方限额卡片丢图标；它是 `LIMIT_PROVIDER_IDS`（20 个）中唯一缺失的 id。② 该 Set 有 44 个元素但只有 43 个唯一值，`'qwen'` 重复。注意 `claude-desktop` **在** Set 中，其 `styles.css:2858` 规则可达（早前"同理失效"的说法有误，已更正）。→ 共享 UI 收敛为**单一图标树 + 单一别名表**，别名从 `src/shared/clientTracking.js` 派生；另需处理无引用资产（`hunyuan` 在 `src/`、`tests/`、`docs/`、README 中零引用，属死文件）。

11. **i18n 双表几乎不相交**
    中枢 337 key（`MESSAGES` 281 + `PAGE_MESSAGES` 56）× 5 语言；桌面端 1,047 key × 5 语言；**交集仅 7 个 key**（已用脚本核实）。→ 共享 UI 采用中枢的 key 命名与 `t()` 实现，把桌面端独有的 1,040 条文案按前缀命名空间（如 `desktop.settings.*`）并入同一张表。这是本次重构中**工作量最大**的一项。

12. **`grok`/`xai` 图标是故意交叉的**
    `tests/electron/rendererClientLabels.test.js:47-53` 锁定该行为。→ 不要以「文件名等于 id」为目标做清理。

13. **`docs/configuration.md` 已过时**
    它漏掉了 Accounts 分区，并描述了已移除的设备端配额探测。→ 计划内包含文档重写任务。

### 3.4 两端设置差异的呈现方式（直接回答「差异怎么做」）

共享设置页按三层组织，在同一份代码里用 `transport.capabilities` 声明式区分：

| 层 | 内容 | 中枢 | 桌面 |
|---|---|---|---|
| **L1 共享偏好** | 语言、主题（light/dark/system）、货币、Home 限额账户数、周期/视图偏好、限额显示（source/mask/used） | ✅ | ✅ |
| **L2 Hub 权威资源** | Accounts（含 OAuth 向导）、Subscriptions、Pricing | ✅ | ✅（本地模式下显示「未连接 Hub」） |
| **L3 设备本地** | 采集（工具列表/频率/会话归档/WSL）、导出、自定义定价、窗口与外观、启动与更新、Discord、Hub 连接（local/client） | ❌ 由中枢明示「请在桌面端配置」 | ✅ |

L3 的实现就是当前中枢 `settings` 页已有的 `desktopOnly` 边界区块（`app.js:1892`，`i18n.js:1457`）——**该文案已经精确列出了这批设置**（"Window, tray, startup, collector cadence, tracked clients, WSL scanning, exports, and local session archives"）。共享 UI 只需把该占位区块在桌面端替换为真实控件即可，边界定义无需重新发明。

**主题能力的差异**：中枢是 light/dark/system 三态（`app.css` 无 `prefers-color-scheme` 媒体查询，靠 `html[data-theme]`）；桌面端有完整 `themeColors`/`vendorColors` 编辑器。处置：共享 UI 保留三态作为基础，桌面端在 L3 追加「界面主题（高级）」分组复用现有编辑器。**不要**把桌面主题编辑器塞进中枢。

### 3.5 共享后桌面端自动获得的能力（顺带收益）

- **Accounts 视图的完整能力**：中枢支持 OAuth 向导（codex / antigravity）、17 种 provider 的凭据表单、启用/禁用/编辑/删除。当前桌面端只有「provider + name + label + credential JSON」的简化表单。共享后桌面端直接获得完整实现。
- **Subscriptions 与 Pricing 管理**：桌面端目前**完全没有**（`renderer/app.js` 仅有一处 `Subscription:` 文案）。共享后纳入 `management` 视图。
- **设备管理**：重命名/删除设备（中枢需 admin scope）。
- **趋势视图**：桌面端当前是独立窗口（`dashboard.html`），共享后成为主窗口内的 `trends` 视图，能力更强（stacked bars + heatmap + 多指标）。

---

## 四、分阶段实施计划

> 已选「一次性替换」，因此**不设长期双轨**；但下面的阶段划分是**开发顺序**，每阶段独立可验证（`npm run verify` 必须绿），最后一步才切换入口并删除旧渲染层。

### 阶段 0：前置与基线（0.5 天）

1. 建立任务清单与验收标准（本文件）。
2. 跑一次基线：`npm run verify`，记录结果与耗时。
3. 在 `tests/` 下新增守卫骨架：共享 UI 边界守卫（见 §6.3），初始为 skip，随阶段推进逐步启用。
4. 证据报告已归档在 `docs/desktop-rewrite/`（01 桌面端设置清单、02 中枢网页端清单），随本次重构一并提交。

**验收**：`npm run verify` 绿；守卫骨架存在。

### 阶段 1：抽取共享 UI 包（不改行为，最大风险段）

**做法**：把 `src/hub/web/` 平移为 `src/shared-ui/`，**先让中枢网页端在新位置上跑通**，此时桌面端完全不动。这样任何回归都能立刻定位到「抽取」而非「新功能」。

1. 新建目录结构：
   ```
   src/shared-ui/
     index.html          共享 shell（去掉 PWA/auth-gate 块，改为挂载点）
     views/              从 app.js 拆出 8 个视图渲染器
     core/
       state.js          state 形状 + prefs 默认值
       router.js         路由（pushRoute/readRoute，两端各注入实现）
       request.js        请求时序、AbortController、单飞、409 冲突
       drafts.js         表单草稿 + 焦点/滚动保持
       i18n.js           翻译表 + t()/resolveLocale/applyI18n
       format.js         数字/货币/相对时间（原样搬）
       data.js           纯变换（原样搬，**provably pure**）
       icons.js          UI_ICON_PATHS 内联 SVG 注册表
     transport/
       index.js          接口定义 + 能力矩阵
     styles/app.css      原样搬 + 清理（见下）
     icons/clients/      单一权威客户端图标树
     locales/            单张 i18n 表（中枢 337 + 桌面 ~1040，命名空间隔离）
   ```
2. **`app.js` 拆分**：它是 3,989 行单模块。按视图切分为 `views/*.js`，共享 `core/state.js` 的 state、`core/i18n.js` 的 `tr`、`core/dom.js` 的 `escapeHtml`/`els`。这是纯机械重构，**必须逐视图提交**，每步跑中枢网页端的手工冒烟（8 个视图 × 5 语言）。
3. **CSS 清理**（来自 `docs/desktop-rewrite/02-hub-web-inventory.md` §5）：
   - 删除 `.pwa-banner`、`.auth-gate` 区块。
   - 删除 ≤860px 的底部导航/抽屉规则（桌面窗口最小宽度 900px，`WINDOW_LIMITS` 现有 `minWidth: 240` 需提高）。
   - 修复硬编码颜色：`styles` 中 29 个 hex / 31 个 rgba 中的非 token 部分；`app.css:1392-1395` 的 `.badge.warn` 用字面量覆盖了 538 行的 `var(--warn)`（**明确缺陷**）。
   - 把 `--font`/`--display` 显式固定为跨平台栈（当前有效栈在 1592 行被覆盖为 macOS 优先）。
   - 补 `--scrim` token（当前 955/1024/1051 三处互不一致的遮罩）。
4. **Transport 抽取**：把 `js/api.js` 泛化为 `transport/httpTransport.js`（base URL + secret provider 注入）；`js/api.js` 的 localStorage 部分改为注入的 `prefsStore`。
5. `src/hub/web/` 变为薄壳：`index.html` + boot 脚本，import `../../shared-ui/`，实例化 `httpTransport` 与 `localStoragePrefsStore`，注册 service worker 与 PWA 逻辑（这些留在 hub 侧，不进共享包）。

**验收**：中枢网页端功能与视觉**完全不变**（逐视图手工核对 + 现有 `tests/hub/webDataHelpers.test.js` 等全绿）；`npm run verify` 绿。

**风险与缓解**：这是全计划最大的一次性改动。缓解：视图逐个迁移并提交；`data.js`/`format.js`/`i18n.js` 是纯模块可原样搬（有测试背书）；禁止在阶段 1 改任何业务逻辑。

### 阶段 2：桌面端 Transport（新增，不改 UI）

1. 新增 `src/electron/transport/ipcTransport.js`，实现 §2.2 接口：
   - `getStats` → 现有 `stats:get`；`getCustomRangeStats` → `stats:getCustomRange`；`getHistory` → `dashboard:getHistory`（改名 `history:get`）。
   - `openStatsStream` → 订阅 `stats:push`，并调用现有 `stream:status` 得到连接状态；**保留**主进程的 SSE 重连/退避/空闲看门狗（`main.js` 的 `startStatsStream` 一整套逻辑不动）。
   - `desktop.*` → 现有 `settings:get/update`、`app:getInfo`、`export:*`、`appUpdate:*`、`sessionUsageArchive:clear`、`serviceStatus:get`。
   - `accounts/subscriptions/pricing` → 主进程转发到 Hub（`requestHubAccount` 已有；新增 `subscriptions`/`pricing` 转发）。
2. 扩展 `preload.js`：补齐 subscriptions/pricing/history 通道；保持 `contextIsolation: true`、`nodeIntegration: false`。
3. 新增 `src/electron/transport/desktopPrefsStore.js`：把共享 UI 的 `prefs` 映射到 `settings.json` 的既有 key（**不新建 key**，除非该 prefs 项中枢独有，此时放 L1 的命名空间下）。

**验收**：可写一个临时调试页（或 Node 测试）驱动 `ipcTransport`，断言 local 与 client 两种模式下返回的 stats 形状与中枢 `/api/stats` 一致。

### 阶段 3：旧渲染层能力移植（保留项落地）

按 §3.1 的「保留」清单，把桌面独有的东西接进共享 UI。**逐项提交**：

1. **桌面设置分组（L3）**：采集（工具列表/频率/会话归档/WSL/导出/自定义定价）、窗口与外观、启动与更新、Discord、Hub 连接、设备 ID、`allTimeSince`。复用现有规范化函数（`normalize*`）与 IPC，**不重写后端逻辑**。
2. **服务状态视图**：把 `serviceStatus.js` 的能力接入共享 `limits` 视图的 health 标签（含 `serviceStatusRefreshMs` 与 provider 显示偏好）。中枢端点此标签隐藏（`capabilities.nativeDialogs`/专用 flag）。
3. **主题编辑器**：`themePresets.js` + `vendorColors` 编辑器移入共享 UI，仅在桌面端渲染（能力位 `capabilities.themeEditor`）。
4. **Home 模块顺序/显隐**：把 `homeModuleOrder`/`hiddenHomeModules` 接入共享 `overview` 渲染器。
5. **视图偏好重映射**：实现 §3.1-C 的 9→8 映射，含老值解析与未知值忽略。
6. **自定义区间**：共享 UI 已有 `custom range` popover + `/api/usage/range`；桌面端 local 模式走 `stats:getCustomRange`。保留两端能力位判断。

**验收**：`docs/desktop-rewrite/01-desktop-settings-inventory.md` 中每个标「保留」的 key，在新 UI 中都有可达入口且有回归测试（§6.2 的表驱动测试）。

### 阶段 4：正常应用化（窗口与外壳）

1. **窗口**：`createWindow()` 改为正常窗口：
   - `frame: true`（或 `titleBarStyle: 'hiddenInset'` 保留自绘标题栏但保留红绿灯 —— 取决于是否要保留毛玻璃标题栏；**建议 macOS 用 `hiddenInset`，Windows/Linux 用原生 frame**）。
   - 删除 `transparent`、`resizable: false`、`skipTaskbar` 逻辑。
   - `WINDOW_LIMITS` 提高为 `{ minWidth: 900, minHeight: 600, maxWidth: 2560, maxHeight: 1600 }`（与共享 UI 的 860px 断点对齐并留余量）。
   - 默认尺寸从 `DEFAULT_WINDOW` 调为 `{ width: 1180, height: 760 }`。
2. **菜单**：新增应用菜单（macOS 需要标准 App/Edit/View/Window/Help），含「设置」跳转、缩放、关于、检查更新。
3. **生命周期**：关闭 = 退出（不再 hide 到托盘）；`app.on('window-all-closed')` → `app.quit()`；删除 `macActivationPolicy` 的 accessory 分支。
4. **打包**：删除 `mac.extendInfo.LSUIElement`；`package.json` 中 `build.files` 加入 `src/shared-ui/**/*`；新增 `assets/icons` 与共享图标树的一致性守卫。
5. **CSP**：放宽 `style-src` 至 `'self' 'unsafe-inline'`（§3.3-7），并加注释说明原因与后续优化方向。

**验收**：三平台手测——正常启动、Dock/任务栏出现、最小化/最大化/关闭、多显示器、缩放（Ctrl/Cmd +/-）、深色模式跟随。

### 阶段 5：切换入口 + 删除旧渲染层（一次性替换）

1. `main.js` 改为加载 `src/shared-ui/index.html`（经自定义协议或 `file://` + hash 路由）。
2. **一次性删除**：`src/electron/renderer/app.js`(9,506) / `styles.css`(5,584) / `index.html`(700) / `dashboard.*`，以及 §3.2 表中所有小组件模块、macOS Widget 全套（含 `native/macos/`、`scripts/build-macos-widget.js`、`scripts/macos-packaging.js` 的 widget 分支、`package.json` 的 7 个 widget 脚本、`ci.yml` 的 7 个 widget 步骤）。
3. 删除 `src/electron/renderer/` 中已无引用的偏好模块（`viewDisplayPreferences.js` 等若已迁入共享 UI）。
4. 更新 `product-scope.json` 守卫：`scripts/verify-product-scope.js` 中所有针对旧 `renderer/index.html` 的断言（如 `name="hubMode"` 计数、`value="host"` 检查）需同步改写为针对共享 UI 的设置页。

**验收**：`npm run verify` 绿；全量手工回归（§6.1）；打包产物在三平台可安装启动。

### 阶段 6：配置无损迁移与文档

1. **迁移实现**（`readSettings()` 内，一次性、幂等）：
   - 删除废弃 key：§3.1-F 全部 + `startInTray` + `edgeDrawerEnabled` + `settingsInTitlebar` + `dashboardFlat`。
   - 视图偏好重映射：`hiddenViews`/`viewDisplayOrder` 的 9→8 解析（未知值忽略，不写空）。
   - `lastViewState` 从 `{period, breakdown}` 扩展为含路由的形态，保留旧字段可读。
   - **凭据不动**：`credentials.json` 结构完全不变（`hub.clientSecret`），迁移前后 `secret` 必须仍可用。必须有测试断言「迁移后旧 secret 仍能连接 Hub」。
   - 归档文件不动：`clientUsageArchive`、`deviceIdentity`、`sessionUsageArchive`、`dailyHistoryArchive` 保持现有路径与格式。
2. **文档**：
   - 重写 `docs/configuration.md`（当前已过时：漏 Accounts 分区、描述已移除的设备端探测）。
   - 更新 `AGENTS.md`：架构图（三进程 → 共享 UI 包）、`src/shared-ui/` 的定位与「视图层不得直接调用 fetch/localStorage/IPC」约束、删除小组件/macWidget 相关描述。
   - 更新 README（5 语言）的产品描述：从「desktop widget」改为正常桌面应用；**注意** `tests/docs/readmeConsistency.test.js` 会校验各语言表格与计数，必须同步。
   - 删除或改写 `docs/` 中与 widget 打包相关的段落（`RELEASING.md` 的 widget 流程）。
3. **版本**：本次为破坏性 UI 重构，`package.json` 升到 `0.46.0`（去掉 `-rev.N`，进入正常 SemVer 主线；`npm run verify:release-version` 校验格式）。

**验收**：从 `0.45.0-rev.40` 的 `userData` 目录直接启动新版，所有保留设置与 Hub 连接、账号、订阅、定价、历史归档均可用。

---

## 五、文件级影响清单

| 路径 | 动作 | 说明 |
|---|---|---|
| `src/shared-ui/**` | **新增** | 唯一 UI 来源 |
| `src/hub/web/**` | **精简** | 仅留 shell + boot + PWA/service worker |
| `src/electron/renderer/**` | **删除/替换** | 仅留薄入口 |
| `src/electron/main.js` | **大幅精简** | 4,480 → 约 2,200–2,600 行 |
| `src/electron/preload.js` | 扩展 | 补齐 subscriptions/pricing/history |
| `src/electron/transport/**` | 新增 | IPC 适配器 + prefs store |
| `src/electron/{floatingBubble,tray,trayModeSettings,windowBehavior,windowShortcut,macosSpaceBehavior,macWidget*}.js` | 删除 | 小组件能力 |
| `src/shared/{trayLayout,trayText,compactTokens,compactMoney,macWidget*}.js` | 删除 | 小组件/Widget 共享模块（`macSystemRequirements` 只删 widget 导出，见 §3.2） |
| `native/macos/**` | 删除 | 原生 Widget 扩展 |
| `src/electron/{serviceStatus,discordRpc,linuxAutostart,updateInstallQuit,windowsBackdrop*,macosGlass*}.js` | 保留 | 正常应用仍需要 |
| `src/shared/collector.js`、`usage.js`、`limits*.js`、`deviceRuntime*.js`、`history.js` 等 | **不动** | 后端采集逻辑保持一致 |
| `src/hub/server.js`、`repository.js`、`accountService.js` 等 | **不动**（除新增 subscriptions/pricing 的桌面转发无需改 Hub） | Hub 已具备全部端点 |
| `scripts/verify-product-scope.js` | 改写断言 | 指向共享 UI 的设置页 |
| `scripts/{build-macos-widget,macos-packaging,verify-macos-widget-app,macos-widget-config}.js` | 删除/精简 | Widget 移除 |
| `package.json` | 改 `build.files`、删 widget 脚本、删 `LSUIElement`、升版本 | — |
| `.github/workflows/ci.yml` / `release.yml` | 删除 Widget 步骤 | CI 需要新增共享 UI 守卫 |

---

## 六、验证与回归策略

### 6.1 手工回归清单（阶段 5 后必须全过）

- local 模式：采集启动、数据刷新、8 个视图全部有数据、自定义区间、会话明细、导出、清空会话归档。
- client 模式：连接 Hub、SSE 实时更新、断线重连与退避提示、上传间隔、不安全 HTTP 开关拒绝/放行。
- Hub 权威资源：Accounts 增删改查 + OAuth（codex/antigravity）、Subscriptions（含 409 冲突横幅）、Pricing 编辑与上游刷新。
- 设备管理：重命名/删除（admin scope）。
- 三平台窗口：启动、Dock/任务栏、最小化/最大化/关闭、多显示器、缩放、深色模式。
- 5 种语言全视图切换。
- 老配置升级：直接用 rev.40 的 userData 启动。

### 6.2 自动化测试

**保留并复用**（这些测的是后端与共享逻辑，不受 UI 重写影响）：
`tests/shared/**`（145 个文件）、`tests/hub/**`（11 个）、`tests/agent/**`、`tests/scripts/**`。

**改写**（当前直接读旧渲染文件的测试，见 §6.4）：
`tests/electron/rendererBindings.test.js` 等 10 个文件引用了 `renderer/app.js`/`index.html`，需改指向 `src/shared-ui/`。

**新增**：
1. **设置覆盖守卫（表驱动）**：断言 §3.1 中每个「保留」的 key 都能在新 UI 中通过某条路径写入且能读回。这是直接回答「确保原先能配的现在还能配」的机器化证据。
2. **Transport 一致性测试**：对同一份 fixture 数据，`httpTransport` 与 `ipcTransport` 返回相同形状（在 Node 中用 mock 注入）。
3. **迁移测试**：构造 rev.40 的 `settings.json` + `credentials.json` fixture，跑迁移后断言：保留项值不变、废弃项被清除、secret 仍可用、视图偏好重映射正确、未知值被忽略。
4. **视图偏好 9→8 映射测试**：全量枚举旧值。

### 6.3 新增守卫（纳入 `npm run verify`）

1. **共享 UI 边界守卫**（`scripts/verify-shared-ui-boundary.js`）：
   - `src/shared-ui/views/**` 与 `src/shared-ui/core/**` 中**禁止**出现 `fetch(`、`localStorage`、`sessionStorage`、`window.tokenMonitor`、`ipcRenderer`、`require('electron')`。
   - 禁止 `pushState`（必须走路由抽象）。
   - 允许出现的例外以显式白名单列出。
2. **图标一致性守卫**（扩展现有）：对 `KNOWN_CLIENTS`（26）∪ `normalizeClientName` 输出 ∪ `LIMIT_PROVIDER_IDS`（20）中的每个 id，断言在**单一权威图标树**中存在文件或存在别名；并断言 `src/hub/web/icons/clients/` 与 `assets/icons/` 不漂移。
3. **设置 schema 守卫**：断言 `defaultSettings()` 的每个 key 都在「保留 / 废弃」清单中被归类，防止新 key 悄悄绕过。
4. **i18n 守卫**：断言 5 种语言 key 集合一致（当前 `ja`/`ko` 各缺 7 个 key，正好一并修复）。

### 6.4 需要改写的既有测试（已定位）

引用旧渲染文件的 10 个测试：`homeLimitBars`、`hubAccountsLayout`、`homeOverview`、`macosGlass`、`viewDisplayPreferences`、`settingsScrollAnchor`、`wslStatusPresentation`、`syncConnection`、`refreshForceHistory`、`glassRendering`。其中 `macosGlass` 若删除 macOS 玻璃则一并删除；其余改指向共享 UI 的对应模块。

---

## 七、风险登记

| 风险 | 等级 | 缓解 |
|---|---|---|
| 阶段 1 抽取共享 UI 时回归中枢网页端 | **高** | 先平移后改造；逐视图提交；纯模块（`data.js`/`format.js`/`i18n.js`）原样搬；禁止在阶段 1 改业务逻辑 |
| i18n 双表合并（337 + 1040，交集仅 7）工作量被低估 | **高** | 命名空间隔离（`desktop.settings.*`）；先机械合并再去重；i18n 守卫保证 5 语言一致 |
| 设置项漏迁导致「以前能配的现在不能配」 | **高** | §6.2-1 的表驱动覆盖守卫 + §3.1 的逐项清单作为验收依据 |
| 一次性替换（大爆炸）导致中间态不可用 | **中** | 阶段 1–4 期间旧渲染层保持可用；仅在阶段 5 切换；切换前完成全部手工回归 |
| 忘记移除 `customModelPricing`/`settingsInTitlebar` 特判导致设置静默失效 | **中** | §3.3-1、§3.3-2 的专门回归测试 |
| CSP `style-src` 冲突导致样式全丢 | **中** | 阶段 4 明确处理并测试；把消除内联样式列为后续优化 |
| 删除 macWidget 后 CI 残留步骤导致流水线红 | **中** | 阶段 5 同步清理 `ci.yml` 7 个步骤 + `release.yml` + 7 个 npm 脚本 + `verify-macos-widget-app.js` |
| 上游依赖漂移（`appUpdater.js` 硬编码 `IGNGserver/token-monitor-suite`） | **低** | 本次不处理；若「从上游独立出来」涉及改仓库地址，需同时改 `appUpdater.js:6`、`main.js:630/3384`、`package.json` 的 publish/homepage、`README` 徽章 |
| 与上游分叉后无法再合并上游修复 | **低** | 共享 UI 抽取反而降低分叉成本（UI 逻辑与上游脱钩，采集层仍可对齐）；建议在 `AGENTS.md` 记录分叉点 |

---

## 八、工作量估算

| 阶段 | 内容 | 估算 |
|---|---|---|
| 0 | 前置与基线 | 0.5 天 |
| 1 | 抽取共享 UI 包（含 `app.js` 拆分、CSS 清理） | 5–8 天 |
| 2 | 桌面端 Transport + preload | 1.5 天 |
| 3 | 旧渲染层保留能力移植（L3 设置、服务状态、主题编辑器、视图映射） | 4–6 天 |
| 4 | 正常应用化（窗口/菜单/生命周期/打包/CSP） | 2 天 |
| 5 | 切换入口 + 删除旧层与 Widget 全套 | 2 天 |
| 6 | 迁移 + 文档 + i18n 合并 | 3–4 天 |
| — | 三平台手工回归 | 2 天 |
| **合计** | | **约 20–26 人日** |

其中 i18n 合并与阶段 1 的 `app.js` 拆分是方差最大的两项。

---

## 九、明确不做的事（范围边界）

1. **不引入前端框架/构建步骤**。共享 UI 保持零依赖原生 ES module + 模板字符串，与中枢现状一致；`AGENTS.md` 要求新增依赖先讨论。
2. **不改后端采集逻辑**（`src/shared/collector.js`、`limits*.js`、`history.js`、`wslUsage.js` 等）。
3. **不改 Hub 服务端**（`src/hub/server.js` 及其 API；`docs/API.md` 兼容面不变）。
4. **不恢复已废弃功能**：边缘停靠、令牌速率、模型别名、字体设置、本地配额探测/本地凭据、订阅缓存等（§3.1-G）。
5. **不引入第三种 Hub 模式**：`product-scope.json` 的 `widgetModes: ['local', 'client']` 是硬约束，`verify:product-scope` 会失败。
6. **不做 Android/iOS 改动**：`android/` 不在本次范围。
7. **不改 `src/agent/`（headless agent）**：与桌面端共用采集层，本次仅确保它继续可用。

---

## 十、推进方式建议

阶段 1 是整个计划的地基且风险最高，建议**先做一次限时技术验证**：只抽取 `data.js`/`format.js`/`i18n.js` 三个纯模块 + `app.css`，让中枢网页端从新路径加载并跑通全部视图。若验证顺利，再投入 `app.js` 的视图拆分。这能在 1 天内证伪最大的架构假设，成本远低于直接全量开工。
