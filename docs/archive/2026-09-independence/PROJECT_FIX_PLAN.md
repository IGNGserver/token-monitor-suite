# 修复计划（PROJECT_FIX_PLAN）

> **Historical Archive / 历史归档说明**
> 
> 本文档是 2026-09 分支独立与桌面端重构过程中的内部审计/计划快照，**不再维护**。
> 文中提及的旧路径（如 `worker/`、`native/macos/`、旧版 `app.js` 等）在当前代码库中已不存在。

---


对应问题清单：`PROJECT_AUDIT_FINDINGS.md`
审计基线：`807cd82` / `0.45.0-rev.38`，2026-09-17

---

## 实施进度（本轮已完成并验证）

所有条目均以 `npm run verify`（product-scope + lint + 全量测试）为准；括号内为新增回归测试。

| 项 | 状态 | 关键证据 / 测试 |
|---|---|---|
| 0.1 `.secrets` 保护 | ✅ | `.gitignore` + `.dockerignore`；`git check-ignore` 现指向 `.gitignore` |
| 0.2 AppImage 更新源（EL-S1） | ✅ | 新增 `verifyLinuxAppImageUpdaterFeed`：拒绝"只有 deb 的 feed"。实测：单次同时构建两目标产出 `path: *.AppImage` + 两个 `files` 条目（`tests/scripts/linuxUpdaterFeed.test.js` 7 项） |
| P0-0 渲染进程启动崩溃（RD-1/RD-4） | ✅ | `els.saveSettingsButton?.` 守卫、恢复 Save 按钮与 `settings.sync.saveConnection` 键（5 语言）、补 `currencyRateModeManual` 映射、`deviceIdInput` 守卫。变异测试证明可捕获原缺陷（`tests/electron/rendererBindings.test.js` 7 项） |
| P0-1 归档全量重算（LD-1/SH-2） | ✅ | `sessionKey` 纯字符串化、已归一化归档短路（WeakSet 标记）、每会话贡献记忆化。真实 450 会话：单次 transform **687→52ms**；8000 会话 1143→**290ms**；原性能用例 1127→215ms（`tests/shared/sessionArchivePerformance.test.js` 4 项） |
| P0-2 双采集器（LD-2） | ✅ | `startSyncCollector()` 在外部 agent 存活时只做中转（新增 `relay` 状态 + 5 语言键）（`tests/electron/singleCollector.test.js` 3 项） |
| P0-3 Hub 统计重算（HB-2/LD-4） | ✅ | 合并式缓存（TTL 可配）+ 全部变更点经 `invalidateStatsCache()` |
| P0-4 limits latch（LD-5） | ✅ | 每个 probe 加 `runWithProbeDeadline`（默认 60s，转发 abort signal）+ 周期 latch 看门狗（`tests/hub/account-service.test.js` 新增 2 项） |
| P0-5 SSE 孤儿（LD-6） | ✅ | 先注册后 await、改用 `res.on('close')`、新增 `ready` 标志防止未写头就发帧、导出 `getSseClientCount()`。变异测试证明可捕获原缺陷（`tests/hub/sseRegistry.test.js` 3 项） |
| HB-4 连接池 | ✅ | `queueLimit` + `connectTimeout`；池耗尽返回 **503 `hub_busy`** |
| HB-5 致命异常 | ✅ | `uncaughtException` 记录后优雅停止并 `exit(1)`（Compose 自愈） |
| HB-11 数值上界 | ✅ | `wireValidation` 增加 token/cost 上下界（`1e300` 现在被拒） |
| HB-17 时间戳 | ✅ | `normalizeDeviceRecord` 经 `firstValidIso` 回退到 `receivedAt`/now |
| HB-18/19 Compose | ✅ | 补 6 个曾被吞掉的变量（`MYSQL_CONNECTION_LIMIT`、`AGY_OAUTH_CLIENT_SECRET`、`TOKEN_MONITOR_HUB_CREDENTIAL_KEY`、`TOKEN_MONITOR_TRUST_PROXY` 等）+ hub healthcheck + 回环绑定告警 |
| HB-12 限流绕过 | ✅ | `cf-connecting-ip`/`x-real-ip` 仅在 `trustProxy` 开启时信任（`tests/hub/sseRegistry.test.js` 新增 2 项：轮换该头无法绕过；受信代理仍按客户端分桶） |
| AN-9 Android 后台耗电 | ✅ | 新增 `ActivityForegroundEffect`（不额外解析 ViewModel，避免开出第二条流），`ON_START/ON_STOP` 驱动 SSE 启停；用户 CA 移入 debug（AN-3 一并完成） |
| RD-2 仪表盘注入 | ✅ | 抽出 `escapeHtml` 并应用到 legend/tooltip/breakdown 三处 |
| RD-3 provider 列表漂移 | ✅ | 渲染端改由 `src/shared/limitProviders.js`（UMD）派生；补 `commandcode`/`thirdparty` 图标与能力标签 |
| RD-5 百分比 | ✅ | `limitPercentValue` 拒绝 `null`/空白哨兵（`null+used40` 现在得 60 而非 0） |
| RD-6 Hub 账户缺 provider | ✅ | 补 `codex`/`antigravity`（17 与共享集一致） |
| RD-7 CSS 未闭合 | ✅ | 补 `}`；全文件括号平衡校验通过 |
| HW-1 网页端注入 | ✅ | 设备行平台标签加 `escapeHtml`；复查其余设备字段均已转义 |
| AN-1 Android 旧范围 | ✅ | 进入 Custom 与加载失败均清空 `customRangeResult`；补 `clientModels`/`clientModelCosts` |
| AN-2 切换 Hub 残留 | ✅ | 新增 `onConnectionChanged()` 重置状态并重拉，保存按钮改接它 |
| AN-3 Android 明文策略 | ✅ | 用户 CA 移入 `debug-overrides`；`docs/API.md` 与实现对齐 |
| AN-4 Android 历史失败 | ✅ | 新增 `historyError` 状态（不再静默降级） |
| AN-11 窗口类型 | ✅ | 补 `named`/`credits` 中文标签 |
| Android 客户端 id 缺口 | ✅ | 补 `commandcode`/`qodercn`/`reasonix` 标签与颜色 |
| SH-1 local 模式 Reasonix | ✅ | 新增 `reattachLocalNativeView` 并在 `startLocalCollector` 调用（`tests/electron/localNativeView.test.js` 4 项） |
| SH-4 上传间隔双归一化 | ✅ | 消费者改为接受生产者的同一区间；实测两者对所有取值一致，15 分钟配置不再被误判 stale |
| LD-3 子进程 | ✅ | `terminateChild`（SIGTERM→5s SIGKILL）+ `abandonChildStreams`；三处 spawn 全部接入（`tests/shared/childTermination.test.js` 3 项） |
| WS-4 启动开销 | ✅ | `@xhayper/discord-rpc` 改为懒加载（默认关闭时不再解析 170 个模块） |
| EL-14 语言包 | ✅ | `afterPack` 只保留 6 个语言包（`tests/scripts/localePruning.test.js` 2 项） |
| WS-2 Docker 死重 | ✅ | `scripts/prune-hub-deps.js` + Dockerfile 接线（`tests/scripts/pruneHubDeps.test.js` 4 项） |
| WS-3 headless 安装 | ✅ | 打包改为生成 scoped `package.json`（`tests/scripts/headlessBundle.test.js` 2 项） |
| WS-5/6/7 Electron 打包 | ✅ | `build.files` 排除 source map/文档头文件/mysql2 及其专属依赖（`tests/scripts/electronPackageScope.test.js` 3 项） |
| WS-11 死模块 | ✅ | 删除零引用 `src/shared/fontSettings.js` |
| WS-12 缺失客户端图标 | ✅ | 补 7 个 hub 图标 + 别名；新增守卫断言所有可请求 id 都有文件（`tests/hub/webDataHelpers.test.js` +2） |
| WS-15 仓库卫生 | ✅ | 删除误建的嵌套 `.git` 仓库与未引用的 macos fixtures |
| SH-3 终态上传永久停报 | ✅ | 非重试且非配置类失败改为**有界慢速重试**（默认 15 分钟）；配置类错误仍不重试。修正了 2 个固化旧行为的既有测试，新增 1 项恢复用例（`tests/electron/syncUploadScheduler.test.js`） |
| SH-5 WSL 瞬时失败固化 | ✅ | 新增 `wslBundleHasUsage`：新扫描无用量而旧快照有时保留旧快照，不再把 WSL 份额清零 |
| SH-6 UTC/本地日窗口 | ✅ | `shouldPreservePeriod` 优先比较设备本地 `periodWindows[period].key`，仅对无 window 的旧生产者回退 UTC |
| HB-6 范围静默截断 | ✅ | `aggregateHistoryRange` 现报告 `coveredFrom/coveredTo/truncated`；请求越过日窗口时用账本补齐未覆盖的头部并标 `source: history_daily+usage_events`（`tests/hub/usage-range.test.js` 新增 3 项） |
| HB-7 history 反封顶 | ✅ | `coerceHistory` 重新套用产品窗口（日档 370 行，保留最新），一个月 1MiB 载荷不再永久拖慢统计 |
| HB-1 `limitsOnly` | ✅ | ingest 恢复该标志并走 `mergeDeviceRecord` 的既有分支；只带 limits 的请求不再清零周期/删会话/污染账本（新增回归用例） |
| HB-14 错误语义 | ✅ | 提交后的统计/广播失败不再回落成 400；存储类错误映射 503 并停止回显内部文本 |
| HB-15 SSE 连接上限 | ✅ | 新增 `maxSseClients`（默认 64）：超限返回 503 `too_many_streams` 且不驱逐已有流（新增用例） |
| HB-9 账本索引 | ✅ | 新增 `migrations/005_usage_events_recorded_index.sql`：`recorded_at` 前导索引 + `(recorded_at, client, model)` 覆盖索引，幂等且带守卫测试 |
| HW-4 网页端汇率 | ✅ | Hub 新增公开 `GET /api/rates`（复用共享抓取器，日缓存，失败回落内置表）；网页端 boot 时拉取并 `configureRates`；`format.js` 不再硬编码汇率（新增 2 项用例） |
| HW-3 网页端标签/颜色 | ✅ | 补齐 `commandcode`/`deepseek-harness`/`qodercn`/`reasonix` 标签与颜色，并新增"所有 tracked client 都有标签/颜色、所有 provider 都有标签"的守卫 |
| HW-5 网页端 SSE 诚实性 | ✅ | 新增连接期限（15s）与空闲看门狗（90s），心跳不再当作新鲜数据，**收到数据帧后**才置 `live`，并记录/展示"数据截至 …"（新增用例） |
| HW-10 自定义范围模型拆分 | ✅ | 网页端从返回的 sessions 派生 `clientModels`/`clientModelCosts`，自定义范围下模型列表不再恒为 "No usage"（新增用例） |
| RD-15 托盘图标空转 | ✅ | `maybeUpdateBarsIcon` 改为按渲染输入指纹门控（含 provider 窗口、顺序、自定义布局），并跳过隐藏托盘；不再每 3–5 秒重新栅格化（新增用例） |
| LD-8 每次推送整条重算 | ✅ | `sendPush` 改为 200ms 尾随合并（只保留最新载荷）；托盘刷新/导出/IPC 广播移入 flush；历史 revision 在整个合并窗口内比较一次；`fetchStats` 与退出前强制 flush，避免读到陈旧快照（新增用例） |
| LD-11 macOS 重复取历史 | ✅ | `processWork` 把 sequence/`hasDemand()` 检查移到 `getHistory()` **之前**（并在 await 后再查一次），不再每次 stats 推送都发一次全量历史请求 |
| LD-12 anchor 非原子写 | ✅ | anchor 改走 `writeJsonAtomic`；`writeJsonAtomic` 临时名改为含 pid + 随机后缀（widget 与 agent 共享数据目录时不再冲突），并对失败做清理 |
| LD-7 缓存无上限 | ✅ | `projectPathCache` / `jsonlTimestampCache` 改为 10000 条上限的 LRU 近似淘汰（Map 插入序），新增 `cacheSetBounded`（新增用例） |
| RD-20/21 可访问性 | ✅ | 折叠面板与手风琴加 `visibility: hidden` 使其离开 Tab 顺序；把 `button:focus { outline:none }` 收窄为 `:not(:focus-visible)`，并为标题栏/标签页/刷新按钮/范围滑块补可见焦点环（新增用例） |
| 测试稳定性 | ✅ | 修掉 `collectorLoadGuards` 中一个负载敏感断言（单独跑 3/3 通过、满负载下因定时器合并出 `coalesced` 而失败）；改为断言前两项顺序 + 其余只能是 `coalesced`，并保留扫描次数断言 |
| AN-8 设备在线判定 | ✅ | 新增 `deviceConnectionLabel` / `deviceCountsAsOnline`：结合 `clientStatus`（全部 missing → "未发现客户端"，有 active → "在线"，仅 waiting → "等待活动"），不再只看 `stale` 而让停报设备在 10 分钟窗口内显示"在线" |

**尚未实施（下一轮）**：LD-9（`usage_events` 保留策略）、LD-10（恢复路径取消已放弃的重扫）、RD-16/17/19/22（拖拽强制布局、展开面板掉队、浅色主题对比度、热区吞点击）、RD-23/24（350 个死 i18n 键、约 14KB 死 CSS）、WS-8/9/13/16/17（3.7GB 可再生磁盘、2.72MB 重复资产、`site/` 死 React 岛、`cleanSecret` 等重复 helper、`.github/assets` 13.3MB 文档媒体）、AN-5/6/7/8/10/12/13/14（货币、限额新鲜度、在线判定、`OkHttpClient` 复用、设备限额、模型拆分估算、30 天 preview 冒充全量）、AN-15/16/17（Android `Test` 任务禁用导致假绿、`versionCode` 碰撞）、HB-8（范围查询重复读设备表）。

---

## 零、执行原则

1. **先止血，再治本。** 阶段 0/1 只做低风险、高收益、可独立发布的改动；架构级重构放在阶段 4。
2. **每步可独立发布、可独立回滚。** 不做"一次性大重构"。
3. **性能修复必须带可量化验收标准**，不接受"感觉快了"。所有关键项在本文档中给出实测基线与目标值。
4. **兼容面（设置键、环境变量、CLI 参数、Hub 端点、`docs/API.md` 线上协议）视为破坏性变更**，修改需同步文档与迁移方案。内部代码可自由重构。
5. **每个阶段结束必须跑 `npm run verify`**（= `verify:product-scope` + `lint` + `test`）。
6. 不新增依赖，除非在 PR 中说明理由（遵循 `AGENTS.md`）。

### 建议的提交划分

每个编号对应一个可独立审查的提交，提交信息遵循 `AGENTS.md` 的 conventional-commit 规范：

```
fix(renderer): guard the stale saveSettingsButton binding that aborts startup
perf(session-archive): make sessionKey a pure string normalizer
fix(collector): skip the sync collector when an external agent is active
fix(hub-limits): bound the refresh cycle with a watchdog
```

---

## 阶段 0 — 立即行动（当天，不涉及代码逻辑）

### 0.1 密封 APT 私钥（对应 WS-1，P1 安全）

**为什么先做**：这是唯一一个"一次误操作就造成不可逆泄露"的问题，且修复耗时 2 分钟。

```bash
# 1) 加入仓库级忽略规则（当前只被本机 .git/info/exclude 保护）
printf '\n# APT signing key backup — never commit\n/.secrets/\n' >> .gitignore

# 2) 不进入 Docker 构建上下文
printf '.secrets\n' >> .dockerignore

# 3) 验证
git check-ignore -v .secrets/          # 应显示 .gitignore（而非 .git/info/exclude）
git status --short                     # .secrets 不应出现
```

**验收**：`git check-ignore -v .secrets/` 输出指向 `.gitignore`；`git status` 干净。

**附加建议**（需要密钥持有者决策，不在本次自动执行范围）：
- 由于私钥曾在无仓库级保护的情况下存在，建议**轮换 APT 签名密钥**并将新私钥只放在 GitHub Secrets（`TOKEN_MONITOR_APT_GPG_PRIVATE_KEY`），本地不再保留明文副本。
- 保留 `*.asc.enc` 加密备份即可，明文 `.asc` 从工作区删除。

### 0.2 释放磁盘（对应 WS-7，P2）

约 3.7GB 可回收，全部已正确 gitignore，删除无风险：

```bash
rm -rf dist/win-unpacked dist/linux-unpacked           # 394M + 358M
rm -f  dist/Token-Monitor-0.45.0-rev.{21,24,27}.*      # 陈旧安装包 846.9M
rm -rf tmp/mysql-runtime tmp/metainfo-verify-rev27 \
       tmp/apt-repo-rev27 tmp/apt-input-rev27 tmp/audit-* # ~1.7G
rm -rf android/app/build android/.gradle                # 429M + 14M
```

**验收**：`du -sh .` 从约 4.3GB 降到约 600MB（不含 `node_modules`）。
**注意**：`tmp/mysql-runtime` 若仍用于本机 MySQL 测试，保留该目录。

---

## 阶段 1 — 阻断级与冻结问题（P0，最高收益）

> 阶段 1 完成后应能消除"界面打不开"与"用一段时间就卡、高负载后恢复不过来"的全部现象。
> 建议 1.0 + 1.1 + 1.2 合并为一个热修复版本先发。

### 1.0 桌面端渲染进程启动崩溃（P0-0 / RD-1）—— 必须最先修

**当前源码的桌面端界面完全不可用**（窗口永久空白，只有托盘还活着）。这不是性能问题，是发布阻断问题。

**为什么必须第一个修**：它让桌面端所有其它改进都不可观测——用户根本看不到界面。而且已发布的 rev.19 构建**没有**这个问题（能正常启动），当前 HEAD **有**，因此**下一次发布必然带上**。

#### 步骤 A：加守卫（1 行）

```js
// src/electron/renderer/app.js:7514
els.saveSettingsButton?.addEventListener('click', async () => { ... });
```

#### 步骤 B：处理第二个同类地雷（必须同时做）

```js
// src/electron/renderer/app.js:5972
els.deviceIdInput.value = state.settings.deviceId || '';   // 同样未加守卫，元素也已不存在
```
不修这处，启动修好后会在第一次设置推送/初始化时再次抛错。系统自查结论：`els` 映射 194 项中**恰好只有 `deviceIdInput` 与 `saveSettingsButton`** 两项对应 id 缺失，且**只有 `saveSettingsButton` 一处**是未守卫的顶层解引用。

#### 步骤 C：一并决定 RD-4（否则客户端模式仍无法从界面配置）

删掉 Save 按钮后，`hubUrl`/`secret`/`allowInsecureHubHttp` 的**唯一写入点**就在这段死代码里。二选一：
- 恢复一个保存控件（推荐显式按钮，语义清晰）；或
- 对这三个输入改为 `change`/`blur` 时自动保存（与上传间隔下拉框的现有行为一致）。

#### 步骤 D：清理同源残留

`app.js:9389-9398` 查询 10 个已不存在的 `*ManualPanel` id；`index.html` 里仍缺 `#saveSettingsButton`/`#deviceIdInput` 的对应 UI。与 RD-23（350 个死 i18n 键）一并按"恢复入口 or 删除键族"决策处理。

#### 步骤 E：回归防线（关键）

新增测试，断言：
1. `els` 映射中的**每一项 id 都能在 `index.html` 或 `dashboard.html` 中找到**；
2. 渲染进程启动路径中**没有未守卫的顶层 `els.*` 解引用**。

这类"重构删了 DOM、JS 没跟着删"的漂移已经实际发生过一次（commit `7b7ad89` 移除了 `#saveSettingsButton`，却没有改 `app.js`），必须有测试兜住，否则还会再犯。

**验收**：`npm start` 后窗口显示真实数字；标题栏不再停在 "Starting"；关闭/最小化/刷新按钮可用；设置面板可交互；`node --test tests/electron/**` 全绿且新测试覆盖上述两条断言。

---

### 1.1 消除每 tick 的归档全量重算（P0-1 / LD-1 / SH-2）

**这是单项收益最大的一处改动。** 实测：450 会话时单次 transform 283–687ms，每 tick 触发 3 次（progressive preview 2 次 + final 1 次）。

#### 步骤 A：`sessionKey` 改为纯字符串归一化（收益最大，改动最小）

```js
// src/shared/sessionUsageArchive.js:54-62
// 现状：为了得到一个字符串，构造合成 period 并跑整套 normalizePeriod —— 慢 58 倍
function sessionKey(client, sessionId) {
  const normalized = normalizePeriod({ sessions: { candidate: { client, sessionId, totalTokens: 1 } } });
  const session = Object.values(normalized.sessions)[0];
  return session ? `${session.client}:${session.sessionId}` : null;
}
```

**已核验的关键事实（这使修复非常简单且零语义风险）**：归档模块内 `sessionKey` 的**全部 3 个调用点，传入的都已经是归一化后的会话对象**：

| 调用点 | 传入来源 | 是否已归一化 |
|---|---|---|
| `sessionUsageArchive.js:110` | `normalizedSessionFrom(rawPeriods[period], key)` → `normalizePeriod(...)` 的产物 | 是 |
| `sessionUsageArchive.js:139` | `periodFor(deviceRecord, period)` → `normalizePeriod(...)` 的产物 | 是 |
| `sessionUsageArchive.js:228` | `addArchivedSession`，其 session 来自 `normalizeSessionUsageArchive` 的输出 | 是 |

而 `emptySession(client, id)` 是**直接赋值** `sessionId: id`（`usage.js:435-438`），`detectSessionId` 本身已是纯字符串函数（`usage.js:395-397`）。因此：

```js
// 修复：归档模块内全部改为直接拼接，完全不需要归一化
const archiveKey = `${session.client}:${session.sessionId}`;
```

即 `sessionKey()` 在该模块中可**整体删除**，无需任何替代归一化逻辑 —— 归一化的边界已经由 `normalizeSessionUsageArchive` 把守。

**实测对照**（1350 次调用）：现状 59.5ms → 纯字符串 1.03ms，**58× 提速**；且因归档模块每轮调用两次，实际节省约 2×59.5ms/归一化轮次。

**必须验证**：`sessionKey` 的输出与旧实现**逐字节一致**（尤其 `RESERVED_DYNAMIC_KEYS` 拒绝逻辑、reasonix synthetic 过滤、空值返回 `null` 的分支）。

**回归**：`tests/shared/sessionUsageArchive.test.js` 全部用例 + 新增"新旧实现输出等价"的属性测试。

#### 步骤 B：不再重复归一化已归一化的归档

同一份归档在**一次 transform 内被归一化 2 次**（`captureSessionUsageArchive:131`、`applySessionUsageArchive:273`），而它在 `loadSessionArchive()` 中已经归一化过。

方案：给归一化结果打一个**内部格式标记**（如 `__normalized: 1`），`normalizeSessionUsageArchive` 见到标记即原样返回。

```js
function normalizeSessionUsageArchive(value) {
  if (value && value.__normalized === NORMALIZED_FORMAT_VERSION) return value;   // 短路
  ...
  normalized.__normalized = NORMALIZED_FORMAT_VERSION;
}
```

**注意**：
- 该标记是**内部内存标记**，写入磁盘前必须剥离（或依赖现有 `writeJsonAtomic` 的序列化路径统一剔除），避免污染磁盘格式。
- 旧版本读新文件、新版本读旧文件都必须能正常工作（标记缺失 = 未归一化，走原路径，天然兼容）。
- `writeJsonAtomic` 使用固定 `${filePath}.tmp` 名，两进程并发写会冲突 —— 一并把临时名改为含 pid（见 1.4）。

#### 步骤 C：变更检测去掉双份全量 `JSON.stringify`

```js
// src/shared/syncSummary.js:112
const changed = JSON.stringify(nextArchive) !== JSON.stringify(sessionArchive);   // 450 会话 ≈ 28ms/次
```

改为：让 `captureSessionUsageArchive` 返回 `{ archive, changed }`（它本来就在逐条比较 `sameJson`，顺手返回布尔即可），零额外成本。

**同时**：`writeJsonAtomic` 的 2 空格美化让归档文件大 36%（实测 1282KB → 819KB）。改为紧凑序列化（配置/设置类人类可读文件可保留美化，归档类大批量状态文件用紧凑）。

#### 步骤 D：把归档管线从"每个 watch tick"降到"≤60 秒一次"

watch tick 只扫描 `--today`，**不可能**改变历史归档内容。但当前每次都跑完整归档管线。

方案（`syncSummary.js`）：对 watch tick 走**快速路径**——只在 `today` 窗口内新增/变化的会话上做增量更新；完整重算按 `≤60s` 节流或在 full tick 时执行。

**必须保持的语义**（这些有测试守护，改动前先读）：
- `applyPeriodDelta` 的 delta 恒等性（append-only 日志下精确等价）
- 归档的 `periodWindows` 跨日/跨月过期语义（`tests/shared/sessionUsageArchive.test.js` 的 "archive day and month windows expire"）
- midnight 边界（"uses the collector snapshot time when delivery crosses a period boundary"）

#### 步骤 E：`deviceState.publish()` 减少深拷贝

`deviceState.js:111,116,117` 对含全部 session 的记录做 **3 次** 深拷贝（450 会话实测 164ms）。

- `:117` 的 `return cloneValue(record)` 若调用方不修改返回值可去掉（需逐个确认调用方）。
- `envelope` 在每次 publish 都 `cloneValue`，但它在 `normalizeEnvelope` 时已拷贝过，可复用。

#### 步骤 F：`applyPeriodDelta` 只遍历可能变化的键

`usage.js:1560-1576` 用 `new Set([...Object.keys(base), ...Object.keys(fresh), ...Object.keys(anchor)])` 递归整个 `allTime`（含全部 session）。watch tick 只可能影响本 tick 扫到的 session，可按 `fresh.sessions ∪ anchor.today.sessions` 收敛。

#### 阶段 1.1 验收标准

| 指标 | 实测基线（450 会话） | 目标 |
|---|---|---|
| 单次 transform | 283–687 ms | **< 30 ms** |
| 单 tick 主线程阻塞 | 约 850–2000 ms | **< 100 ms** |
| 2000 会话时单次 transform | 约 1000 ms+ | **< 120 ms**（近似线性 → 接近常数） |
| `tests/shared/sessionUsageArchive.test.js` 性能用例 | 308–1127 ms（阈值 800ms，负载下假失败） | 稳定 **< 150 ms**，并把阈值调整为留有余量 |
| widget 主进程 CPU | 实测 105% 单核 | **< 15%** |

**验证方法**：新增 `tests/shared/sessionArchivePerformance.test.js`，用固定 2000 条合成归档断言单次 `transform` 上界；同时保留现有行为测试全绿。

---

### 1.2 消除双采集器（P0-2 / LD-2）

**本机实测：两进程合计 170% 单核，其中 92% 是 JS 自耗。** 修复只需一处守卫。

```js
// src/electron/main.js:1657  startSyncCollector()
function startSyncCollector() {
  stopSyncCollector();
  // 新增：外部 agent 存活时不启动采集，只保留中转与显示
  if (isExternalAgentActive()) {
    mode = 'sync';
    updateSyncHealth('local', { state: 'relay', failureCode: null });
    startSyncRelayOnly();     // SSE/REST 中转 + 显示路径
    return;
  }
  ...
}
```

**为什么正确**：`isExternalAgentActive()` 已经用于阻止上传（`main.js:1688`）与归档写入（`:451`、`:1264`、`:1267`）——设计意图本就是"外部 agent 在跑时 widget 不重复上报"。补上采集这一环是**补全既有意图**，不是新增行为。

**注意**：`startMode()` 有两处调用（`main.js:2590`、`:2621`），都要走到该守卫；`agent.pid` 的存在性在运行中可能变化，需在 agent 启停时重新评估（必要时监听 pid 文件或在下一次 tick 复查）。

**验收**：
- 同时运行 agent 与 client 模式 widget：`ps` 下**只有一个**进程 spawn `tokscale`。
- 两进程合计 CPU 从 170% 降至 **< 60%**（含 agent 自身的必要采集）。
- widget 仍正常显示 Hub 数据（SSE 中转不受影响）。

**另**：`collector-anchor.json` 改为 `writeJsonAtomic`（含 pid 的唯一临时名），并像其他归档一样用 `isExternalAgentActive()` 守卫写入（对应 LD-12）。

---

### 1.3 Hub：消除不可恢复状态（P0-4、P0-5、HB-5）

#### 1.3.1 limits 刷新加硬超时 + 看门狗（P0-4 / LD-5）

「一个 provider 卡住 → 所有限额永久停更」是**最典型的"高负载后无法恢复"**。

1. **给 probe 加硬 deadline**：在 Hub 边界统一包一层 `runWithProbeDeadline`（项目已有该工具，但 `src/hub/` 下零引用），覆盖 `openrouterLimits.js:54`、`thirdPartyLimits.js:457`、`opencodeWeb.js:190` 这些只依赖调用方 signal 的 provider。
2. **加周期看门狗**：若 `refreshPromise` 存活超过 `k × accountRefreshMs`，强制清空 latch 并把相关账户标记为 `unavailable`（附诊断字段），而不是永远 `refreshing`。
3. **MySQL 侧**：设 `connectTimeout` 与 `query_timeout`/`max_execution_time`（同时解决 HB-4 的一半）。

**验收**：新增测试——用一个"接受连接但永不响应"的假 provider，断言：账户在 `k × interval` 内变为 `unavailable`，且**后续周期能继续刷新**（latch 已释放）。

#### 1.3.2 SSE 先注册再 await（P0-5 / LD-6）

```js
// src/hub/server.js:1108-1130
// 现状：await getStats() 在 sseClients.add(res) 与 close 订阅之前
const snapshot = await getStats();
res.writeHead(200, {...});
sseClients.add(res);
...
req.on('close', cleanup);
```

改为：**先**注册并订阅 `res.on('close')`/`req.on('close')`，`await` 之后**再**检查 `res.destroyed || res.writableEnded`，已断开则立即清理并 return（不创建心跳定时器）。

**同时**：补 `res.on('error', cleanup)`（当前只有 `req.on('error')`，这也是 HB-5 未捕获异常的具体来源之一）。

**验收**：新增测试——在慢 `getStats` 期间中止 N 个连接，断言 `sseClients.size` 回到 0（子审计探针实测当前为 1500/1500 滞留）。

#### 1.3.3 `uncaughtException` 记录后退出（HB-5）

```js
// src/hub/server.js:1359-1362
process.on('uncaughtException', (err) => {
  console.error(`[hub-fatal] uncaughtException: ${err?.message || err}`);
  if (err?.stack) console.error(err.stack);
  process.exit(1);          // ← 新增：交给 Compose restart 策略自愈
});
```

**理由**：Compose 已配 `restart: unless-stopped`，崩溃重启才是正确的恢复路径；继续带病运行会让状态机处于未定义状态。`unhandledRejection` 可先保持只记录（观察期），或同样退出——建议先记录 + 计数，超过阈值再退出，避免误杀。

#### 1.3.4 MySQL 连接池加上界与超时（HB-4，部分）

```js
// src/hub/repository.js:29-42
queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT || 200),
connectTimeout: 10_000,
```
并在池耗尽时返回 **503**（而非无限挂起）。同时补 Compose healthcheck 打 `/api/health`（当前只有 mysql 有 healthcheck）。

**验收**：人为占满连接池，断言请求在有限时间内返回 503，而不是挂起。

---

### 1.4 Hub：停止每次 ingest 全量重算（P0-3 / HB-2 / LD-4）

**实测：20 设备 656ms、50 设备 1564ms 的同步阻塞。** 且 `statsCache` 已存在却从未被读。

1. **接上已存在的缓存**：`/api/stats` 与广播改走 `statsCache` + 短 TTL（建议 1 秒级合并，即 trailing-timer / 共享 in-flight promise）。TTL 需按"3–5 秒数据新鲜度"的产品承诺来定，1 秒级合并不会破坏该承诺。
2. **消除重复归一化**：同一请求内 `aggregateDevices` 与 `aggregateHistory` 各对每台设备跑一次 `normalizeDeviceRecord` → 归一化一次后传入。
3. **`deviceHistoryRevision` 改增量**：当前每次对**每台设备的全部 history** 做键排序 + 哈希（`history.js:540`）。改为每设备存储一个随 ingest 更新的 revision 计数。
4. **`aggregateDevices` 里被丢弃的计算**：`usage.js:1489` 算出的 `aggregate.limits` 随即被 `server.js:385-387` 删除/覆盖 → 加开关跳过。

**验收**：
- 20 设备下 `/api/stats` 阻塞时间从 ~266ms 降至 **< 20ms**（缓存命中路径）。
- 连续设备上传时，事件循环不再被反复阻塞（可用 SSE 心跳延迟作为观测量）。

---

## 阶段 2 — 数据正确性与契约一致性（P1/P2）

### 2.1 上传永久卡死（P1 / SH-3）

`syncUploadScheduler.js:312-318` 在非可重试 4xx 后不挂任何定时器，而 headless agent 从不调用 `flushLatest/retryNow`。

**方案**：对"终态"失败增加**有界慢速自动重试**（如 15 分钟一次），保留真正的配置类错误码豁免（仍然不重试，避免日志噪音）。

**验收**：新增测试——注入一次 413/403，断言在慢速重试窗口后会自动再尝试一次且成功后恢复正常上报；agent 与 widget 行为一致。

### 2.2 Reasonix 在 local 模式丢失（P1 / SH-1）

`main.js:1943` 的 local 路径缺少同步路径已有的 `nativeSessions`/`nativeProjects` 重挂（`syncDisplayStats.js:47-52` 有明确注释说明为何需要）。

**方案**：把该重挂逻辑抽成一个共用函数，local 与 sync 两条路径都调用。**保持 `syncPayload.js:200-201` 仍然从上传载荷中删除这两个字段**（它们是"仅本地"数据）。

**验收**：local 模式下 Reasonix 会话/项目视图有数据；新增测试断言 `localStats.nativeSessions` 存在且**不会被上传**。

### 2.3 Hub 契约与数据完整性

| 项 | 修复 | 验收 |
|---|---|---|
| HB-1 `limitsOnly` | 明确二者择一：**推荐**在 `ingest()` 中显式处理该标志（复制 `existing.periods`、跳过 event/session 写入），与 `docs/API.md` 的"混版本兼容"承诺一致；或删除该字段与 `usage.js:1169` 的死分支并同步文档 | 新增 Hub 级路由测试：带 `limitsOnly` 的请求不改变设备周期与会话 |
| HB-11 数值上界 | 在 `validateDeviceRecordPayload` 中把 token/cost 限制到安全上界，超限返回既有 `invalid_payload` 形状 | 新增测试：`1e300` 被拒绝，设备不会永久无法入库 |
| HB-17 `updatedAt` 校验 | 归一化/校验时间戳，无法解析时回退 `receivedAt`（`periodWindows.endsAt` 已有先例） | 新增测试：垃圾时间戳不会导致周期永不过期 |
| HB-6 范围截断 | 检测部分覆盖（请求起点早于 370 天下界）并回退账本，或至少返回 `truncated: true` / `historySince` 标记（**附加字段，向后兼容**） | 新增测试：跨 370 天的范围返回完整总量或明确标记 |
| HB-7 history 上限 | ingest 时重新套用 `coerceHistory` + 370 天滚动窗口 | 新增测试：4096 行 daily 载荷被收紧到产品窗口 |
| HB-12 限流绕过 | `cf-connecting-ip`/`x-real-ip` 仅在 `trustProxy` 开启时才信任；否则用 `req.socket.remoteAddress` | 新增测试：轮换该头无法绕过认证失败限流 |
| HB-9 索引 | 新 migration 加 `KEY (recorded_at)`（建议 `(recorded_at, client, model)`）；规划保留策略 | `EXPLAIN` 范围查询不再全表扫 |
| HB-10 只写列 | 停止写 `devices` 中从不被读的列（**需先确认无外部运维 SQL 依赖**） | 存储/写放大约减半 |
| HB-18 Compose 变量 | 把 `MYSQL_CONNECTION_LIMIT`、`AGY_OAUTH_CLIENT_SECRET`、`TOKEN_MONITOR_HUB_CREDENTIAL_KEY` 加入 `docker-compose.yml`（带默认值）；`.env.example` 与 `docs/` 同步 | `docker compose exec hub env` 能看到这些变量 |
| HB-19 回环绑定 | Compose 未配 secret 时**快速失败**并打印明确原因；补 hub healthcheck | 未配 secret 时启动即报错，而不是"运行中但打不开" |
| HB-14 错误形状 | ingest 事务提交后即返回 200，广播失败只记日志；统计失败映射为 503；错误消息过滤内部细节 | 提交成功但聚合失败时不再返回 400 |
| HB-20 路由细节 | 补 HEAD 处理（或从 readRoute 移除）；`/api` 未知路径返回 JSON 404 而非 HTML；`decodeURIComponent` 移入 try 返回 400 | 新增路由测试 |
| HB-22 响应美化 | 默认紧凑序列化（`?pretty=1` 可选） | stats 响应体积约减半 |

### 2.4 跨端显示口径统一（核心一致性工作）

> 建议把"客户端 id / provider id / 标签 / 颜色"抽成**单一数据源**，由构建期生成或运行时下发，从根上消除 5 处副本漂移。

#### 步骤 1：建立单一数据源

把 `clientLabels` / `clientColors` / `KNOWN_CLIENTS` / provider 标签从 5 处（Electron `app.js:3`、`themePresets.js`、`usageCharts.js`、Hub `web/js/data.js`、Android `ClientBranding.kt` + `LimitsUi.kt`）收敛为共享定义：

- **Electron / Hub 网页**（同为 JS）：直接从 `src/shared/` 导出，网页端经构建或 HTTP 端点获取。
- **Android**：增加一个生成脚本，从共享定义生成 Kotlin 常量（并纳入 `npm run verify` 或 CI，防止再次漂移）。

#### 步骤 2：补全 Android 缺口（机械性移植）

| 缺失项 | 补法 | 参考来源 |
|---|---|---|
| 客户端 `commandcode` | 加 `"commandcode" to "Command Code"` | `renderer/app.js:3` |
| 客户端 `qodercn` | 加 `"qodercn" to "Qoder CN"` | 同上 |
| 客户端 `reasonix` | 加 `"reasonix" to "Reasonix"` | 同上 |
| provider `commandcode` | 加标签 | `hub/web/js/data.js:85-106` |
| provider `thirdparty` | 加 `"Third-party"` | 同上 |
| 限额状态 8 种 | 补 `disabled/notConfigured/unauthorized/rateLimited/sourceRateLimited/unavailable/error` 的中文标签 | `shared/limits.js:8` |
| 窗口类型 `named`/`credits` | 加 `"额度"` / `"积分"` | `shared/limits.js:14` |
| 标签文案不一致 | 统一 `copilot`→`GitHub Copilot`、`zai/zaiteam`→`GLM/GLM Team`、`minimax`→`Minimax` | 网页端为准 |
| 16 个非客户端 id 条目 | 移除（它们是 model vendor / provider id，`normalizeClientName` 永不返回） | — |

#### 步骤 3：统一数值语义

| 项 | 统一方向 | 涉及 |
|---|---|---|
| 货币 | Android 移植 `shared/currency.js` 的汇率/符号表，走同一格式化函数 | AN-7 |
| "今日"过期语义 | Android DTO 补 `periodWindows`/`ageMs`/`staleAfterMs`，过期时标注"数据截至 …" | AN-5 |
| 设备在线状态 | 三端统一用 `clientStatus`（`active/waiting/missing`）+ `stale` 推导，而非只看 `!stale` | AN-8 |
| 限额新鲜度 | DTO 补 per-provider `stale`/`updatedAt`，不要依赖被重打的 `limits.updatedAt` | AN-6 |
| 模型拆分 | 缺失时明确标注"估算"，不静默冒充权威值 | AN-13 |
| 历史窗口 | `historyIsPreview` 进入状态，30 天 preview 不得冒充全量（"近 90 天"等文案需校正） | AN-14 |
| `syncUploadIntervalMs` | **统一用一个归一化器**（建议把 `syncUploadScheduler.js:13-18` 的宽松版导入 `usage.js`），并加测试保证非枚举值可存活往返 | SH-4 |
| 日期窗口 | 全项目统一到设备本地日；`shouldPreservePeriod` 改用 `periodWindows[period].key`，仅在缺失时回退 UTC | SH-6 |

**验收**：新增一致性测试（可放在 `tests/docs/` 或新建 `tests/consistency/`），断言三端的 id 集合、标签、颜色、状态枚举**完全一致**；任何一处新增 id 而未同步其余各端时**测试失败**。

---

## 阶段 2.5 — 桌面端 / 网页端显示修复（P1/P2，多为小改动大收益）

> 这一批绝大多数是**几行到几十行**的改动，但直接决定"数字对不对、控件能不能用、看不看得见"。
> 建议与阶段 2 合并为一个次版本发布。

### 2.5.1 桌面端：数据正确性（P1）

| 项 | 修法 | 验收 |
|---|---|---|
| **RD-3** `commandcode`/`thirdparty` 无法渲染，且保存设置会把 20 项截成 18 项 | **从 `src/shared/limitProviders.js` 派生渲染端的 `LIMIT_PROVIDERS`**（渲染端可直接 require），并补 `PROVIDER_SOURCE_LABELS`、`CAPABILITY_TAGS`（注意它们当前产出的英文标签在 `app.js:147-190` 的 i18n 键里不存在，接回前要一并补键）、`.limit-icon-*` 规则 | 这两个 provider 出现在 Limits 视图/Home 限额模块/托盘；保存设置后 `limitProviders` 仍是 20 项 |
| **RD-5** 无百分比的额度窗口被显示成"已用 100%/剩余 0%" | `limitDisplayMode.js` 在 `Number()` 之前**先拒绝空值哨兵**（`remainingPercent == null \|\| String(...).trim() === ''` 直接落到 `usedPercent` 分支）；托盘路径改用 `pickConfiguredLimitProviders` 已解析好的 `percent`/`primaryPercent`，不要从原始窗口重新推导 | 新增测试：`limitFillPercent(null, null, true) !== 100`、`(null, 40, false) === 60`；DeepSeek 余额窗口显示真实余额而非 0% |
| **RD-6** Hub 账户 provider 缺 `codex`/`antigravity` | 从 `HUB_MANUAL_PROVIDER_IDS` 派生（或补这两项 + 标签） | 下拉框 17 项；已存在的 codex/antigravity 账户显示中文标签而非原始 id |
| **RD-2** 仪表盘 `innerHTML` 未转义 model 名（注入） | 在 `dashboard.js:376`/`:593` 对 `r.key`/`s.key` 转义，复用同文件 `:447` 已有的替换逻辑；抽一个 `escapeHtml` 供该文件所有模板使用 | 新增测试：含 `<img onerror=...>` 的 model 名渲染为文本 |

### 2.5.2 桌面端：一字符 / 小改动的大视觉收益

| 项 | 修法 |
|---|---|
| **RD-7** `styles.css:4985` 未闭合规则导致其后约 560 行（整套托盘/浮动气泡编排器样式）全部失效 | **补上缺失的 `}`**。一处字符改动，恢复整个托盘自定义界面 |
| **RD-8** 自定义日期范围弹层被 `.shell { overflow:hidden }` 裁剪 | 改为顶层面板（`popover` 属性或 `position: fixed`），或加 `max-height: calc(100vh - 60px); overflow: auto` |
| **RD-9** 单日历史时 Home 趋势图空白 | `points.length === 1` 时画一个点或一条到基线的竖线 |
| **RD-13** 货币"手动汇率"单选按钮未接线 | 在 `els` 映射补 `currencyRateModeManual: document.getElementById('currencyRateModeManual')` |
| **RD-14** 缺 `sessions` 键 → 显示 `‹ sessions` | 补键（或用 `sessions.detail`）；并把 `t(x) \|\| 'fallback'` 这种无效写法换成"返回值等于键名时用兜底"的辅助函数（共 5 处） |
| **RD-18** 生成的托盘图标硬编码黑色，深色任务栏不可见 | 把已有且有测试的 `trayGeneratedIconColors()` / `trayProviderGlyphInk()`（`shared/trayText.js:42-62`，当前**零调用方**）接进 `maybeUpdateBarsIcon` 与 provider 图标投递 |
| **RD-22** `.actions-hotspot` 吞掉关闭按钮右上角点击 | 给热点加 `pointer-events: none`（在 `.window-actions` 显示时），或把 `z-index` 降到 4 以下 |
| **RD-26** 三处 `var(--fg)` 全项目未定义 → hover 反馈失效 | 改用 `var(--text)`，或定义 `--fg` |
| **RD-30** 外观预览时 `desktop-mode` 类被移除 | `windowBehavior` 在补丁缺失时回落到 `state.settings`（照抄 `trayMode` 的写法） |
| **RD-27** 导出目录路径无法选中复制 | `.export-dir-path` 加 `user-select: text` |
| **RD-19** 浅色主题沿用深色语义色（对比度低至 1.3:1） | `themePresets.js` 的浅色预设一并产出 `--yellow/--blue/--orange/--red`；把硬编码的 `#ffd8d8`/`#bda5f5`/`rgba(255,255,255,0.12)` 换成变量 |
| **RD-15** 每次 stats 推送重建 711 节点 SVG、26 行工具列表与托盘图标 | 用"数据 + 尺寸指纹"门控 Home SVG 重建；设置面板不可见时不重建偏好列表；托盘图标隐藏或标记未变时跳过重栅格化 |
| **RD-20/RD-21** 折叠面板仍可 Tab 进入；多数控件无焦点指示 | `hidden` 类同时加/去 `inert`；把 `button:focus` 的全局面包屑改成 `:focus:not(:focus-visible)` 并为 `.icon-button`/`.tab`/`.refresh-button`/范围滑块补 `:focus-visible` 环；`dashboard.css` 补 focus 规则 |
| **RD-10/RD-11/RD-12** 图表边界缺陷 | 负值在入库与绘制两处夹取；K 线跳过非法日期行且 `lastDate` 从幸存行推导；宽度均衡兜底时保证每列不低于 `min(required, minWidth)` |
| **RD-16/RD-17** 拖拽时强制布局 + 展开面板掉队 | 拖拽开始时测一次 rect 并复用；拖拽结束时连同子面板一起移动或按设置整体重渲染 |

### 2.5.3 网页端（Hub PWA）

| 项 | 修法 |
|---|---|
| **HW-1** Home 设备行存储型 HTML 注入 | `src/hub/web/js/app.js:1048` 用 `escapeHtml()`；同时审一遍该文件所有拼接设备字段的模板 |
| **HW-3** `commandcode`/`deepseek-harness`/`reasonix`/`qodercn` 无标签/图标/颜色（且每次渲染 404） | 补齐两张表；与阶段 2.4 的"单一数据源"一并落地，避免第三次各写一份 |
| **HW-4** 硬编码汇率，与桌面端换算结果不一致 | 让 `hub/web/js/format.js` 改为引用 `shared/currency.js`（当前是逐字复制），并接入实时汇率覆盖 |
| **HW-5** SSE 无看门狗/超时/续传，且收到响应头就标记 `live` | 对齐桌面端已有方案：空闲看门狗 + 请求超时 + `Last-Event-ID` + `visibilitychange`/`online` 处理；**收到第一个数据帧后**才置为 `live`；界面显示"最后更新于 …" |
| **HW-6** "全部"范围实际只有约 12 个月 | 使用 `history.monthly` 表达 allTime；Home 迷你趋势图跟随所选周期（对齐桌面端 `usageCharts.js:331-332` 与 `app.js:978`） |
| **HW-10** 自定义范围丢弃 `clientModels`/`clientModelCosts` → 模型列表永远 "No usage" | 在 `app.js:3099-3108` 补齐这两个字段（与 Android AN-1 同一修法） |
| **HW-7** 每帧 `innerHTML` 重渲染会折叠 `<details>`、重建 `<select>` | 改为局部更新，或在重渲染后恢复展开状态与选择 |
| **HW-8/HW-9** 刷新吞错；`/api/stats` 无超时 → 永久骨架 | 有旧数据时也展示错误；加请求超时与可见重试 |
| **HW-11** PWA 缓存 | 再验证 fetch 加 `cache: 'reload'`；`/index.html` 入缓存前检查 `ok`；`cache.put` 放进 `event.waitUntil`；缓存名随构建版本 |
| **HW-12/HW-13** "uncached input" 差一个 `cacheWriteTokens`；Token 混合图 5 根重叠条份额 >100% | 与桌面端统一口径；把重叠分量改为不重叠（或明确标注为构成关系） |
| **HW-14/HW-15** 硬编码英文；`data-i18n-aria` 未应用；`zh-HK` 映射自相矛盾 | 补键；实现 `data-i18n-aria`；统一 `zh-HK` 的归属 |
| **HW-16/HW-17/HW-18** 设备视图周期标签是假控件；舰队级提示无视筛选；限额卡用 `clientLabel()` 显示原始 provider id | 分别修正：隐藏无效控件或让其生效；提示随筛选；`app.js:1439` 改用已有的 `PROVIDER_LABELS` |
| **RD-32** 限额状态文案硬编码英文（键已存在） | 在三处调用点包一层 `translatedLimitCapabilityTag(limitStatusLabel(status))`，并补 `'Not signed in'` 的键（现有键是 `'Sign in'`，不是这个字符串） |
| **RD-34** Home 限额卡绕过"隐藏账户邮箱"设置，显示原始邮箱 | `app.js:3695-3699` 的兜底改为与 `:2815-2820` 相同的 `maskLimitAccountEmails ? maskEmailAddress(...) : ...`（建议抽一个共用的 `accountTitleFor()`） |
| **RD-35** 视图切换菜单每次 tick 重建，键盘导航中途失效 | `renderViewSwitcher` 加状态签名（顺序 + 当前项 + 是否打开），未变则跳过 `replaceChildren`；或只重建 `current`/`disclosure` 并原地更新菜单 |
| **RD-39** 设备行/手风琴约每分钟被重建 | 指纹改用 `device.updatedAt`/`platform`/`agentVersion`/periods，不要把渲染出的相对时间（"Synced 4m ago"）纳入指纹；元信息行单独更新 |
| **RD-33** `formatUpdatedAge()` 是未本地化的重复实现，且被字符串手术 | 删除该函数，改用 `[t('settings.limits.status.stale'), compactAge(provider.updatedAt)]` |
| **RD-36** 会话详情逐轮次展开是纯鼠标控件 | 照 `app.js:1656-1660` 的写法给 `.detail-ex-head` 补 `tabIndex=0`/`role=button`/`aria-expanded`/Enter+Space |
| **RD-37/RD-38** OpenCode 分组 stale 置灰不一致；两处 `'disabled'` 兜底不可达 | 统一为与 `:2825` 相同的模板字面量；删除不可达分支 |
| **S-12** 另有 7 处无键的硬编码英文（`'This device'`、`'Reset now'`、OpenRouter 的 `'Spend'/'Today'/'Week'/'Month'/'All time'` 等） | 补键或复用已有键（`'Stale'` 已有关键） |
| **S-14** 3 个被应用的 class 在 CSS 中无对应规则（`.detail-ex-value`/`.detail-turn-value`/`.service-status-checked`） | 补规则或删除 class（前两个导致 token 数在 10px 灰色成本旁保持继承字号，疑似规则丢失） |
| **HW-19** 级联缺陷：`.remaining-tone-*` 被 `.limit-window strong` 压制 → 限额语气色从未生效 | 提高特异度或调整声明顺序；一并清理重复的 `:root --font` 与冲突的 `.badge.warn` |

### 2.5.4 Electron 主进程 / 打包

| 项 | 修法 |
|---|---|
| **EL-1** Windows 托盘模式下切换系统玻璃会留下孤儿窗口（停止更新且不再随失焦隐藏） | 在 `trayMode` 下于 `'show'` 处理器**之外**隐藏/销毁旧窗口，或托盘模式下跳过 `rebuildWindow()` |
| **EL-2** 设置变更导致采集器重启并堆叠并发 tokscale 扫描 | 重启前**先终止在跑的 `tokscale` 子进程**（与 3.1 的 SIGKILL 升级一并做），或对结构变更做去抖后再重启 |
| **EL-4** macOS 快照 drain 未捕获拒绝 → 反复弹主进程错误框 | 把 `processWork` 整体包进 try/catch，并给 `startDrain()` 加 `.catch(safeLog)` |
| **EL-5** 模式切换抛错后既无采集器也无重试 | 保留 last-good 运行时直到新运行时启动成功，或把 `{ok:false}` 回传渲染端并在下次健康轮询重试 |
| **EL-6** 不安全 HTTP 地址静默取消模式切换，UI 与实现不一致 | 渲染端 hub 模式处理器加 try/catch 并重新执行 `syncHubModeUi()`（与保存按钮路径一致） |
| **EL-7** SSE 空闲看门狗 90s > 项目自己记录的 30–60s NAT 超时 | 降到 45s（`HUB_STABILITY_PLAN.md:59` 已规划该值） |
| **EL-9** `session:getDetail` 在主线程同步解析整个 transcript | 改为异步读取 + 解析，或移入 worker（项目已有 session detail worker 基建） |
| **EL-10** Linux 托盘菜单每次 stats 推送都重建 | 仅在 Refresh 文案或单选状态变化时重建 |
| **EL-12** 打包后 `WIN_ICON_PATH` 指向被排除路径 → 总回退到 981KB PNG | 把 `build/icons/icon.ico` 加入 `files`，或移到 `assets/icons/` 下 |
| **EL-13** `hubMode:'client'` 且 URL 为空时流永久空闲 | 空 URL 分支也安排重试或兜底轮询 |
| **EL-14（P1）** 每个安装包带 49 个无用 Chromium 语言包（42.35MB 原始 / 10.96MB 压缩） | 在 `scripts/electron-builder.config.js` 加 `afterPack` 钩子，只保留 `en-US/en-GB/zh-CN/zh-TW/ko/ja`，其余 `fs.rmSync`（macOS 用 `*.lproj` 布局，需一并处理） |
| **EL-S1（需先验证）** `dist/latest-linux.yml` 只列 `.deb` 未列 `.AppImage` → AppImage 用户可能永远无法自动更新 | 先跑一次干净的 `npm run dist:linux` 数 `- url:` 条目；若确实缺失，修 `merge-mac-updater-metadata.js`/构建顺序，并**扩展 `verify:release-artifact-names`**：不仅检查"引用的产物存在"，还要检查"每个平台的每个安装包都被引用" |

---


### 3.1 子进程生命周期（LD-3）

对 `collector.js:198-214`（tokscale）、`:896-920`（antigravity）、`cursorAuth.js:83-99` 三处统一：

```js
// SIGTERM 后升级 SIGKILL；用进程组以覆盖子孙进程
child.kill('SIGTERM');
const killTimer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) {} }, 5000);
killTimer.unref?.();
// 超时路径：置 settled 标志、移除/销毁 stdio 监听、避免字符串继续累积
child.stdout?.destroy(); child.stderr?.destroy();
child.unref();
```

**验收**：新增测试——用一个忽略 SIGTERM 的假子进程，断言 5 秒内被 SIGKILL，且父进程无监听器遗留、无内存增长。

### 3.2 WSL 瞬时失败不得固化（SH-5）

`collector.js:3266-3269`：刷新失败（bundle 为空）且旧 anchor 有数据时**保留旧值**，并让 `collectWslUsage` 返回 per-home 成功信息以便部分合并。参照已有的 antigravity 保护（`:1136-1143`）。

### 3.3 无界缓存加界（SH-9 / LD-7）

- `collector.js:619` `projectPathCache`、`:677` `jsonlTimestampCache`：加 LRU 上限（如 10k 条）并保留 `size:mtimeMs` 键语义。
- `localSessionMetadataDeps` 的三个 Map 当前**每 tick 重建**（`collector.js:1046-1053`）→ 提升到 per-collector 生命周期。

### 3.4 恢复路径（LD-10）

- `recoverNow()` 的 40Hz 忙等改为事件驱动（或用 250ms 轮询）。
- 给 `runManualDeviceRefresh` 传 `AbortSignal`，超时后**真正取消**已放弃的全量重扫。

### 3.5 显示与推送合并（LD-8）

- `sendPush` 做 ≤250ms 合并（只保留最新载荷）。
- `updateTrayDisplay()` 在渲染输入未变化时跳过（避免每次推送重建托盘菜单与图标）。
- 记录只克隆一次。

### 3.6 macOS 专属（LD-11）

`macWidgetPublisher.js`：把 sequence/`hasDemand()` 检查**移到 await 之前**；history 按已有的 `historyRevision` 缓存。

### 3.7 SSE 客户端数量上界（HB-15）

对 `/api/stats/stream` 加全局与按 principal 的连接数上限（如每 principal 4 个），超限返回明确关闭码并写入文档。

---

## 阶段 3 — 稳定性与资源（P1/P2）

### 3.1 子进程生命周期（LD-3）

对 `collector.js:198-214`（tokscale）、`:896-920`（antigravity）、`cursorAuth.js:83-99` 三处统一：

```js
// SIGTERM 后升级 SIGKILL；用进程组以覆盖子孙进程
child.kill('SIGTERM');
const killTimer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) {} }, 5000);
killTimer.unref?.();
// 超时路径：置 settled 标志、移除/销毁 stdio 监听、避免字符串继续累积
child.stdout?.destroy(); child.stderr?.destroy();
child.unref();
```

**验收**：新增测试——用一个忽略 SIGTERM 的假子进程，断言 5 秒内被 SIGKILL，且父进程无监听器遗留、无内存增长。

### 3.2 WSL 瞬时失败不得固化（SH-5）

`collector.js:3266-3269`：刷新失败（bundle 为空）且旧 anchor 有数据时**保留旧值**，并让 `collectWslUsage` 返回 per-home 成功信息以便部分合并。参照已有的 antigravity 保护（`:1136-1143`）。

### 3.3 无界缓存加界（SH-9 / LD-7）

- `collector.js:619` `projectPathCache`、`:677` `jsonlTimestampCache`：加 LRU 上限（如 10k 条）并保留 `size:mtimeMs` 键语义。
- `localSessionMetadataDeps` 的三个 Map 当前**每 tick 重建**（`collector.js:1046-1053`）→ 提升到 per-collector 生命周期。

### 3.4 恢复路径（LD-10）

- `recoverNow()` 的 40Hz 忙等改为事件驱动（或用 250ms 轮询）。
- 给 `runManualDeviceRefresh` 传 `AbortSignal`，超时后**真正取消**已放弃的全量重扫。

### 3.5 显示与推送合并（LD-8）

- `sendPush` 做 ≤250ms 合并（只保留最新载荷）。
- `updateTrayDisplay()` 在渲染输入未变化时跳过（避免每次推送重建托盘菜单与图标）。
- 记录只克隆一次。

### 3.6 macOS 专属（LD-11）

`macWidgetPublisher.js`：把 sequence/`hasDemand()` 检查**移到 await 之前**；history 按已有的 `historyRevision` 缓存。

### 3.7 SSE 客户端数量上界（HB-15）

对 `/api/stats/stream` 加全局与按 principal 的连接数上限（如每 principal 4 个），超限返回明确关闭码并写入文档。

---

## 阶段 4 — 体积、启动与代码清理（P2/P3）

### 4.1 Docker 镜像瘦身（WS-2，约 -10MB 压缩后，-40.5MB 未压缩）

Hub 真实闭包只需 6 个包（`chokidar dotenv koffi mysql2 semver undici` = 7.3MB），实装 47.9MB。

- 最有效的一步：让 Docker 构建**不安装** `@tokscale/cli-*`（25.85MB，压缩后约 10MB）。可用 `npm ci --omit=dev --omit=optional` 配合把纯客户端依赖移入 `optionalDependencies`，或在 Dockerfile 中 `npm prune` 掉已知无用包。
- **必须同时处理**：`mysql2` 的 **非可选 peerDependency `@types/node`**（2.54MB）——生产镜像装 TypeScript 类型定义毫无意义。
- 其余：`discord-api-types`/`@discordjs/rest`/`@vladfrangu/async_event_emitter`（Discord RPC，仅 Electron）、`tar`、`electron-updater`+`js-yaml`。

**注意**：`package.json` 的依赖分区是**兼容面**（影响所有安装方式），调整需在 PR 说明并验证三种安装路径（Electron / headless / Docker）。

### 4.2 headless agent 瘦身（WS-3，每机 22.8MB）

- 同上解决依赖分区（agent 真实闭包 25.0MB vs 实装 47.8MB）。
- `src/shared` 整目录复制：115 个文件中 **67 个（844,785 字节）** 从 `agent.js` 不可达 → 打包脚本改为按真实 require 闭包收集。

### 4.3 Electron 启动优化（WS-4，约 250–500ms）

```js
// src/electron/main.js:114
const { startDiscordRpc, ... } = require('./discordRpc');   // 顶层 eager，但功能默认关闭
```
把该 require 移入 `startDiscordRpc()` 内部（或改为首次用到时懒加载）。

**实测**：`@xhayper/discord-rpc` 中位 **242.7ms / 170 modules**（独立冷启 517ms），是 eager require 中最大的一项。同类可一起处理 `electron-updater`（133.8ms / 159 modules）。

**验收**：冷启动到窗口可见的时间减少 ≥200ms（用 `--cpu-prof` 或启动打点对比）。

### 4.4 Electron 打包精简（WS-5、WS-6，约 8.9MB 原始 / 2MB gzip）

- 排除 `**/*.map`（**4.97MB**，739 个文件）与 `undici/docs/**`、`koffi/vendor/**` 头文件（1.24MB）。
- `mysql2` 只有 Hub 用（`grep -rn mysql2 src/` 仅命中 `src/hub/repository.js:3`，而 `src/hub/**` 已被排除出 Electron 包）→ 移出 Electron 运行时依赖（1.41MB）。
- **诚实预期**：Electron 安装包（139MB AppImage / 109MB deb）主要由 221MB Electron 框架 + 25.85MB tokscale 决定，此项优化是**边缘收益**，不要期待安装包显著变小。

### 4.5 状态文件与存储格式

- `writeJsonAtomic`：临时文件名加 pid（避免并发写冲突）；对归档类大文件改用紧凑序列化（-36%）。
- HB-10：停止写 `devices` 中从不被读的列（确认无外部 SQL 依赖后）。
- LD-9：`usage_events` 加 `recorded_at` 前导索引 + 规划保留策略。

### 4.6 死代码清理

| 项 | 处理 | 注意 |
|---|---|---|
| `statsCache` / `getCachedStats`（HB-21） | **接上缓存**（阶段 1.4），而非删除 | 已预留正确位置 |
| `statsListeners`/`onStats` | 无生产调用方 → 删除或接入 | — |
| `aggregateDevices` 中被丢弃的 `limits` 计算 | 加开关跳过 | — |
| `timedTokens`/`timedOutputTokens`/`timedDurationMs`（SH-7） | **先从线上协议弃用**（保留接收一个版本），再删除 | 线上协议是兼容面 |
| `qoderCnDiagnostics`、`carryDeviceHistory` | 无读取方 → 删除 | — |
| `orderedSink.js`（LD-13） | 无生产调用方 → 删除，或补 deadline 与 `active` 清理 | 当前是埋雷 |
| `deviceState.updateLimits` + `deviceRuntime` limits stubs（SH-8） | 二选一：删除使代码与 `AGENTS.md` 一致，或按文档接上 `LimitsRuntime` | 需同步更新 `AGENTS.md` |
| `limitsRuntime.js:429` 区间在 refresh 开始时重排（LD-14） | 改为 **settle 后**再排下一轮 | 重新启用设备端限额前必修 |
| Android：`compose.ui.tooling.*`、`kotlinx-coroutines-test` | 删除（无 `@Preview` / 未被测试使用） | — |
| Android `ClientBranding` 中 16 个非客户端 id | 删除 | 见阶段 2.4 |

### 4.7 Android 构建与配置

- `app/build.gradle.kts:183` 禁用全部 `Test` 任务 → 改为**按平台**禁用（仅 Windows 需要该 workaround），并在 `ci.yml` 增加 Android job（当前 release workflow 才跑，`ci.yml` 完全没有 Android 步骤）。**这是"假绿"风险，优先级高于其 P3 定级。**
- `-PtokenMonitorVersion` 回退值（`:21`）与 `package.json` 解耦 → 改为缺失即报错，或在 `verify-release-version.js` 中断言一致。
- `versionCode` 碰撞（`:70-72`）→ 加 `require(patch < 100 && revision < 10000)`。
- `values-night/themes.xml`：当前无夜间主题，启动会闪白（`themes.xml:2` 继承浅色主题）。
- `gradle-wrapper.properties:3` 从腾讯云镜像取 Gradle 且**无 `distributionSha256Sum`** → 补校验和（供应链风险）。
- 若启用 `minifyEnabled`：注意 **Vico 不提供 consumer rules**，需要图表冒烟测试。

### 4.8 仓库卫生

- 归档或删除根目录过期文档（`AUDIT.md`、`DEVELOPMENT_REPAIR_PLAN.md`、`HUB_STABILITY_PLAN.md`、`WEB_UI_AUDIT_REPORT.md`）——其中的结论已与当前代码脱节（如 Android 明文限制、Hub 异常处理均已在后续提交修复）。建议移入 `docs/archive/` 并在开头标注"历史文档，结论可能已过期"。
- 去重 2.72MB 逐字节重复的已跟踪文件（45 组 / 63 个）：`assets/icon.png` == `icon-win.png` == Android `ic_launcher.png`（各 981,278 字节）等。用符号链接或构建期复制替代。

---

## 阶段 5 — 验收与回归防线

### 5.1 必须新増的测试

| 测试 | 守护什么 |
|---|---|
| `sessionArchivePerformance.test.js` | 2000 会话下单次 transform 上界（防 P0-1 回归） |
| `sessionKeyEquivalence.test.js` | 新旧 `sessionKey` 输出逐字节等价 |
| `sessionArchiveNormalizeShortCircuit.test.js` | 归一化短路不改变语义；磁盘格式不含内部标记 |
| `collectorSingleInstance.test.js` | 外部 agent 存活时不启动第二个采集器 |
| `hubStatsCache.test.js` | 统计缓存 TTL 与失效正确；设备上传不触发重复重算 |
| `hubLimitsWatchdog.test.js` | provider 卡住时 latch 被释放、账户标记 unavailable |
| `hubSseOrphan.test.js` | 慢 `getStats` 期间中止的连接不滞留 |
| `hubIngestLimitsOnly.test.js` | 带 `limitsOnly` 的请求不改变周期与会话 |
| `hubIngestBounds.test.js` | 超范围数值被拒绝（`1e300`） |
| `hubRateLimitBypass.test.js` | 轮换 `cf-connecting-ip` 无法绕过 |
| `syncUploadTerminalRetry.test.js` | 终态 4xx 后有界慢速重试可恢复 |
| `localModeNativeSessions.test.js` | local 模式保留 Reasonix 视图且不上传 |
| `childProcessKillEscalation.test.js` | 忽略 SIGTERM 的子进程被 SIGKILL，无监听器/内存遗留 |
| `crossClientConsistency.test.js` | 三端客户端 id / provider id / 标签 / 颜色 / 状态枚举完全一致 |
| `sessionArchiveDayWindow.test.js` | 补 DST 与跨日/跨月边界（SH-6 相关） |

### 5.2 需要修正的既有测试

- `tests/shared/sessionUsageArchive.test.js:426`：800ms 阈值在并发负载下会假失败。阶段 1.1 完成后实测应稳定在 150ms 以下 → **收紧阈值并留 3× 余量**，或改为测量**算法复杂度**而非绝对时间（更稳健）。

### 5.3 需要新增的可观测性（用于验证修复效果）

- 采集器导出 `lastTickDurationMs` 与 `archiveTransformMs`（`getDiagnostics()` 已有 `lastTickDurationMs`）。
- Hub 导出统计计算耗时、缓存命中率、SSE 客户端数、连接池等待数。
- 这些指标是判断"是否又变慢"的唯一客观依据，建议一并加入 `/api/health`（注意 HB-23 的信息泄露问题，敏感项需鉴权）。

### 5.4 建议的发布顺序

1. **热修复 1**：阶段 1.1 + 1.2（冻结问题，收益最大、风险最低）
2. **热修复 2**：阶段 1.3（Hub 不可恢复状态）
3. **次版本**：阶段 1.4 + 2.1 + 2.2
4. **次版本**：阶段 2.3 + 2.4（跨端一致性，Android 需要发版）
5. **后续**：阶段 3 → 4 → 4.8

---

## 附录 A — 修复优先级速查表

| 排名 | 项 | 阶段 | 预估工作量 | 收益 |
|---|---|---|---|---|
| 1 | **渲染进程启动崩溃守卫（1.0A/1.0B）** | 1 | **30 分钟** | **让桌面端界面从"永久空白"恢复可用；下一个 release 的发布阻断项** |
| 2 | `sessionKey` 纯字符串化（1.1A） | 1 | **0.5 天** | 单项最大性能收益：archive 归一化快约 90% |
| 3 | 双采集器守卫（1.2） | 1 | **0.5 天** | CPU 减半，本机 170%→<60% |
| 4 | 归档管线降频 + 去掉重复归一化与双 stringify（1.1B/C/D） | 1 | 2–3 天 | tick 阻塞 850ms→<100ms |
| 5 | `.gitignore`/`.dockerignore` 加 `.secrets`（0.1） | 0 | **2 分钟** | 消除不可逆泄露风险 |
| 6 | `styles.css:4985` 补 `}`（RD-7） | 2.5 | **1 分钟** | 恢复整套托盘/浮动气泡编排器样式 |
| 7 | Hub SSE 先注册再 await（1.3.2） | 1 | 0.5 天 | 消除单调泄漏 |
| 8 | Hub limits 看门狗（1.3.1） | 1 | 1 天 | 消除永久停更 |
| 9 | Hub 统计缓存接上（1.4） | 1 | 1–2 天 | Hub 阻塞 656ms→<20ms |
| 10 | Android 自定义范围/切换 Hub 清状态（AN-1/AN-2） | 2 | 1 天 | 消除"显示错误数字" |
| 11 | 三端 id/provider 补齐 + 单一数据源（2.4） | 2 | 1 天 | 消除原始英文 id 与多处漂移 |
| 12 | 上传终态重试（2.1） | 2 | 0.5 天 | 消除静默停报 |
| 13 | local 模式 Reasonix（2.2） | 2 | 0.5 天 | 恢复缺失视图 |
| 14 | 桌面端限额/账户 provider 与百分比修复（RD-3/RD-5/RD-6） | 2.5 | 0.5 天 | 消除"错误数字 + 控件消失" |
| 15 | Electron 语言包裁剪（EL-14） | 2.5 | 1 天 | 安装包 -10.96MB（压缩后） |
| 16 | Docker 瘦身（4.1） | 4 | 1 天 | 镜像 -13.94MB（压缩后） |
| 17 | 启动懒加载 discord-rpc（4.3） | 4 | **2 小时** | 冷启动 -250ms |

**若只有一天时间**：做 1、2、3、5、6。这五项覆盖了**发布阻断问题**、**"变卡"的主因**、**唯一不可逆的安全风险**，以及一处一分钟的一字符 CSS 修复。

**若要发一个热修复版本**：1（渲染崩溃）+ 1.1（归档）+ 1.2（双采集器）——这三项直接对应"界面打不开"和"用一段时间就卡"两个用户主诉，且都不触碰线上协议。

---

## 附录 B — 明确**不建议**做的事

审计中已证伪或收益极低的假设，避免后续浪费时间：

| 假设 | 实际结论 |
|---|---|
| 模式切换/SSE 重连导致定时器重复注册 | **已证伪**，所有定时器都有 `stopped` 守卫与清理 |
| SSE 重试风暴 | **已证伪**，退避上限 30 秒且仅在连接成功时重置 |
| `orderedSink` 是当前上传路径的死锁源 | **已证伪**，零生产调用方（但仍是埋雷，见 4.6） |
| 上传退避无上限 / 队列无限增长 | **已证伪**，退避上限 30 秒，队列是 latest-wins 单槽 |
| 渲染端定时器重复 | **已证伪** |
| Electron 渲染端与 Hub 网页端存在大段复制分叉 | **已证伪**：160 组跨文件比对仅 1 组超过 8 行；`renderer/app.js`(9426 行) 与 `hub/web/js/app.js`(3836 行) **零** 6 行重复 |
| 整体代码重复率高 | **证伪**：`src/` 76827 行中 ≥8 行重复片段共 883 行 = **1.15%** |
| 客户端 id 三端不一致 | **部分证伪**：Electron 与 Hub 网页端 26/26 完全对齐；**只有 Android 缺 3 个** |
| i18n 有缺失译文键 | **已证伪**：5 语言 × (1042 + 272) 键全部对齐 |
| Electron 包打进了 Hub 服务端代码 | **已证伪**：`build.files` 正确排除 `src/hub/**` |
| 打包了很多无用代码导致客户端臃肿 | **部分证伪**：Electron 可移除约 8.9MB（原始），安装包体积主要由 Electron 框架决定；**真正浪费大的是 Docker 镜像与 headless 安装** |
| 构建产物被误提交进 git | **已证伪**：`dist/`、`tmp/`、`build/` 全部正确 gitignore，0 个被跟踪 |

---

## 附录 C — 一页速览

**要修的根因（按影响排序）**

0. **桌面端渲染进程启动即崩溃**：`app.js:7514` 对已被删除的 `#saveSettingsButton` 未加守卫地调用 `addEventListener` → 脚本中断，其后 1912 行（含 `init()` 与实时更新订阅）永不执行 → **界面永久空白**。已发布的 rev.19 没有此问题，**当前 HEAD 有，下次发布必然带上**。
1. **归档每 tick 全量重算**，且 `sessionKey` 用 `normalizePeriod` 算字符串（慢 58×）→ 随使用时间线性恶化 → 最终永久冻结。
2. **同一机器跑两个采集器**（`isExternalAgentActive()` 只拦上传）→ CPU 翻倍。
3. **Hub 每次 ingest 全量重算集群统计**，且预留的 `statsCache` 从未接上 → 阻塞所有请求。
4. **Hub limits 全局 latch 无超时** → 一个卡住的 provider 让限额永久停更（只能重启）。
5. **Hub SSE 在注册前 await** → 断连即永久泄漏，越慢越漏、越漏越慢（只能重启）。
6. **三端各写一套显示契约** → Android 缺 3 个客户端 id / 2 个 provider id，桌面端缺 2 个 provider id / 2 个 Hub 账户 provider，网页端缺 4 个客户端标签；货币、过期语义、在线判定、模型拆分、限额百分比口径均不一致（含把一个有余额的账户显示成"已用 100%"）。
7. **一次不可重试 4xx 后上传永久停止**，headless agent 无恢复路径。
8. **APT 签名私钥明文在仓库目录**，仅靠本机 `.git/info/exclude` 保护。

**最小改动集（一天内可完成，覆盖最大收益与唯一不可逆风险）**

- 渲染进程崩溃守卫 `els.saveSettingsButton?.` + `els.deviceIdInput` 守卫（1.0A/1.0B）——**30 分钟，解除发布阻断**
- `sessionKey` 改为纯字符串归一化（1.1A）
- `startSyncCollector()` 加 `isExternalAgentActive()` 守卫（1.2）
- `.gitignore` + `.dockerignore` 加 `.secrets`（0.1）
- `styles.css:4985` 补一个 `}`（RD-7）——**1 分钟，恢复整套托盘编排器样式**
