# 全项目问题清单（Bug / 一致性 / 性能占用 审计报告）

审计对象：Token Monitor（token记录系统）
审计基线：`807cd82819683dd6cd847f5b252d5c404ebb55d6`，版本 `0.45.0-rev.38`
审计日期：2026-09-17
审计范围：Electron 桌面端（主进程 + 渲染进程）、Hub 服务端（Node/MySQL）、Hub 网页端（PWA）、Android 端、`src/shared` 共享库、打包与依赖
审计方式：全量源码阅读 + 关键路径实测（真实数据文件 / 真实运行进程）+ 自动化测试基线

---

## 一、结论摘要

**系统确实存在"用一段时间就变卡、高负载后无法恢复"的问题，而且已经在本机复现到实测数据。**
**此外还发现一个更紧急的问题：当前源码（HEAD）的桌面端界面根本起不来（P0-0），只有已发布的 rev.19 是正常的。**

性能问题的根因是一条清晰的因果链，由 5 个互相叠加的机制（P0-1 ~ P0-5）构成；P0-0 是独立于性能之外的发布阻断问题，单独列在最前。

| 编号 | 机制 | 性质 | 实测证据 |
|---|---|---|---|
| **P0-0** | **桌面端渲染进程在顶层第 7514 行对不存在的 DOM 元素调用 `addEventListener` → 脚本中断，其后 1912 行（含 `init()` 与所有实时更新订阅）永不执行** | 界面永久空白、只有托盘可用；下一个 release 必然带上 | 源码中 `saveSettingsButton` 只有引用、无该元素；rev.19 已发布的 asar **有**该元素（能正常启动），当前 HEAD **没有**（见 §4.0） |
| **P0-1** | 每次采集 tick 都会把整个 session 归档**反复完整重算**（`sessionKey` 用 `normalizePeriod` 算一个字符串，慢 58 倍） | 阻塞主线程，随使用时间线性恶化 | 450 会话时单次 transform **283–687ms**，每 tick 触发 3 次 |
| **P0-2** | 同一台机器上**跑了两个完整采集器**（widget client 模式 + headless agent），`isExternalAgentActive()` 只拦上传、不拦采集 | CPU/IO 翻倍 | 实测两进程合计 **170% 单核**，且 92% 是 JS 自耗、与 tokscale 无关 |
| **P0-3** | Hub 每次 ingest 都**全量重算整个集群统计**（O(D²)），且 `statsCache` 死代码从未被读 | Hub 事件循环阻塞 | 实测 20 设备 **656ms**、50 设备 **1564ms**/次 |
| **P0-4** | Hub limits 刷新被**单个全局 latch 锁死且没有任何超时**，一个卡住的 provider 请求 → 限额永久停更 | 不可恢复（需重启） | 代码确认无 deadline；`runWithProbeDeadline` 在 `src/hub/` 零引用 |
| **P0-5** | Hub SSE 客户端在注册前 await，此期间断开的连接**永久泄漏**在注册表里 | 不可恢复、单调增长 | 探针实测 **1500/1500** 中止连接全部滞留 |

叠加后的现实表现（本机实测）：

```
widget 主进程   RSS 415MB   CPU 23.3%  已运行 4 天 0 小时   → 约 +4.1MB/小时
headless agent  RSS 474MB   CPU 20.3%  已运行 4 天 10 小时  → 约 +4.6MB/小时
系统 7.4GB 内存，仅剩 124MB free
```

**另一类独立问题：三端功能不统一。** 内容不是"没做"，而是各端各写一套，已经出现实际漂移：Android 端 3 个客户端 id 和 2 个限额 provider 无法显示（直接显示原始英文 id）；Android 端自定义时间范围会显示**上一个范围的数字**；"今日"在数据过期时仍被当作实时数据展示。

---

## 二、严重度分级与问题总览

分级标准：

- **P0** — 数据丢失 / 无法上报 / 崩溃 / 不可恢复 / 完全打不开
- **P1** — 数据错误、内容缺失、用户可感知的频繁故障
- **P2** — 边界情况、持续缓慢的资源泄漏、功能降级
- **P3** — 清理项（死代码、冗余、仓库卫生）

| 编号 | 严重度 | 类别 | 一句话问题 | 位置 |
|---|---|---|---|---|
| **RD-1** | **P0** | 渲染·启动崩溃 | **桌面端渲染进程启动即抛异常 → 界面永久停在空白骨架，只有托盘还活着** | `src/electron/renderer/app.js:7514` |
| LD-1 / SH-2 | **P0** | 性能·阻塞 | 每 tick 反复全量重算 session 归档，随使用线性恶化 | `src/shared/sessionUsageArchive.js`、`syncSummary.js` |
| LD-2 | **P0** | 并发 | widget + agent 双采集器同时运行，只拦上传不拦采集 | `src/electron/main.js:1657,2590` |
| LD-5 | **P0** | 状态死锁 | Hub limits 刷新全局 latch 无超时，卡住即永久停更 | `src/hub/accountService.js:581,611` |
| HB-2/LD-4 | **P0** | 性能·阻塞 | Hub 每次 ingest 全量重算集群统计；`statsCache` 是死代码 | `src/hub/server.js:721,396` |
| LD-6 | **P0** | 泄漏 | SSE 客户端注册前 await，断连即永久泄漏 | `src/hub/server.js:1108-1130` |
| WS-1 | **P1** | 安全 | APT 签名**私钥明文**在仓库目录，仅靠本机 `.git/info/exclude` 保护 | `.secrets/`、`.gitignore`、`.dockerignore` |
| SH-1 | **P1** | 一致性·内容缺失 | local（默认）模式永久丢失 Reasonix 会话/项目视图 | `src/electron/main.js:1943` |
| SH-3 | **P1** | 可用性 | 一次不可重试 4xx 后**上传永久停止**，headless agent 无恢复路径 | `src/shared/syncUploadScheduler.js:312-318` |
| AN-1 | **P1** | 数据错误 | Android 自定义范围显示**上一个范围**的数字 | `AnalyticsScreen.kt:148-164`、`HubViewModel.kt:189` |
| AN-2 | **P1** | 数据错误 | Android 切换 Hub 后旧 Hub 数据一直留在屏幕上 | `MoreScreens.kt:1703`、`HubViewModel.kt:236` |
| AN-3 | **P1** | 安全·配置 | Android release 允许全域名明文 HTTP，与文档矛盾 | `AndroidManifest.xml:12`、`network_security_config.xml` |
| AN-4/AN-5 | **P1** | 内容缺失·一致性 | `/api/history` 失败被吞且不重试；过期数据当"今日" | `HubViewModel.kt:85-92`、`OverviewScreen.kt:154` |
| HB-4 | **P1** | 可用性 | MySQL 连接池无 queueLimit / 无查询超时 → 全部 DB 路由可无限挂起 | `src/hub/repository.js:29-42` |
| HB-5 | **P1** | 可用性 | `uncaughtException` 只打日志不退出，进程带病运行 | `src/hub/server.js:1359` |
| HB-19 | **P1** | 配置·打不开 | Compose 未配 secret 时容器内绑 127.0.0.1 → 网页端完全打不开且无报错 | `docker-compose.yml:32`、`server.js:125` |
| LD-3 | **P1** | 泄漏·并发 | 超时子进程只发 SIGTERM、无 SIGKILL、stdio 累积不释放 | `src/shared/collector.js:198-214` |
| WS-4 | **P1** | 启动性能 | 默认关闭的 Discord RPC 在启动时被 eager require（+170 模块） | `src/electron/main.js:114` |
| WS-2/WS-3 | **P1** | 打包浪费 | Docker 镜像 85% 的 node_modules 是死重；headless 安装 22.8MB 无用 | `Dockerfile`、`dist-headless` 安装说明 |
| SH-4 | P2 | 一致性 | `syncUploadIntervalMs` 生产者/消费者两套归一化规则 → 设备被误判 stale | `syncUploadScheduler.js:13` vs `syncUploadInterval.js:3` |
| SH-5 | P2 | 数据完整性 | WSL 扫描瞬时失败被固化为新 anchor，WSL 用量归零数分钟 | `src/shared/collector.js:3266` |
| SH-6 | P2 | 数据错误 | `shouldPreservePeriod` 用 UTC 日判断本地日窗口 → 非 UTC 时区多算/少算 | `src/shared/usage.js:1051-1059` |
| SH-9 | P2 | 内存 | `projectPathCache` / `jsonlTimestampCache` 无上限无淘汰 | `src/shared/collector.js:619,677` |
| HB-1 | P2 | 契约矛盾 | 文档称 `limitsOnly` 会被丢弃，但丢弃后会被当作全量更新而清零数据 | `src/hub/server.js:702-705` |
| HB-6 | P2 | 数据错误 | 自定义范围超过 370 天时静默返回**部分**总量 | `src/shared/history.js:347`、`server.js:538` |
| HB-7 | P2 | 性能·数据 | Hub 不重新限制 history 行数，一个合法 1MiB 载荷可拖慢所有统计 | `wireValidation.js:13,146` |
| HB-9/LD-9 | P2 | 数据库 | `usage_events` 无 `recorded_at` 前导索引、永不清理、全表扫 | `migrations/001:68` |
| HB-10 | P2 | 存储 | `devices` 列是 `snapshot_json` 的只写副本，2× 存储与写放大 | `src/hub/repository.js:184-205` |
| HB-11 | P2 | 数据完整性 | ingest 无数值上界，超范围数值导致该设备**永久无法入库** | `wireValidation.js:165-198` |
| HB-12 | P2 | 安全 | 认证失败限流可被客户端 `cf-connecting-ip` 头绕过 | `src/hub/server.js:867-880` |
| HB-13 | P2 | 数据错误 | 两台机器共用 deviceId 时互相覆盖并重复计账 | `repository.js:190-205`、`usage-events.js:179` |
| HB-17 | P2 | 数据错误 | `updatedAt` 不校验 → 无法解析时周期永不过期、聚合被永久高估 | `usage.js:940,1412,1051` |
| HB-18 | P2 | 配置 | Compose 未透传 3 个已文档化的环境变量（设置了没效果） | `docker-compose.yml:29-49` |
| AN-6 | P2 | 一致性 | Android 限额新鲜度永远显示"刚刚更新"（Hub 每次重打时间戳） | `LimitsUi.kt:93`、`accountService.js:425` |
| AN-7 | P2 | 一致性 | Android 成本恒为 US$，网页端跟随用户货币偏好 | `Formatters.kt:40-50` |
| AN-8 | P2 | 一致性 | 设备已停报仍显示"在线"；全部客户端 missing 也算在线 | `DevicesScreen.kt:129,235` |
| AN-9 | P2 | 功耗 | Android 后台仍持续 SSE 重连与 15s 心跳，无生命周期感知 | `HubViewModel.kt:238-259` |
| AN-10 | P2 | 性能 | Android 每次 API 调用都新建 `OkHttpClient`（新连接池/线程） | `HubApiFactory.kt:25-50` |
| AN-11 | P2 | 一致性 | `named`/`credits` 限额窗口直接显示英文原文 | `LimitsUi.kt:60-65` |
| AN-12 | P2 | 死代码 | "本设备限额"区块永远拿不到数据（Hub 主动删除） | `DevicesScreen.kt:367` |
| AN-13/AN-14 | P2 | 一致性 | 模型拆分静默用估算值；30 天 preview 当作全量历史用 | `AnalyticsScreen.kt:354`、`TrendCharts.kt:50` |
| WS-6 | P2 | 打包 | 4.97MB source map + 1.24MB 文档/头文件被打进 app.asar | `scripts/electron-builder.config.js` |
| WS-7 | P2 | 磁盘 | 工作区 4.3GB 中约 3.7GB 是可再生构建产物与临时文件 | `dist/`、`tmp/` |
| WS-8 | P2 | 仓库 | 2.72MB 逐字节重复的已跟踪文件（45 组 / 63 个） | `assets/` 等 |
| WS-5 | P2 | 依赖 | 仅 Hub 使用的 `mysql2` 被打进 Electron 客户端 | `package.json` |
| HB-22 | P3 | 性能 | 所有 JSON 响应 2 空格美化，stats 载荷字节数近乎翻倍 | `src/shared/http.js:96-104` |
| HB-21 | P3 | 死代码 | `statsCache` / `statsListeners` / `aggregateLimits` 结果全部未被使用 | `src/hub/server.js:369,385,826` |
| HB-20 | P3 | 契约 | 已授权的 HEAD 返回 404；SPA fallback 吞掉 `/api`；`%` 编码错误返回 500 | `server.js:920-971`、`static.js:114` |
| HB-23 | P3 | 安全 | 未认证 `/api/health` 泄露设备数量与认证配置 | `server.js:835-849` |
| SH-7 | P3 | 死代码 | `timedTokens`/`timedOutputTokens`/`timedDurationMs` 等字段全链路计算但无任何读取方 | `usage.js:143,750,1337` |
| SH-8 | P3 | 死代码 | 文档描述的 DeviceState↔limits 组合不可达，stub 恒返回空 | `deviceState.js:130`、`deviceRuntime.js:88` |
| LD-13/LD-14 | P3 | 潜在死锁 | `orderedSink`、`limitsRuntime` 为埋雷型死锁（当前无调用方） | `orderedSink.js:87`、`limitsRuntime.js:429` |
| AN-15~AN-20 | P3 | 配置·死代码 | Android 测试任务被禁用（假绿）、versionCode 可碰撞、未用依赖等 | 见 §7 |
| WS-9 | P3 | 仓库卫生 | 根目录多份历史审计/计划文档已过期 | 仓库根目录 |

---

## 三、审计方法与基线

### 3.1 自动化测试基线

```
node --test "tests/**/*.test.js"
tests 2505 | pass 2499 | fail 1 | skipped 5 | duration ~42.7s
```

唯一失败项：

```
tests/shared/sessionUsageArchive.test.js:398
✖ reapplies a large session archive without repeatedly normalizing growing periods
  AssertionError: large archive apply took 1127.9ms   (阈值 800ms, tests/shared/sessionUsageArchive.test.js:426)
```

> **诚实说明：** 该失败在 8 路并发审计负载下测得（load ≈ 13.9/8 核）。单独复跑时耗时 308ms，**可以通过**。
> 因此结论是：**该测试阈值偏紧、在负载下会假失败**，而不是稳定的硬失败。但它指向的真实问题（见 LD-1）已被独立实测确认，且比测试暴露的更严重。

### 3.2 实测环境

本机同时在跑两套采集器，恰好构成最坏情况样本：

| 进程 | PID | RSS | CPU | 运行时长 |
|---|---|---|---|---|
| Electron widget 主进程 | 437998 | 415MB | 23.3% | 4天00小时 |
| headless agent | 1683 | 474MB | 20.3% | 4天10小时 |

配置：`hubMode = "client"`、`hubUrl = http://192.168.5.17:17321`、`collectionMode = "live"`、`syncUploadIntervalMs = 0`（不限流）、`sessionUsageArchiveEnabled = true`、`discordRpcEnabled = false`；`agent.pid` = 1683 存活。

真实数据规模：`session-usage-archive.json` **450 会话 / 1.3MB**；`collector-anchor.json` 384KB；`daily-history-archive.json` 51KB。

> 所有性能数字均在 load ≈ 10–14（8 核）下测得，绝对值偏保守/有波动；**但缩放趋势、算法复杂度与调用次数是确定的**，可复现。引用时请以"数量级"为准。

### 3.3 本次审计未发现问题、已确认健康的部分

为避免后续重复排查，以下经核查确认**无问题**：

- **客户端 id 集合完全一致**：`DEFAULT_CLIENTS`(24) / `KNOWN_CLIENTS`(26) 与 Electron 渲染端 `KNOWN_CLIENTS`(26) 完全对齐，无遗漏、无多余。`normalizeClientName()` 对每个已知 id 都是不动点。
- **国际化键完整**：Electron i18n 5 种语言 × 1042 键、Hub 网页 5 种语言 × 272 键，**所有语言键集合完全一致**，无缺失键。
- **后端路径遍历防护正确**：多种 `../`、URL 编码、混合编码探测均返回 404。
- **SSE 背压处理正确**：保留单帧最新待发、45s 无法 drain 才丢弃；连接后立即推送 snapshot，不会白屏等到下一次更新。
- **认证比较是长度安全的**（`hubAuth.secretMatches` 无提前退出）。
- **Android 令牌计数不会整数溢出**（`Long` 而非 `Int`）；图表在空/零/单点/NaN 数据下均提前返回，不崩溃、无无限重组。
- **Android 无硬编码密钥**，无未使用权限，`minSdk 26` 满足所有 API 敏感调用。
- **无重复/泄漏定时器**（模式切换、SSE 重连、orderedSink、上传退避、限流桶增长等）——这些假设**已被证伪**。
- **Electron 打包未包含 `src/hub/**`**（`build.files` 正确限定为 `src/electron`、`src/shared`、图标、package.json）。
- **`dist/`、`tmp/`、`build/` 均正确 gitignore**，无构建产物被误提交。

---

## 四、P0 问题详解（根因与实测）

### P0-0 · 桌面端渲染进程启动即崩溃：界面永久空白（RD-1）

> **这是最严重的一个问题，且它不在"性能"范畴——它让桌面端界面完全不可用。**
> 运行中的 rev.19 构建**没有**这个问题（能正常显示），但**当前源码（rev.38）有**，因此**下一次发布必然带上**。

**证据链**：

```
src/electron/renderer/app.js:273   saveSettingsButton: document.getElementById('saveSettingsButton'),
src/electron/renderer/app.js:7514  els.saveSettingsButton.addEventListener('click', async () => {
src/electron/renderer/index.html   全仓库搜索：无 id="saveSettingsButton"
```

三重独立验证：

```
1) grep -rn "saveSettingsButton"（排除 node_modules/.git/dist）：
     仅命中 app.js:273（els 映射）与 app.js:7514（addEventListener）——index.html 无该元素
2) 打包产物 dist/linux-unpacked/resources/app.asar：
     contains "saveSettingsButton"      → true
     contains id="saveSettingsButton"   → false      ← 每个界面元素引用都命中这个断言
3) 已发布的 rev.19（~/.local/share/token-monitor/rev19-root/.../app.asar）：
     contains "saveSettingsButton"      → true
     contains id="saveSettingsButton"   → true       ← rev.19 能正常启动的原因
```

**为什么一崩到底**：第 7514 行是**顶层语句**（列 0，`app.js` 全文件无 IIFE、无顶层 try、无 `DOMContentLoaded` 包裹）。`getElementById` 返回 `null`，`.addEventListener` 抛 `TypeError`，脚本求值在此终止。位于其后的 **1912 行全部不执行**，包括：

| 行号 | 被跳过的内容 |
|---|---|
| 7534 | Hub 模式单选按钮（local/client 切换） |
| 7587-7594 | 限额显示相关开关 |
| 7661-7676 | 玻璃/深度/缩放滑块 |
| 7715-7733 | 主题、托盘模式、浮动气泡等外观设置 |
| 7782-7797 | 打开配置目录、刷新、最小化、**关闭按钮** |
| 7807-7815 | 浮动气泡拖拽 |
| 7798-7801 | Trends 面板交互 |
| 7838-7857 | 应用更新提示按钮 |
| **7940** | **`window.tokenMonitor.onStatsPush(...)` —— 实时数据订阅** |
| 9383 | `initSettingsAnimationWrappers()` |
| **9426** | **`init()` —— 全部初始化** |

**用户可见后果**：窗口只显示 `index.html` 的静态默认值——标题栏 "Starting"、总量 `0`、所有面板空白，**永远不动**；刷新/关闭/最小化、设置开关、浮动气泡、托盘自定义全部失效；界面上没有任何错误提示（异常只落在 DevTools 控制台，而用户看不到）。主进程的采集器仍在跑（所以托盘数字和 CPU 占用看起来"正常"），这会让问题被误判为"卡住"而不是"崩了"。

**修复**（改动极小，风险极低）：

```js
// src/electron/renderer/app.js:7514
els.saveSettingsButton?.addEventListener('click', async () => { ... });
```

并按 RD-4 的结论决定该面板的持久化方式（见 §7.4）。**同时必须处理第二个同类地雷**：`app.js:5972` 的 `els.deviceIdInput.value = ...` 同样未加守卫（`deviceIdInput` 也已不在 `index.html` 中），否则修好启动后会在第一次设置推送/初始化时再次崩溃。系统性自查结论：`els` 映射共 194 项，其中**恰好只有 `deviceIdInput` 与 `saveSettingsButton` 两项**对应的 id 不存在于 `index.html`，而**只有 `saveSettingsButton` 一处**是未加守卫的顶层解引用。

**回归防护**：新增测试，断言 `els` 映射中每一项 id 都能在 `index.html`（或 `dashboard.html`）中找到，且渲染进程启动路径无未守卫的顶层 `els.*` 解引用。这类"重构删了 DOM、JS 没跟着删"的漂移已经发生过一次，必须有测试兜住。

---

### P0-1 · 每 tick 反复全量重算 session 归档

**这是"用一段时间就变卡"的第一主因，且随使用时间线性恶化。**

**调用链**（每个 tick 都会走）：

```
collector.js:3272   onUpdate?.(summary, reason)          ← watch tick 也触发（debounce 1500ms）
  → deviceRuntime.js:50  transformUsage(...)
    → main.js:1272 / agent.js:94  syncSummaryTransformer.transform()
      → syncSummary.js:111  captureSessionUsageArchive()   ← 内部再 normalize 全量
      → syncSummary.js:112  JSON.stringify(新) vs JSON.stringify(旧)   ← 全量序列化两次
      → syncSummary.js:128  applySyncSummaryTransform()
        → sessionUsageArchive.js:273  normalizeSessionUsageArchive(archive)  ← 又 normalize 全量
```

**根因**：`sessionKey()` 为了得到一个 `client:id` 字符串，构造了一个完整的合成 period 并跑整套 `normalizePeriod`：

```js
// src/shared/sessionUsageArchive.js:54-62
function sessionKey(client, sessionId) {
  const normalized = normalizePeriod({
    sessions: { candidate: { client, sessionId, totalTokens: 1 } }
  });
  const session = Object.values(normalized.sessions)[0];
  return session ? `${session.client}:${session.sessionId}` : null;
}
```

该函数在 `normalizeSessionUsageArchive` 与 `captureSessionUsageArchive` 中按 session × period 调用（450 会话 ≈ 1350 次/轮），而它每个 tick 被调用两轮。

**实测（本机真实归档，450 会话）**：

| 阶段 | 耗时 |
|---|---|
| `normalizeSessionUsageArchive` | 102–122 ms |
| `captureSessionUsageArchive` | 152 ms |
| `applySessionUsageArchive` | 305 ms |
| `JSON.stringify` ×2（变更检测） | 28 ms |
| **端到端 `transform()` 单次** | **283–687 ms** |

**`sessionKey` 开销专项对照实验**（1350 次调用）：

```
现状（1350× normalizePeriod）：59.5 ms
纯字符串等价实现            ： 1.03 ms
=> 58 倍开销
```

**缩放曲线**（合成归档，相同结构）：

| 会话数 | normalize 单次 | 完整 transform |
|---|---|---|
| 450 | 77 ms | 83 ms |
| 1000 | 119 ms | 120 ms |
| 4000 | 296 ms | 874 ms |
| 8000 | 607 ms | 1143 ms |

**为什么它会随时间恶化**：归档每条 AI 会话新增一项，永不封顶（代码注释自己承认：`localSessions.js:3` "`allTime.sessions` is an unbounded, ever-growing collection"）。本机 34 天累积 450 会话（约 13/天），按此速度：

- 约 2.5 个月 → 1000 会话 → 每 tick 阻塞 >1.5 秒（= debounce 间隔，循环再也追不上）
- 约 5 个月 → 2000 会话 → 每 tick 约 3 秒 → **永久冻结**
- 重度用户（50 会话/天）→ **约 3 周**即跨过 1000

**触发的直接现象**：Electron 主进程被同步阻塞 → 窗口、托盘、IPC、SSE 全部卡住；CPU 持续高位；RSS 锯齿状冲到 1GB。这与"用一段时间就卡、高负载后恢复不过来"完全吻合。

**附带同源问题**：`deviceState.publish()` 每次发布对整条记录（含全部 session）做 **3 次深拷贝**（`deviceState.js:111,116,117`），450 会话实测 **164ms**；`applyPeriodDelta` 每 tick 递归整个 `allTime` 键并集。

---

### P0-2 · 同一机器上两个完整采集器并行运行

**`isExternalAgentActive()` 只拦住了上传，没有拦住采集。**

```js
// src/electron/main.js:1657  无条件创建完整采集运行时
function startSyncCollector() {
  stopSyncCollector();
  ...
  deviceRuntimeHandle = createDeviceRuntime({
    transformUsage: summaryWithArchivedClientUsage,
    usageOptions: electronUsageConfig('sync-collector'),   // ← 完整采集配置
    sink: syncUploadSink,
```

`isExternalAgentActive()` 仅在以下位置生效：上传前（`main.js:1688`）、归档写入（`:451`、`:1264`、`:1267`）——**都不在采集链路上**。`startMode()` 只要 `hubMode === 'client'` 就启动它（`main.js:2590`）。

**实测证据**：两个进程都在 spawn 完全相同的 tokscale 扫描：

```
WIDGET  pid=1019671 ppid=437998 : tokscale --json --client antigravity,antigravity-cli --group-by client,session,model --today
AGENT   pid=1019956 ppid=1683   : tokscale --json --client antigravity,antigravity-cli --group-by client,session,model --today
```

**代价**（60 秒 `/proc` 采样）：

```
agent + widget 合计 = 102.4 CPU秒 = 170% 单核
其中仅 8.6 秒与 tokscale 子进程存在时间重叠
=> 92% 的 CPU 是 JS 自耗，不是扫描
```

各自还维护一套 chokidar 监听（2s 轮询 → 双倍 stat 风暴），并且都往同一个 `collector-anchor.json` 做**非原子写**（`collector.js:3233` 用裸 `fs.writeFileSync`），可能互相读到截断文件 → 触发昂贵全量重扫。

同时 `syncUploadIntervalMs = 0` 意味着不限流，每次 tick 都会上传。

---

### P0-3 · Hub 每次 ingest 全量重算整个集群统计

```js
// src/hub/server.js:721-723
if (includeStats || sseClients.size > 0 || statsListeners.size > 0) {
  stats = await getStats();          // ← 全量：读所有设备快照 + 归一化 + 聚合 + 全历史哈希
  await broadcastStats('ingest', stats);
}
```

只要**有任意一个 SSE 消费者**（client 模式 widget 必定持有一个），每次设备上传都会触发一次全集群重算。而 `getStats()` 内部：

- `store.listDeviceRecords()` — 读取**每台设备**的完整快照（含全部 history）
- `aggregateDevices()` — 再次 `normalizeDeviceRecord` 每台设备
- `aggregateHistory()` — **又** `normalizeDeviceRecord` 每台设备（同一请求内每设备归一化 2 次）
- `deviceHistoryRevision()` — 对**每台设备的全部 history** 做键排序 + FNV 哈希（`history.js:507-530,540`）

**实测单次 `/api/stats` 阻塞时间**：

| 设备数 | aggregateDevices | aggregateHistory | JSON | 合计 |
|---|---|---|---|---|
| 1 | 11.4 ms | 4.3 ms | 0.5 ms | ~16 ms |
| 5 | 65.0 ms | 12.9 ms | 2.4 ms | ~80 ms |
| 20 | 174.0 ms | 79.5 ms | 12.7 ms | **~266 ms** |

外部审计独立实测更大规模：**76ms(D=1) → 225ms(D=5) → 656ms(D=20) → 1564ms(D=50)**。

**`statsCache` 是死代码**——已确认它被写入、被清空，但**从未被任何路由读取**：

```js
let statsCache = null;            // server.js:369
statsCache = stats;               // server.js:396   ← 只写
statsCache = null;                // server.js:719,756,766  ← 只清
getCachedStats: () => statsCache  // server.js:1315  ← 唯一"读"，但无调用方
```

也就是说：**代码里已经预留了缓存位置，却从未接上**，导致每次请求都全量重算。

**为什么这解释了"网页端卡住"**：整个 Node 是单线程，这 266ms–1564ms 的同步计算会阻塞**所有**请求，包括 SSE 心跳和其他设备的 ingest，于是各端超时重试，造成自我强化的拥塞。

---

### P0-4 · Hub limits 刷新全局 latch 无超时 → 限额永久停更

```js
// src/hub/accountService.js:581-582
if (refreshPromise) return refreshPromise;      // ← 全局单例 latch
refreshPromise = (async () => {
  ...
}).catch(...).finally(() => { refreshPromise = null; });   // :611 仅在 settle 时清除
```

而 probe 调用**没有任何超时或 signal**：

```js
// src/hub/accountService.js:452-456
const probeDeps = { fetch: oauthFetch, ...runtime };
const result = await probe(account.provider, providerOptions(account, candidate), {}, probeDeps);
```

已确认 `runWithProbeDeadline` / `providerPhysicalBoundMs` 在 `src/hub/` 下**零引用**。`opencodeWeb.js:190`、`thirdPartyLimits.js:457`、`openrouterLimits.js:54` 都只依赖调用方传入的 signal，而 Hub 侧是 `undefined`——它们的唯一上界是 undici 的 300 秒**不活动**超时，对"缓慢滴字节"的对端无效。

**后果**：一旦某个 provider 请求永不 settle，`refreshPromise` 永不清除，此后每个 5 分钟定时 tick 都返回这个死 promise，**所有账户的限额刷新静默停止**，而进程看起来完全健康（无错误、无日志、account 状态卡在 `refreshing`）。**只有重启能恢复**——这正是"高负载后无法恢复"的最清晰样本。

---

### P0-5 · Hub SSE 客户端在注册前 await，断连即永久泄漏

```js
// src/hub/server.js:1108-1130
const snapshot = await getStats();      // ← 先 await（可能数百 ms～1.5s）
res.writeHead(200, {...});
sseClients.add(res);                    // ← 之后才注册
sseStates.set(res, {...});
const heartbeat = setInterval(...);
sseHeartbeats.set(res, heartbeat);
const cleanup = () => dropSseClient(res);
req.on('close', cleanup);               // ← 之后才订阅 close
req.on('error', cleanup);
```

Node 的 `close` 只触发一次。若客户端在 `await getStats()` 期间断开，注册与订阅都发生在断连之后 → 该连接**永远留在 `sseClients` 里**；而且往死 socket 写入返回 `true`，45s drain 定时器也不会启动。

探针实测（Node 24）：**1500/1500** 个中止连接全部滞留，每个约 5.4KB + 一个定时器，只有 `stop()` 才回收。

**这是自我强化的**：每个重连的泄漏概率 ≈ `getStats()` 耗时 ÷ 客户端重连间隔，而 `getStats()` 越慢（P0-3）泄漏越多 → Hub 越慢。约 1.9 万个孤儿 ≈ 100MB，只能重启回收。

---

## 五、跨端一致性（网页端 / 桌面端 / 移动端 功能与机制不统一）

这是用户明确关心的第二类问题。总体判断：**三端不是共用一套显示契约，而是各自实现**，因此已经出现真实漂移。以下为逐项核对结果。

### 5.1 客户端 id 一致性：Android 缺 3 个

后端 `normalizeClientName()` 必然产出的 id 中，Android `ClientBranding.labels` **缺失 3 个**，会直接显示原始英文 id 且没有品牌色：

| 缺失 id | 后端来源 | Android 后果 | 桌面端是否有 |
|---|---|---|---|
| `commandcode` | `usage.js:186`，在 `DEFAULT_CLIENTS` 内 | 显示 `commandcode` | 有：`Command Code` |
| `qodercn` | `usage.js:194`，opt-in | 显示 `qodercn` | 有：`Qoder CN` |
| `reasonix` | `usage.js:195`，在 `DEFAULT_CLIENTS` 内 | 显示 `reasonix` | 有：`Reasonix` |

> Electron 渲染端与 Hub 网页端的客户端 id **完全对齐**（26/26），问题只在 Android。

反过来，Android 表里有 **16 个不是客户端 id 的条目**（`xiaomi, mimo, minimax, doubao, ollama, moonshot, xai, meta, mistral, zai, zaiteam, cohere, volcengine, qoder, openrouter, deepseek`）——这些是模型厂商/限额 provider id，`normalizeClientName` 永不返回，属于无效条目，且可能掩盖真正缺失的 id。

### 5.2 限额 provider 一致性：Android 缺 2 个

后端 `LIMIT_PROVIDER_IDS` 共 20 个，Android 只标注 18 个：

| 缺失 provider | Android 后果 | 网页端是否有 |
|---|---|---|
| `commandcode` | 显示 `Commandcode` | 有 |
| `thirdparty` | 显示 `Thirdparty` | 有：`Third-party` |

另外标签文案本身也不统一：Android `copilot → "Copilot"` vs 网页 `"GitHub Copilot"`；Android `zai/zaiteam → "Z.ai"/"Z.ai Team"` vs 网页 `"GLM"/"GLM Team"`；Android `minimax → "MiniMax"` vs 网页 `"Minimax"`。

**状态与窗口类型覆盖也不一致**：后端状态有 8 种（`ok/disabled/notConfigured/unauthorized/rateLimited/sourceRateLimited/unavailable/error`），Android 只标注 `ok`，其余直接打印英文原文；后端窗口类型有 5 种（`session/weekly/billing/named/credits`），Android 只标注前 3 种。

### 5.3 数值与语义口径不一致

| 维度 | 桌面端 / 网页端 | Android | 后果 |
|---|---|---|---|
| 货币 | 跟随用户偏好（USD/TWD/HKD/CNY） | 恒为 `US$` | 同一笔成本两端显示不同货币 |
| "今日"语义 | 有过期判定 | 直接当实时数据展示 | 过期快照被读作"今天" |
| 数据新鲜度 | 有 stale 标记 | `staleAfterMs` 声明了但**从未使用** | 设备已停报仍显示"在线" |
| 模型拆分 | 精确值 | 缺失时静默用 token 比例**估算** | 估算值被当作权威值展示 |
| 历史窗口 | 370 天全量 | `/api/history` 失败时用 30 天 preview 冒充 | 同一 Hub 两个页面统计口径不同 |
| 限额新鲜度 | 有 per-provider `stale` | 恒显示"更新 N 分钟前" | 限额可能已数小时未更新 |

### 5.4 各端未被消费的线上字段（实现了但白做）

以下字段由后端计算并通过线上协议传输，但**没有任何客户端读取**：

- `timedTokens` / `timedOutputTokens` / `timedDurationMs` —— 全链路计算、归一化、合并、增量推导、上传，但除自身与测试外无读取方（`usage.js:143,750,1337`）
- `qoderCnDiagnostics` —— 采集、附加、保留，无读取方
- `carryDeviceHistory` —— 导出但无调用方
- Android 丢弃的字段：`periodWindows`、`ageMs`、`trackedClients`、`syncUploadIntervalMs`、各 `*Omitted/*Incomplete`、`historyRevision`、`deviceHistoryRevision`、`subscriptionsUpdatedAt`、`windows[].currency/value`、`sessions[].modelCosts`
- 文档未记载的第三个 range `source` 值 `live_snapshot`，Android 会原样打印"数据来源：live_snapshot"

### 5.5 同一语义存在两套实现（已漂移）

- `syncUploadIntervalMs`：生产者（`syncUploadScheduler.js:13-18`）接受 0–24 小时任意值；消费者（`syncUploadInterval.js:3-19`）只认 `{0, 10min, 20min, 30min}` 四个值。配置 15 分钟 → 读侧归一化为 0 → 按 10 分钟基准判 stale → **每个周期最后 1/3 时间设备被误标为离线**。
- 日期窗口语义：同一文件内并存两套约定——设备本地日（`localDayKey`/`isPeriodExpired`）与 UTC 日（`shouldPreservePeriod` 用的 `utcDayKey`），见 P2/SH-6。
- 客户端标签/颜色表在 5 处各存一份且**已经漂移**：Hub 两张表缺 `commandcode`/`deepseek-harness`/`qodercn`/`reasonix`；`openrouter` 颜色 `#6566F1` vs `#6b57ff`。

---

## 六、打包体积与无效代码

### 6.1 诚实的结论（与"打包了很多没用的代码"这一假设的对照）

对 **Electron 安装包**而言，无效代码**不是**主要成本。实测 app 载荷 46.9MB（app.asar 17.69MB + app.asar.unpacked 29.17MB），其中 25.85MB 是必需的 tokscale 二进制；139MB AppImage / 109MB deb 主要由 221MB 的 Electron 框架 + tokscale 构成。可移除部分约 8.9MB 原始 / 2MB gzip。

**真正浪费大的是 Docker 镜像和 headless 安装**。

代码重复率也很低：`src/` 下 76,827 行 JS 中，≥8 行的重复片段共 883 行 = **1.15%**。此前担心的"渲染端与网页端大段分叉"**不成立**（160 组跨文件比对中只有 1 组超过 8 行）。真实问题是**关键小函数的重复与漂移**，而非体量。

### 6.2 Docker 镜像：node_modules 85% 是死重

`npm ci --omit=dev` 安装 47.9MB / 57 个包，但从 `src/hub/server.js` 出发的真实闭包只需要 6 个包 = **7.3MB**，**40.5MB 从未被 require**：

| 无用包 | 大小 | 为什么在里面 |
|---|---|---|
| `@tokscale/cli-linux-x64-gnu` | **25.85 MB** | 仅客户端使用；`grep -rn tokscale src/hub/` 只有注释 |
| `discord-api-types` | 3.52 MB | Discord RPC，仅 Electron |
| `@types/node` | 2.54 MB | mysql2 的非可选 peerDependency（生产装 TypeScript 类型定义） |
| `tar` | 2.30 MB | 仅更新器/打包用 |
| `@discordjs/rest` | 1.98 MB | 同上 |
| `@vladfrangu/async_event_emitter` | 1.10 MB | 同上 |
| `js-yaml` + `electron-updater` | 1.62 MB | 仅客户端 |

该二进制压缩后 24.65MB → gzip 10.00MB，**仅此一项就能给镜像层减掉约 10MB**。

### 6.3 headless agent 安装：每台机器 22.8MB 无用

安装说明让用户执行 `npm ci --omit=dev`：agent 真实闭包 = 25.0MB，实装 = **47.8MB，22.8MB 从不 require**。另外 `src/shared` 整目录复制：**115 个文件中 67 个（844,785 字节）从 `agent.js` 不可达**。

### 6.4 Electron 启动期无效开销

`main.js:114` 无条件 `require('./discordRpc')`，而该模块首行就 `require('@xhayper/discord-rpc')`——**默认关闭**的功能（`main.js:340` `discordRpcEnabled: false`）在每次启动都要付出解析代价。实测中位数：

```
@xhayper/discord-rpc  242.7 ms / 170 modules   （独立冷启 517ms）
electron-updater      133.8 ms / 159 modules
undici                100.5 ms
semver 27.4 / tar 20.9 / chokidar 10.9 / koffi 10.5 / dotenv 4.1
合计约 585 ms eager require
```

修复只需把 require 移进 `startDiscordRpc()` 内部（一行改动）。

### 6.5 其他

- **source map 进包**：739 个 `.map` 文件共 4.97MB（gzip 1.25MB）打进 app.asar，另有 1.24MB 文档/C++ 头文件。
- **`mysql2` 是客户端依赖但只有 Hub 用**：`grep -rn mysql2 src/` 仅命中 `src/hub/repository.js:3`，而 `src/hub/**` 已被排除出 Electron 包——但 electron-builder 仍因它是 `dependencies` 而打包，1.41MB / 11 个包。
- **磁盘**：工作区 4.3GB，其中约 3.7GB 可再生——`dist/` 1.6GB（含 rev.21/24/27 陈旧安装包共 846.9MB，而 HEAD 已是 rev.38）、`tmp/` 1.7GB（`tmp/mysql-runtime` 占 1.1GB）、`android/app/build` 429MB。全部已正确 gitignore（0 个被跟踪文件）。
- **逐字节重复的已跟踪文件 2.72MB**：`assets/icon.png` == `assets/icon-win.png` == Android `ic_launcher.png`（各 981,278 字节，md5 `893ce4c6…`）；`site/assets/app.png` == `.github/assets/app.png`（487,269 字节）；Hub `icon-512.png` == `icon-512-maskable.png` 等。共 45 组 / 63 个冗余文件。
- **状态文件 2 空格美化**：`session-usage-archive.json` 美化后 1282KB，紧凑后 819KB，**多出 36%**；`daily-history-archive.json` 多出 34%。这些文件**每次 tick 都要序列化**，直接放大 P0-1 的成本。

---

---

## 七、P1 / P2 / P3 问题明细

### 7.0 桌面端渲染进程（`src/electron/renderer/`）

> P0-0 是渲染端最严重的问题；**下列问题在 P0-0 修复后才会显形**，但静态代码层面的问题（一致性、死代码、CSS）现在就已经存在。

**阻断级（P1）**

- **RD-4 · Hub URL / secret / 允许不安全 HTTP 三个输入框永远无法保存。** 唯一的写入点在**永远不会注册**的处理器里（`app.js:7516-7519`，即 P0-0 那一处）。`grep "hubUrl" app.js` 除 `els` 映射外只剩读取（1922、1978、5970）。`index.html:542-550` 有 `#hubUrlInput`/`#secretInput`/`#allowInsecureHubHttpInput`，但该区域**没有任何保存按钮**。结果：**桌面端无法从自己的界面指向一个 Hub**，只能手改 `settings.json`；"粘贴密钥"按钮填进一个会被丢弃的字段。修复 P0-0 时**必须一并解决**（恢复保存控件，或对这三个输入改为 `change`/`blur` 自动保存）。
- **RD-3 · 限额 provider `commandcode` 与 `thirdparty` 在桌面端永远无法渲染。** 权威列表 `LIMIT_PROVIDER_IDS` 有 20 个（`shared/limitProviders.js:5-9`），渲染端 `LIMIT_PROVIDERS` 只有 18 个（`app.js:77-96`）。两者都是真实生产者（`limitCollector.js:4281`、`thirdPartyLimits.js:538`）。后果：这两个 provider 的记录被 `orderedLimitProviders` 直接丢弃，在 Limits 视图、Home 限额模块、托盘条形/文字模式里**完全消失**；更糟的是渲染端保存设置时会**把用户存的 20 项列表改写成 18 项**（`normalizeLimitProviderSelection`）。同时缺 `PROVIDER_SOURCE_LABELS`、`CAPABILITY_TAGS` 与 `.limit-icon-<id>` 规则。**Hub 网页端没有这个问题**（它直接遍历载荷），两份实现已经漂移。
- **RD-5 · 无百分比的额度窗口被显示成"已用 100% / 剩余 0%"，并画出满格或空格仪表。** `limitDisplayMode.js:21-30` 对 `remainingPercent` 为 `null` 的情况：`Number(null) === 0` 是有限数，于是 `return 0` 的兜底变成"剩余 0%"；反之"已用"模式给出 100%。实测复现：`limitFillPercent(null, null, true) === 100`、`(null, 40, false) === 0`（应为 60），而 `undefined` 才走对分支。生产者明确用 `null` 表示"没有百分比"（`limits.js:189`，DeepSeek 余额等 `limits.js:416-422`）。**这会把一个资金充足的账户报成已耗尽**——错的数字 + 错的仪表，同时出现在限额面板、Home 卡片和菜单栏。项目自己的 `trayText.js:217-219` 就写着"不能从原始窗口重新推导，否则会得出伪造的 0%"。
- **RD-6 · Hub 账户 provider 下拉框缺 `codex` 与 `antigravity`。** 权威集 `HUB_MANUAL_PROVIDER_IDS` 有 17 个（`limitProviderSources.js:8-12`，`accountService.js:41-46` 强制校验），渲染端 `HUB_ACCOUNT_PROVIDERS` 只有 15 个（`app.js:8959-8975`）；**Hub 网页端是对的（17 个）**。后果：这两个最常用的配额 provider 无法从桌面端添加为 Hub 账户，已存在的账户显示成原始 id。
- **RD-7 · `styles.css` 第 4985 行有一条未闭合的规则 → 从第 4990 行到文件末尾（约 560 行）全部失效。** 括号扫描（剥离注释与字符串后）在文件末尾深度为 **1**，最后一个深度归零的行为 4931。在启用 CSS Nesting 的 Chromium（Electron 43）下，这 560 行会变成**永远无法匹配**的嵌套规则。报废的内容正是**托盘/浮动气泡自定义编排器**的整套样式：`.tray-composer-popover`（定位、宽度、max-height、z-index、背景、`::backdrop`）、全部拖拽/选中/`focus-visible` 状态、以及结尾的 Windows Acrylic 覆盖。**一个字符的修复，视觉收益很大。**

**视觉与可用性（P2）**

- **RD-2 · 仪表盘窗口把不可信的 model 名直接插入 `innerHTML`（未转义）。** `dashboard.js:376` 与 `:593` 直接拼接 `r.key`/`s.key`（来自 `history.daily[].perModel` 的键），**而同一文件第 447 行对同样数据做了转义**。生产端只做长度/小写校验（`wireValidation.js:9`、`history.js:7-10` 仅拦 `__proto__` 等）。已用真实模块复现：`perModel` 键为 `<img src=x onerror=alert(document.domain)>` 时，模板原样产出该 `<img>`。目前 `script-src 'self'` 的内联处理器拦截使其降级为**标记注入/钓鱼**，但若前置代理丢掉该响应头即升级为完整 XSS，而 preload 桥（`preload.js:5-97`）可重指 `hubUrl`、调 `openExternal` 等。
- **RD-8 · 自定义日期范围弹层被 `.shell { overflow: hidden }` 裁剪。** `styles.css:4816-4830` 的 `.custom-range-popover` 是绝对定位、无 `max-height`、无内部滚动，其祖先 `.shell`（`styles.css:80-83`）有 `overflow: hidden` + `clip-path`，而窗口最小可缩到 240×140（`main.js:200`）。缩小窗口后打开日历按钮，下半部分（时间输入与"应用/取消"）**点不到**。
- **RD-9 · 只有一天历史时 Home 趋势图是空白的。** `usageCharts.js:280` 对单点用 `xOf(0) = padLeft + innerW/2`，`areaPath` 退化为 `M150,4 L150,66 L150,66 Z`——SVG 存在（字符串非空）但**什么都不画**。触发场景：全新安装/使用第一天且 Home 的 Trends 模块开启 → 一个 70px 空白框，没有空状态提示。
- **RD-10 · 负的 per-client/per-model 值会破坏柱状堆叠并吞掉当天整根柱子。** `usageCharts.js:108-111` 只在绘制时 `Math.max(0, s.height)`（`:456`），而累计偏移 `cum` 已被负数拖到基线以下，导致其余正值段落被移出 viewBox 裁掉；实测复现 `perClient:{a:{tokens:-500},b:{tokens:100}}` → 段 `a: y=244 h≈-84`（绘图区为 y 8…160），`bar.total = -400`。Hub 侧合并也不夹取（`history.js:431`）。
- **RD-11 · 只要有一行的 `date` 不是合法 ISO 日期，整个 K 线会塌成一根蜡烛。** `usageCharts.js:131,140`：`String(undefined) === 'undefined'` 排最后 → `lastDate` 为 `'undefined'` → 每行桶索引都是 `NaN`（Map 的合法键）→ 全部落进同一桶。兄弟函数（`areaLineChart`、`computeHeatmapIntensities`）都有行级守卫，唯独这个没有。
- **RD-12 · 统计卡宽度均衡器会破坏自己的 `minWidth` 下限。** `usageCharts.js:570-574` 在兜底时对**所有**列等比缩放，包括已经处于下限的列。实测 `statCardColumnWidths([1000,10,10],{totalWidth:600,minWidth:92})` → `[507.5, 46.2, 46.3]`，而 `[416,92,92]` 是可行解 → 本来可读的卡片被压到需要省略号。
- **RD-13 · 货币"手动汇率"单选按钮从未接线。** `app.js:7559` 引用 `els.currencyRateModeManual`，但 `els` 映射（`app.js:273`）**没有这个键**（只有 `currencyRateModeAuto` 与 `currencyRateManualField`），而 `index.html:153` 确实有该 radio → 可选链使其成为静默空操作；手动汇率输入框永远不会显示。一个看起来可交互的控件什么都不做。
- **RD-14 · 缺一个 i18n 键，且 `t(x) || 'fallback'` 这种写法永远不生效。** `i18n.js:5290` 在缺键时返回**键名本身**（真值），所以 `app.js:3214` 的 `t('sessions') || 'Sessions'` 兜底不可达，界面直接显示 `‹ sessions`。完整目录审计：5 语言 × 1042 键，**唯一缺失的键就是 `sessions`**（另有 5 处同样无效的写法，只是它们的键恰好存在）。
- **RD-15 · 每次 stats 推送都整块重建 Home 面板（约 711 节点的 SVG）、工具列表与托盘图标。** `app.js:7940-7976` 的 `onStatsPush` 无条件调用 `render()` / `renderToolPreferences()` / `renderWslPanel()` / `maybeUpdateBarsIcon()`；实测一次 Home 渲染生成 **75.6KB 的 SVG 字符串、含 711 个 `<rect>`**（355 个格子 + 重复的 `heat-bright` 层 + 12 个月份标签）并用 `innerHTML` 重新解析，而热力图数据**一天最多变一次**。`renderToolPreferences` 重建 26 行 × 约 4 个监听器（设置面板通常还是关着的）；`maybeUpdateBarsIcon` 即使 `showTrayIcon === false` 也会重新栅格化托盘图标。采集器在 live 模式下每 3–5 秒推一次。
- **RD-16 · 偏好项拖拽在每个 pointermove 上强制同步布局。** `app.js:6178-6184` 每个事件都 `querySelectorAll` + 逐行 `getBoundingClientRect`，随后立刻 `applyPreferenceOrder()` 改动 DOM 使布局失效 → 下次 move 又要重新测量，26–38 行列表下每次移动约 26–38 次强制布局。
- **RD-17 · 拖拽排序后展开的子面板会"掉队"。** `app.js:6186-6194` 只移动 `[data-view]`/`[data-home-module]` 行，而手风琴子面板是同一列表里的**兄弟节点**（`app.js:6357-6360` 等）→ 展开的面板留在原位，其控件出现在无关行下面，直到下次整体重渲染。
- **RD-18 · 生成的托盘图标被硬编码为黑色，在深色任务栏上不可见。** `app.js:8098-8101` 默认 `fillColor: 'rgba(0,0,0,1)'`，唯一生产调用方（`app.js:8683`）不传颜色；macOS 会走模板图像，但 Windows/Linux 用的是原始位图。为此专门写的 `trayGeneratedIconColors()` / `trayProviderGlyphInk()`（`shared/trayText.js:42-62`，**且有测试覆盖**）在 `src/` 下**零调用方**。
- **RD-19 · 浅色主题沿用深色语义色与多处硬编码浅色值。** `themePresets.js:248-258` 只翻转 surface 类变量，未重新产出 `--yellow/--blue/--orange/--red`（`styles.css:45-50` 是深色值）→ `.usage-estimate`（`styles.css:2171`）在浅色面板上对比度约 **1.4:1**；另有硬编码 `#ffd8d8`（≈1.3:1）、`#bda5f5`（≈2.1:1）以及浅色下会消失的 `rgba(255,255,255,0.12)` 分隔线。
- **RD-20 / RD-21 / RD-22 · 可访问性缺陷。** 折叠的设置面板只用 `opacity:0` + 0 高度隐藏，**仍在 Tab 顺序里**（`styles.css:575-582`、`:918-922`；全文件仅 `app.js:7693` 一处用了 `inert`）→ 键盘用户会 Tab 进数百个不可见控件；`styles.css:67` 全局 `button:focus, button:focus-visible { outline: none }` 且未给 `.icon-button`/`.tab`/`.refresh-button`/范围滑块（其 `border` 被显式置 0）补可见焦点；`dashboard.css` **完全没有** focus 规则；`.actions-hotspot`（`:326-333`，`z-index: 5`）覆盖在 `.window-actions`（`:334-348`，`z-index: 4`）之上且无任何点击处理器，**吞掉关闭按钮右上角约 16×8px 的点击**。

**死代码（P3）**

- **RD-23 · 1042 个 i18n 键中 350 个（33.6%）无人引用**，其中包括整族已删除的 provider 凭据面板（`settings.mimo.*` 34 个、`settings.opencode.*` 31 个、`settings.codex.*` 28 个、`settings.qoder.*` 25 个、`settings.sync.*` 23 个……），以及 `settings.common.save`、`settings.sync.deviceId` 这类属于已移除控件的键——正是 P0-0 / RD-4 的另一面。
- **RD-24 · 大量死 CSS**（与 WS-10 同源，合计 80 条规则 / 11,323 B = 文件的 7.09%，计入级联失效则 14,205 B = 8.89%）：`.opencode-profile-*`/`.profile-*`（23 条）、`.limit-account-switch-*`（11 条）、`.limit-provider-tag-*`（16 条，另有测试 `tests/electron/serviceStatusDom.test.js:245` 反向断言其**不应**出现）、`.codex-login-*`、`.kimi-cookie-steps*`、`.mode-button` 等。**已核验为活代码、不要删**：`.row-icon-*`(44) 与 `.limit-icon-*`(18) 与 `clientsWithIcon` 构成**精确双射**、两个 `@keyframes` 均被使用。
- **RD-25 / RD-26 / RD-28 / RD-29 / RD-31 · 无效导出与不可达分支**：`limitProviderPresentation.js` 的 4 个导出（其中 `CAPABILITY_TAGS` 产出的 `'App/CLI RPC'` 等**不在** `app.js:147-190` 的 i18n 键里，一旦接回就会渲染未翻译英文）、`usageCharts.weekStartKey`、`themePresets.systemThemeColors`、`homeOverview.historyPreviewKey` 等无生产调用方；`limitProviderPresentation.js:234` 的 `kimi` 分支不可达（前面已 return）；`styles.css` 三处 `var(--fg)` **全项目未定义**（`--fg` 无声明，`var()` 无 fallback 在计算值阶段失效）→ `styles.css:3162` 的 provider 行 hover 反馈因此是空操作；`app.js:4814` / `:6268` 写入的 dataset 键无任何读取方；`app.js:9389-9398` 查询 10 个已不存在的 `*ManualPanel` id。
- **RD-27 / RD-30 · 细节**：`html, body { user-select: none }`（`styles.css:63-64`）使导出目录路径（`index.html:408`，纯 span）**无法选中复制**；`app.js:5210` 的外观预览补丁缺少 `windowBehavior`，导致拖动滑块时 `desktop-mode` 类被移除、窗口短暂变成可拖拽。
- **RD-15 之外的定时器结论（已核验无泄漏）**：全渲染进程只有 2 个定时器，均有清理；两个 `ResizeObserver` 创建一次或在重建前断开；`rowRenderFingerprints` 是 `WeakMap`，无 DOM 泄漏。**"渲染端定时器重复注册"这一假设已证伪。**

**补充发现（RD-32 ~ RD-39，均已逐行核验）**

- **RD-32（P2）· 限额状态文案硬编码英文，尽管翻译键已存在。** `app.js:1909-1919` 的 `limitStatusLabel()` 返回 `'Live'/'Disabled'/'Not signed in'/'No synced data'/'Sign in again'/'Limited'/'Usage API limited'/'Unavailable'/'Error'`，其中除 `'Not signed in'` 外**全部**已在 `LIMIT_CAPABILITY_TAG_KEYS`（`app.js:147-189`）里有对应键，但 `translatedLimitCapabilityTag()` **只**应用在 `planLabel`/`accountLabel`（`:1955`），从未应用到状态文案 → 非英文语言下限额视图里出现一整列英文状态（而这正是新装机器上大多数 provider 的默认状态）。
- **RD-34（P2）· Home 限额模块绕过"隐藏账户邮箱"设置。** `app.js:3695-3699` 的兜底直接返回 `provider.accountEmail`，而相邻路径（`app.js:2815-2820` 与托盘 `:8633-8638`）都遵守 `maskLimitAccountEmails` → 用户明确开启了遮蔽，Home 限额卡里**仍然显示原始邮箱**。（代码路径与设置不对称已确认；多账户数据前提为推断。）
- **RD-35（P2）· 视图切换菜单每次 stats tick 都被重建，导致键盘导航中途失效。** `app.js:4320` 在 `render()` 里无条件调用 `renderViewSwitcher()`，而 `:3647` 用 `replaceChildren` 替换整棵子树（含已打开的菜单）；菜单的 roving-tabindex 处理器挂在**被丢弃的元素**上 → 打开菜单后等一个 tick（live 模式 3–5 秒）再按方向键就没有反应，Escape 也不再关闭。
- **RD-39（P3）· 设备行与手风琴约每分钟被重建一次。** `app.js:1784` 把 `deviceSyncedLabel(device.updatedAt)`（渲染成 "Synced 4m ago" → "Synced 5m ago" 这类**随时间变化**的文本）纳入指纹，使本应抑制更新的记忆化每分钟必然失配一次，重新执行 `updateRow` 并重建整个工具/模型手风琴 DOM。修法：指纹改用 `device.updatedAt`/`platform`/`agentVersion`/periods，元信息行单独更新。
- **RD-33 / RD-36 / RD-37 / RD-38（P3）**：`formatUpdatedAge()` 是已本地化的 `compactAge()` 的英文重复实现，且被 `app.js:1936` 用 `.replace('Updated ', '')` 做字符串手术（一旦本地化就会静默失效）；会话详情里的逐轮次展开是**纯鼠标**控件（`app.js:3268-3272` 的 `div` 无 `tabIndex`/`role`/`aria-expanded`/键盘处理，而同类行情有全套）；OpenCode 账户分组的 stale 置灰与另外三个兄弟构建函数不一致（`app.js:2885` vs `:2825`）；`renderLimits()` 里两处 `'disabled'` 兜底不可达（`:2957`、`:2960`，因为上游已按 enabled 过滤）。
- **S-11（已被本次审计证实为真）**：渲染端只从 stats 载荷读 `nativeSessions`/`nativeProjects`（`app.js:1832`、`1847`），而 local 模式经 `aggregateDevices` 会丢弃它们、client 模式经 `composeLocalSyncStats()` 会重新挂回 → **即 §7.1 的 SH-1，渲染端审计独立复现了同一结论。**

### 7.0b Hub 网页端（PWA）

- **HW-1 · Home 设备行存在存储型 HTML 注入（P1）。** `devicePlatformLabel(platform, osName, osVersion)` 在 `src/hub/web/js/app.js:1048` **未转义**插入，而这几个字段（仅 trim+slice，`platform` 无长度限制）来自**任何能 POST /api/ingest 的设备**（`usage.js:926-948`；未配置密钥时 `hubAuth.js:143` 授权全部作用域）。当前被 Hub 自己的 CSP `script-src 'self'` 挡成"仅标记注入"，但若前置代理丢掉该响应头即成完整 XSS。修复：在 `:1048` 用 `escapeHtml()`。
- **HW-2 · 同一个 CSP 让 11 处 `onerror="this.style.display='none'"` 图标兜底全部失效（P2）。** `src/hub/web/js/app.js:645,647,873,999,1071,1151,1230,1448,2366,2393,2403` —— 内联事件处理器被 `script-src 'self'` 拦截，于是图标 404 时显示为破图而不是被隐藏。**与下面的 HW-3 叠加更明显。**
- **HW-3 · 4 个共享客户端 id 在网页端没有任何标签/图标/颜色（P1）。** `commandcode`、`deepseek-harness`、`reasonix`（**三者都在 `DEFAULT_CLIENTS` 内**）与 `qodercn`：显示原始 id，并且**每次重渲染都发一次 404 图标请求**（`sendJson` 带 `cache-control: no-store`，所以不会被缓存）。另有标签/颜色漂移：`grok` 桌面端 "Grok Build" vs 网页 "Grok"；`minimax` "MiniMax" vs "Minimax"；`openrouter` 颜色 `#6566F1` vs `#6b57ff`。**注**：这与 §5.1 的 Android 缺口是**不同的两处**——Electron 渲染端与 Hub 网页端的 **id 集合**是对齐的，缺的是网页端**标签/图标/颜色表**里的条目。
- **HW-4 · 网页端硬编码汇率，不跟随实时汇率（P1）。** `src/hub/web/js/format.js:1-6` 直接写死内置兜底汇率（CNY 6.8 / TWD 31.5 / HKD 7.8），从不应用组件端使用的实时汇率（`exchangeRates.js` + `resolveEffectiveRates` → `main.js:1856` → 渲染端 `configureRates`）→ **同一份 USD 数据在桌面端与网页端换算成不同的 CNY/TWD/HKD 数字**。
- **HW-5 · SSE 无空闲看门狗、无超时、无断点续传（P1）。** 整个网页客户端只有 2 个定时器；半开连接会让 `reader.read()` 永久挂起，而 `src/hub/web/js/api.js:107-108` 在**收到响应头**（尚未收到任何数据帧）时就把状态置为 `'live'` → 界面显示"实时"但数字可能任意陈旧，且界面上**没有任何"最后更新于"时间戳**。**桌面端已经解决了这个问题**（`SSE_IDLE_TIMEOUT_MS = 90s` 看门狗 + `HUB_REQUEST_TIMEOUT_MS = 15s`，`main.js:218,221,1998-2007,2197`），网页端没有对齐。
- **HW-6 · 网页端的"全部"范围实际只有约 12 个月（P1）。** `/api/history` 的 daily 上限 370 天（`history.js:347,456`），而网页端**完全忽略 `history.monthly`**；组件端用 monthly 序列表达 allTime（`usageCharts.js:331-332`）。同时 Home 迷你趋势图被硬编码为"最近 14 个日点"（`app.js:978,1830`），而组件端会跟随所选周期（today→7 天、month→当月、allTime→monthly）。
- **HW-7 · 每帧 stats 都整页 `innerHTML` 重渲染（P2）。** 每次 SSE 帧都会**折叠所有 `<details>`**（`app.js:1242`）并重建设备 `<select>`，导致正在展开的面板被关掉。
- **HW-8 / HW-9 · 错误路径（P2）。** 刷新按钮在有旧数据时会吞掉错误（`app.js:2080` 的 `state.error && !state.stats`，处理器 3653-3670）；`/api/stats` 无超时 → 永久骨架屏。
- **HW-10 · 自定义范围丢弃 `clientModels`/`clientModelCosts`（P2）。** `app.js:3099-3108` → 自定义范围下 Usage→Tools 的模型列表**永远显示 "No usage"**。（与 Android 的 AN-1 是同一类缺陷，两处各犯一次。）
- **HW-11 · PWA 缓存问题（P2）。** `sw.js` 的 stale-while-revalidate 配合服务端 `max-age=3600`，且再验证的 fetch **没有** `cache: 'reload'`；缓存名手工维护；`/index.html` 入缓存前**未检查 `ok`**；`cache.put` 未被 await（worker 被杀可能丢写入）。
- **HW-12 / HW-13 · 口径不一致（P2/P3）。** "uncached input" 的计算桌面端与网页端差一个 `cacheWriteTokens`（桌面端把 cache 写入并进 miss 桶，`electron app.js:1626` vs `data.js:333`）；Token 混合图把 `input` 与它的子项 `cacheRead`/`cacheWrite`/`uncached` 画成 5 根**重叠**的条，份额合计 >100%。
- **HW-14 / HW-15 · i18n 缺陷（P2）。** 多处硬编码英文（Account ID / Enterprise Host / Organization ID / Project ID / Web Access Token / Global / New API / Auto / System / Light / Dark / 'All' / 'Nd'，以及原样透出的 "Failed to fetch"）；`data-i18n-aria`（`index.html:44,58`）从未被应用；`resolveLocale` 把 `zh-HK` 映射到 `zh-CN`，而 `data.js:233` 却把 `zh-hk` 当繁体处理。
- **HW-16 · 设备视图上的周期标签是"假"控件（P2）。** `app.js:1326` 中 `deviceDetailPeriod` 总是胜出，而 `pageMeta`（`app.js:621-626`）却显示被点击的周期 → 页面说明与实际数据不符。
- **HW-17 · 舰队级提示在设备筛选下也照常显示（P2）。** `app.js:355-363` + 908-911：`sessionDetailsOmitted`/`periodProjectsOmitted` 告警与当前设备筛选无关。
- **HW-18 · 限额卡片用 `clientLabel()` 取 provider 名（P2）。** `app.js:1439` → `thirdparty`/`commandcode` 显示原始 id，尽管 `PROVIDER_LABELS` 里**已经有**这两个（只是这条渲染路径没用它）。
- **HW-19 · CSS 缺陷（P3）。** 死的 `.stat-card`/`.row-card`（`app.css:319`）、`.grid-3`（359/1076/1125）、`.badge.critical`（1537）；**真实级联缺陷**：重复的 `:root --font`（28 与 1567）、`.badge.warn` 声明两次且值冲突（513 与 1367）、`.remaining-tone-*`（1532-1535，特异度 0,1,0）被 `.limit-window strong`（496-499，0,1,1）压制 → **限额卡片的语气色从未生效**。
- **HW-20 · 18 个死 i18n 键 × 5 语言（P3）**，以及 `app.js:1429` 不可达的 `kind==='monthly'` 分支（`normalizeWindowKind` 已把 monthly 映射为 billing）。
- **HW-21 · 账户表单密码值在内存中驻留（P3）。** `apiKey`/`cookie`/`accessToken`/`secretAccessKey`/`csrfToken` 保存在 `state.formDrafts` Map 里直到标签页生命周期结束（`app.js:694-727`，不落盘）。
- **HW-22 / HW-23 · 其他（P3）。** `/api/accounts` 返回的权威 `providers` 被丢弃（`app.js:2281`），改用硬编码 `HUB_ACCOUNT_PROVIDERS`（当前 17/17 恰好一致，属漂移隐患）；`pointermove` 处理器每次都 `getBoundingClientRect` 强制布局（`app.js:3210-3243`）。
- **已核验无问题（不要重复排查）**：5 种语言的 328 个键**完全对齐**，无缺失、无 `undefined`；客户端 id 经 `normalizeClientName` 收敛到 `[a-z0-9_-]`，故 `clientIconPath` **不可注入**；无定时器/监听器泄漏（只有 2 个定时器且都有清理）；无无界 DOM/数据增长；图表的 NaN 路径不可达；对抗性数据形状不会让渲染辅助函数抛错。

### 7.0c Electron 主进程与打包

- **EL-1（P2）· Windows + 托盘模式 + 切换"系统玻璃"会留下一个孤儿窗口。** `settings:update` 命中原生材质变化时 `rebuildWindow()`（`main.js:3914-3919`），新窗口以 `show:false` 创建，旧窗口只在**新窗口的 `'show'` 事件**里销毁；但 `loadWindowFile` 的 `reveal()` 在 `settings.trayMode` 为真时直接 return（`main.js:3348`，"保持隐藏直到点击托盘"）→ `'show'` 永不触发，**用户正在看的那个窗口永远不会被销毁**，而 `sendPush`/`pushSettingsToRenderer` 已经指向隐藏的新窗口（`main.js:1819-1821`、`2347-2349`）→ 可见窗口停止更新且不再随失焦隐藏，直到用户点一次托盘图标才恢复。
- **EL-2（P2）· 采集器重启会堆叠并发的 tokscale 扫描。** 任何"使用结构"设置变更（`clients` 勾选框每次点击都保存，`renderer/app.js:7078-7083`）→ `restartDeviceRuntimeForMode()`（`main.js:3926-3927`）→ 新运行时立即 `loop()` 起一次全量扫描；而旧运行时的 `stop()` **只清定时器/监听器，从不杀死进行中的 `tokscale` 子进程**（`collector.js:3640-3649`，子进程只由自己的 120s 超时终结）→ 连点三个工具开关即可留下最多 4 组并发扫描，**正是 `AGENTS.md` 明确要避免的串行化前提被打破**。（无数据完整性问题：`deviceRuntime` 用 `active` 门控 `onUpdate`。）
- **EL-4（P2）· macOS 快照 drain 中的未捕获拒绝 → 主进程错误弹窗反复出现。** `macWidgetPublisher.js:206` 的 `mkdir` 与 `:199` 的 `buildMacWidgetSnapshot` 位于 `:209` 开始的 try **之外**，而 `startDrain()`（`:243-247`）没有 `.catch` → App Group 目录不可写时**每次 stats 推送**都会抛未处理拒绝（Electron 默认弹 "A JavaScript error occurred in the main process"）。同 LD-11（重复发现）：`getHistory()` 在 staleness 检查**之前** await。
- **EL-5（P2）· 模式切换抛错后既无采集器也无重试。** `startMode()` 先同步拆掉两个采集器（`main.js:2578-2581`），启动在 `modeQueue.then` 里，抛错被 `.catch` 只记日志（`2609-2611`），调用方不 await（`3925`），`recoverNow()` 只报 `collector_unavailable` 而不重启（`2796-2814`）→ 结构性缺少恢复路径。
- **EL-6（P2）· 不安全的 HTTP Hub 地址会静默取消模式切换。** `main.js:3790-3792` 在应用 patch 前抛错，而渲染端的 hub 模式单选处理器**没有 try/catch**（`app.js:7534-7538`，与保存按钮路径不同）→ 单选按钮视觉上翻到 Client，但采集仍在本地跑，UI 与实现不一致且无提示。
- **EL-7（P2）· SSE 空闲看门狗 90 秒，超过项目自己记录的 NAT/代理超时。** `SSE_IDLE_TIMEOUT_MS = 90s`（`main.js:218-223`），而 `HUB_STABILITY_PLAN.md:59` 记录移动 NAT/代理空闲超时为 30–60 秒并计划用 45 秒 → 半开链路下最多 90 秒 + 最多 30 秒抖动重连期间，界面一直显示陈旧的 Hub 数字。
- **EL-8（P2）· Windows 浮动气泡每次折叠/展开都重建整个窗口与渲染进程。** `collapseFloatingBubble` → `replaceMainWindow`（`main.js:726-735`）新建 `BrowserWindow` 并完整重载 `index.html`；旧窗口未先隐藏，展开的弹出层会**盖在**新的折叠把手上直到新渲染进程绘制完成（几百 ms，兜底 2.5s）；每次失焦/聚焦都产生一个新渲染进程。（可选功能，默认关闭。）
- **EL-9 / EL-10（P3）· 主线程同步工作。** `session:getDetail` 在主线程同步读取并解析整个 transcript（`main.js:4276-4279`、`sessionDetail.js:339-352`）→ 打开一条会话行会卡住 stats 推送、托盘更新与 SSE 解析；Linux 上托盘上下文菜单**每次 stats 推送**都重建（`main.js:1905` → `tray.js:152-155,170-173`），而只有 Refresh 文案与单选状态会变。
- **EL-11（P3）· 打包实测（基于 rev.27 的 asar，44.13MB / 2262 项）**：`*.map` 源映射 4.90MB（729 个文件）、node_modules markdown 0.46MB、未使用的 mysql2 子树 0.486MB + 专属依赖约 0.76MB、dotenv 0.047MB（**不可达**，因为 `main.js:189` 用 `!app.isPackaged` 门控 `loadDotEnv()`）、koffi 构建源/头文件 1.076MB + glibc 与 musl 两份 `.node`（必有一份无用）、tar 未使用的 ESM 构建 0.993MB、**55 个 Chromium 语言包共 47MB**（界面只支持 5 种语言，`renderer/i18n.js:10-14`）。`package.json:47-58` 没有任何 `!node_modules/**/*.map` 之类的裁剪。
- **EL-12（P3）· `WIN_ICON_PATH` 指向被排除的路径。** `main.js:193` 指向 `build/icons/icon.ico`，而该路径被有效匹配规则排除（`!build{,/**/*}`）→ 打包后的 Windows 版本**总是回退到 981KB 的 PNG**，开发环境却用 .ico（有 `fs.existsSync` 守卫，不会崩）。
- **EL-13（P3）· `hubMode:'client'` 且 Hub URL 为空时流永久空闲。** `startStatsStream` 的 transport-blocked 分支会安排 REST 兜底轮询（`main.js:2142`），但空 URL 分支直接 return，既不重试也不轮询（`2146-2150`）→ 只有改一次 URL 才能复活。
- **EL-14（打包，P1，WS-3）· 每个安装包都带 49 个用不到的 Chromium 语言包。** `dist/linux-unpacked/locales` 有 **55 个文件 / 48,122,070 字节**，而界面只提供 6 个选项（`auto, en, zh-TW, zh-CN, ko, ja`，`renderer/i18n.js:8-15`，其文案来自 `MESSAGES` 而非 Chromium）。保留 `en-US/en-GB/zh-CN/zh-TW/ko/ja` = 3,709,690 字节 → **可移除 42.35MB（zlib-9 后 10.96MB）**，约为 AppImage 的 8–10%，**是整个 asar 浪费量的 4.7 倍**。全仓库搜索 `locales|\.pak` **无任何裁剪逻辑**。
- **EL-S1（需验证，但后果严重）· `dist/latest-linux.yml` 只列了 `.deb`，没有 `.AppImage`。** 该 yml 只有一个 `files:` 条目（`path: Token-Monitor-0.45.0-rev.27.deb`），而 AppImage 是同一棵树下构建的（AppImage mtime 21:17 早于 yml 的 21:20，`updateInfoBuilder.js:166-181` 会合并同一文件的任务，所以一次 `npm run dist:linux` **本应**同时列出两者）。如果发布流程原样上传该文件（`release.yml:123/655`），则 `AppImageUpdater` 的 `findFile(files,'AppImage',…)` 返回 `undefined`、下载抛错 → **AppImage 用户永远无法自动更新**。现有守卫（`verify:release-artifact-names`）只检查"被引用的产物是否存在"，**抓不到这个方向的问题**。需用一次干净的 `npm run dist:linux` 数 `- url:` 条目来确认。

### 7.1 Electron 侧

- **P1 · local 模式丢失 Reasonix 会话视图**（SH-1）。Reasonix 被排除在常规 session 通道之外（`usage.js:507,519`），只通过 `summary.nativeSessions/nativeProjects` 传递（`collector.js:1581-1592`）；而 `aggregateDevices`/`normalizeDeviceRecord` 是字段白名单，会丢弃它们。**同步模式已显式补偿**（`syncDisplayStats.js:47-52` 有注释说明并重新挂回），但**默认的 local 模式没有**（`main.js:1943`）。默认 `hubMode='local'`，因此默认配置下 Reasonix 的会话/项目视图和托盘最近记录都是空的。
- **P1 · 一次不可重试 4xx 后上传永久停止**（SH-3）。`isRetryableUploadFailure` 只认 408/425/429/≥500（`syncUploadScheduler.js:45-51`）；命中其他 4xx 后 `failureCode` 只在成功时清除，且终止路径**不挂任何定时器**（`:312-318`）。widget 有 `flushLatest/retryNow` 可以逃出，但 **headless agent 启动后从不调用**（`agent/runtime.js:72-86` 只在 `--once` 时 flush）。触发场景真实存在：Hub 版本较旧、`MAX_JSON_BODY_BYTES` 更小 → 413 重试仍失败 → 永久停报，只能重启进程。
- **P1 · 超时子进程只发 SIGTERM**（LD-3）。`collector.js:198-214`、`:896-920`、`cursorAuth.js:83-99` 均无 SIGKILL 升级、无 `settled` 标志、无监听器移除、无 `unref()`。若子进程（或其持有管道的孙进程）忽略 SIGTERM：promise 已 reject、tick 继续，但**进程仍活着且 `data` 回调持续向 `stdout` 累积字符串**，同时"同一时刻只有一个 tokscale"的约束被打破 → 负载棘轮式上升、不会自行恢复。
- **P1 · 默认关闭的功能在启动期被加载**（WS-4，见 §6.4）。
- **P2 · WSL 瞬时失败被固化为 anchor**（SH-5）。`wslUsage.js:298-300` 吞掉 per-home 错误返回空 bundle，`collector.js:3266-3269` 却把它当作新 anchor 覆盖，之后 watch tick 一直复用（`:1475-1476`）→ 三张卡片丢失 WSL 份额 5–10 分钟。对比 antigravity 有显式保护（`:1136-1143`）。
- **P2 · `shouldPreservePeriod` 用 UTC 判断本地日**（SH-6）。`usage.js:1051-1059` 用 `utcDayKey(updatedAt)` 比较，而其他所有窗口判定都用设备本地 `periodWindows`。任何非 UTC 时区，当同一本地日跨两个 UTC 日时会跳过保留 → 被停用客户端的历史桶从 Hub 存储中丢失一整天；反过来新本地日早期会把前一天桶带入 → 重复计数。
- **P2 · 两个进程级缓存无上限**（SH-9）。`collector.js:619` `projectPathCache`、`:677` `jsonlTimestampCache` 只增不删，进程生命周期内不淘汰。
- **P2 · `recoverNow()` 40Hz 忙等且不取消已放弃的全量重扫**（LD-10）。`main.js:2849-2851` 最多 800 次唤醒；`Promise.race` 超时后底层三路 tokscale 重扫仍在跑，而恢复逻辑可重入（网络恢复/窗口聚焦都会触发）→ 降级时反而叠加负载。
- **P2 · macOS widget 每次推送都发一次全量 `/api/history` GET**（LD-11）。`macWidgetPublisher.js:191-192` 的 await 在 `:197` 的 sequence/`hasDemand()` 检查**之前**，本应抑制请求的判断跑在请求之后。
- **P3 · anchor 非原子写且被两进程共享**（LD-12）。`collector.js:3230-3233` 裸 `fs.writeFileSync`（项目已有 `writeJsonAtomic` 却没用）；并发读者可能读到截断文件 → 触发全量重扫。另外 `writeJsonAtomic` 用固定 `${filePath}.tmp` 名，两个写者也会互相冲突。

### 7.2 Hub 侧

- **P1 · 连接池无 queueLimit / 无查询超时**（HB-4）。`repository.js:29-42` 只设了 `waitForConnections`/`connectionLimit`/keepAlive。mysql2 的 `queueLimit` 默认 0 = **无限等待队列且无获取超时**；一条被黑洞化的连接（TCP keepalive 在 Linux 上约 2 小时才判定）会长期占用槽位。10 个槽位占满后，`/api/stats`、`/api/ingest`、`/api/history`、`/api/usage/range`、`/api/accounts*` **全部无限挂起且无超时**，而静态文件仍在正常响应 → 表现为"僵而不死"，监控看起来还是健康的。
- **P1 · `uncaughtException` 只记录不退出**（HB-5）。`server.js:1359-1362`（`unhandledRejection` 同）。Node 明确不安全：未捕获异常后继续运行，状态机可能已半完成。Compose 有 `restart: unless-stopped`，本可自愈的重启被换成了静默的带病运行。具体实例：SSE 分支只注册了 `req.on('error')`（`:1129-1130`），没有 `res.on('error')`。
- **P1 · Compose 未配 secret 时网页端完全打不开**（HB-19）。`docker-compose.yml:32` `TOKEN_MONITOR_SECRET: ${TOKEN_MONITOR_SECRET}` 无默认值，而 `.env.example:14` 出厂为空；`resolveBindHost`（`server.js:125-129`）在无密钥时把 `0.0.0.0` 改写成 `127.0.0.1` → **容器内回环**。TLS 守卫（`:364-368`）因为解析后确实是回环而通过，启动成功并打印 `listening on http://127.0.0.1:17321`，但发布端口不可达。`docker compose ps` 显示 running，且 **hub 没有 healthcheck**（只有 mysql 有）。
- **P2 · `limitsOnly` 契约矛盾**（HB-1）。`server.js:702-705` 在 merge 前删掉了 `limitsOnly`，使 `usage.js:1169` 的分支在 Hub 上永远不可达；一个只带 limits 的请求会被当作全量更新落库 → 周期清零、会话删除、账本重复计账。**需要客观说明**：`docs/API.md:216-219` 明确写了这两个字段"仅用于混版本兼容，持久化前会被丢弃"，且当前**没有任何客户端发送 `limitsOnly`**（全仓库仅 4 处引用，均为后端自身）。因此这是**文档与实现自相矛盾的潜在雷**，而非线上正在发生的 P0。
- **P2 · 自定义范围超 370 天静默返回部分值**（HB-6）。`history.js:347` `DEFAULT_CAP_DAYS = 370` 限制了日窗口；`server.js:538-554` 只在"完全没匹配到"时才回退账本，且不返回任何截断标记 → 一年以上的范围被当成完整结果返回，静默少算。
- **P2 · Hub 不重新限制 history 行数**（HB-7）。`wireValidation.js:13` 允许 daily/monthly 各 4096 行，`coerceHistory` 不再收紧；一个合法 1MiB 载荷即可让之后每次统计都变慢（与 P0-3 叠加），且 MySQL 永久保存这些 blob。
- **P2 · `usage_events` 无 `recorded_at` 前导索引且永不清理**（HB-9/LD-9）。`migrations/001:68` 只有 `(device_id, recorded_at)`，而查询谓词是 `WHERE recorded_at >= ? AND < ?` → 无法用上索引，退化为全表扫 + 临时表；表只增不减，`src/`、`scripts/`、`migrations/` 中没有任何保留策略。
- **P2 · `devices` 列是只写副本**（HB-10）。`repository.js:184-205` 把同一条记录写两遍（`devices.*` 与 `device_ingest_state.snapshot_json`），而所有读取路径只用后者；`devices.history` 是 schema 里最大的列却从不被读 → 约 2× 存储与 binlog 放大。
- **P2 · ingest 无数值上界**（HB-11）。`wireValidation.js:165-198` 只校验字符串长度/映射大小/行数。`1e300` 可通过并进入 event/session 行，而目标列是 `BIGINT UNSIGNED`/`DECIMAL(24,10)` → MySQL 严格模式下报 1264 并回滚整个事务，且客户端每次重试都带同样数值 → **该设备永久无法入库**。
- **P2 · 认证失败限流可绕过**（HB-12）。`server.js:867-880` 在 `isTrustProxy` 为假时跳过了 `x-forwarded-for`，**但仍然信任 `cf-connecting-ip`**，并以此作为限流键。实测：40 个各带不同 `cf-connecting-ip` 的错误密钥请求 → 40×401、0×429。同时轮换键还会把其他客户端的计数挤出去（`hubRateLimit.js:9-15` 的 `prune` 淘汰最旧活跃桶）。
- **P2 · 两台机器共用一个 deviceId 会互相覆盖并重复计账**（HB-13）。默认 id 由主机名派生（`config.js:79-81`），upsert 是 last-writer-wins，且 `usage-events.js:179-185` 把更小的累计值当作计数器重置并全额记为新用量 → 克隆的 VM/容器镜像场景下账本超出真实值、设备总量来回跳。
- **P2 · `updatedAt` 不校验**（HB-17）。`usage.js:940` 原样保存；`recordDate` 对垃圾值返回 null；`isPeriodExpired` 在 `!recordedAt` 时 `return false`（`:1412-1425`）→ 该设备的过期周期**永不过期**，陈旧用量被永久计入集群聚合；同时 `shouldPreservePeriod` 在 `!existingDate || !incomingDate` 时返回 false → 切换 trackedClients 时静默丢弃已采集用量。
- **P2 · Compose 未透传 3 个已文档化变量**（HB-18）。`MYSQL_CONNECTION_LIMIT`（`.env.example:54`）、`AGY_OAUTH_CLIENT_SECRET`（`.env.example:32-36`、`docs/configuration.md:58`）、`TOKEN_MONITOR_HUB_CREDENTIAL_KEY`（`.env.example:26-30`、`docs/API.md:28`）都未出现在 `docker-compose.yml` 的 `environment:` 列表 → 在唯一受支持的部署方式下**设置了完全没效果**（连接池调优无效、Google 密钥轮换无效、凭据加密覆盖被静默替换）。
- **P2 · 每次 stats 的 N+1 查询**（HB-16）。`getLimitsSummary()` 先列账户再**逐个**取快照（`accountService.js:416-430`），`getSubscriptions()` 每次重查（`server.js:372-377`）→ 每次统计额外 `2 + 账户数` 次往返。
- **P3 · 响应 2 空格美化**（HB-22）。`http.js:96-104` 对所有 JSON 响应 `JSON.stringify(payload, null, 2)`，实测 590KB 的 stats 响应因此膨胀到 1MB+，且发生在已经阻塞的路径上。
- **P3 · 死代码**（HB-21）。`statsCache`（只写不读）、`statsListeners`/`onStats`（无生产调用方）、`aggregateDevices` 里算出的 `aggregate.limits`（`usage.js:1489`）随即被 `server.js:385-387` 删除/覆盖——一次 O(设备×provider) 计算永远被丢弃。
- **P3 · 路由与错误形状**（HB-20）。已授权的 `HEAD` 返回 404（handler 全是 `req.method === 'GET'`）；`GET /api` 返回 200 HTML（SPA fallback 只排除以 `/api/` 开头，不排除 `/api`）；`decodeURIComponent` 在 try 之外 → `%E0%A4%A` 返回 500 `URI malformed` 而非 400。
- **P3 · 未认证 `/api/health` 信息泄露**（HB-23）。返回 `deviceCount`、`secretRequired` 与完整 `auth.summary`（含 `adminConfigured`、`unifiedSecretConfigured`、`ingestCredentialCount`、legacy 提升标志）。
- **P3 · 自定义范围单请求可读 3 遍设备表**（HB-8）。`getHistory()` → `listDeviceRecords()`；回退路径再 `aggregateUsageRange`，然后 `liveUsageRangeFromDevices` 里又 `getStats()`。

### 7.3 网页端（Hub PWA）

- **P3 · 与桌面端共用同一份显示语义但各自实现**：客户端 id/标签/颜色表在 5 处各存一份且已漂移（§5.5）。Hub 两张表缺 `commandcode`、`deepseek-harness`、`qodercn`、`reasonix`。
- （i18n 键完整性、SSE 首帧、背压、CORS/OPTIONS、路径遍历、MIME 表均已核验**无问题**，见 §3.3。）

### 7.4 Android 侧

- **P1 · 自定义范围显示上一个范围的数字**（AN-1）。`AnalyticsScreen.kt:148-164` 构造的 Custom `PeriodDto` **丢掉了 `clientModels`/`clientModelCosts`**（同文件 `:501-514` 的 `resolvePeriod` 却有）；`HubViewModel.kt:189-193` 失败分支只设 `error`，**从不清空 `customRangeResult`**；进入 Custom 模式也不重置（`:147-161`）。结果：加载范围 A 成功后离线再选范围 B → 新标签配旧数字，而错误提示只是瞬时 snackbar（`TokenMonitorApp.kt:82-87`）。
- **P1 · 切换 Hub 后旧数据一直留在屏幕上**（AN-2）。`MoreScreens.kt:1703-1711` 保存后只 `restartRealtime()`，`HubViewModel.kt:236` 仅取消并重连 SSE，**不重置 `stats`/`devices`/`history`**，也不调用 `refreshAll()` → 新 Hub 不可达时旧 Hub 的数字一直显示，还配着"在线"状态。
- **P1 · release 允许全域名明文 HTTP**（AN-3）。`AndroidManifest.xml:12` `usesCleartextTraffic="true"` 位于 `src/main`（对所有构建类型生效），且 `network_security_config.xml:3-7` 的 `<base-config cleartextTrafficPermitted="true">` 在 API 24+ 会覆盖 manifest 标志。唯一门槛是应用层 `HubApiFactory.kt:74` 的 `require(...)`，而注入实例把 `globalAllowInsecureHttp` 硬编码为 `false`——**没有 `src/debug/`，没有 manifestPlaceholders**。因此 release APK 在网络上与 debug 无法区分，且与 `docs/API.md:3` "Android release builds do not permit cleartext traffic" **直接矛盾**。启用该开关后，admin 作用域的 Hub secret 会以明文经过局域网。另外 `<certificates src="user"/>` 未限定 debug，任何用户安装的 CA 都能 MITM HTTPS。
- **P1 · `/api/history` 失败被吞且不重试**（AN-4）。`HubViewModel.kt:85-92` 注释声称"趋势仍可用 historyPreview 总量"，但对相关页面**该前提不成立**：`historyPreview` 不含 `perClient`/`perModel` 栈（`history.js:498-505`），且上限 30 天（`dailyDays = 30`）而非 370 天。一次失败即永久降级：`StackedDailyTrendChart` 停留在回退文案，无报错、无重试（除非重进该 tab）。
- **P1 · 过期数据被当作"今日"实时数据**（AN-5）。`OverviewScreen.kt:154-171` 直接渲染 `periods.today`；`StatsDto.staleAfterMs`（`HubDtos.kt:42`）**在整个 Android 源码中从未被引用**，`DeviceDto` 也没有 `periodWindows` → 数小时前的快照会被读作今天的实时用量。
- **P2 · 限额新鲜度永远显示"刚刚更新"**（AN-6）。`LimitsUi.kt:93` 依据 `limits.updatedAt`，而 Hub 每次都把它重打成当前时间（`accountService.js:425-429`）；真正的 per-provider `stale`/`updatedAt` 在协议里存在（`limits.js:836-840,442`）但 DTO 未声明（`HubDtos.kt:107-125`）。
- **P2 · 成本恒为 US$**（AN-7）。`Formatters.kt:40-50` 硬编码 `"US$"`；网页端走 `currency.js` 的汇率与符号表并按用户偏好格式化。
- **P2 · 设备"在线"判定与数据不一致**（AN-8）。`DevicesScreen.kt:129,235` 只用 `!device.stale`；后端已有 `clientStatus`（`active|waiting|missing`）且 Android 也有 `clientStatusLabel`（`Formatters.kt:175-180`）却未用于该判定 → 停报但未过期的设备、以及所有客户端都 missing 的设备都显示"在线"。
- **P2 · 后台仍持续重连与心跳**（AN-9）。`HubViewModel.kt:238-259` 的 `viewModelScope` 循环在 `onStop` 后继续，`pingInterval` 15s、读超时无限（`HubApiFactory.kt:42-43`）；全仓库搜索 `repeatOnLifecycle|ProcessLifecycleOwner|onStop` **零命中**。
- **P2 · 每次 API 调用新建 `OkHttpClient`**（AN-10）。`HubApiFactory.kt:25-50` 每次 `create()` 都新建客户端（各自独立连接池 5 连接/5 分钟 keep-alive、Dispatcher、线程池）；仅 `refreshAll()` 就建 4 个（`HubViewModel.kt:72-82`）。
- **P2 · `named`/`credits` 窗口显示英文原文**（AN-11）。`LimitsUi.kt:60-65` 只映射 `session|weekly|billing`，而后端有 5 种（`limits.js:14`）。
- **P2 · "本设备限额"永远为空**（AN-12）。`DevicesScreen.kt:367` 渲染 `device.limits`，但 Hub 主动删除该字段（`server.js:385`、`repository.js:182`），`docs/API.md:243-246` 亦确认。
- **P2 · 模型拆分静默用估算值 / 30 天 preview 冒充全量**（AN-13/AN-14）。`AnalyticsScreen.kt:354-367` 在 `clientModels` 为空时按 token 比例分摊成本（`:318-323`）并当作权威展示；`TrendCharts.kt:50-57` 与 `OverviewScreen.kt:90` 用 30 天 preview 计算"活跃天/连胜"却标注为"近 90 天"。
- **P3**（AN-15~AN-20）：所有 Gradle `Test` 任务被禁用（`app/build.gradle.kts:183`），`./gradlew :app:test` 是**假绿**，且 `ci.yml` 无 Android 步骤；`-PtokenMonitorVersion` 回退值是与 `package.json` 无关联的第二份版本号（`:21`）——当前恰好一致，属漂移隐患；`versionCode` 编码可碰撞（`:70-72`）；`compose.ui.tooling.preview`/`tooling` 声明但无任何 `@Preview`；`formatPercent` 分母是"已列出条目和"而非周期总量，且真实小份额显示为 `0.0%`；范围选择器宣称小时精度而后端按天取整（`docs/API.md:359-366`）。

### 7.5 仓库安全与卫生

- **P1 · APT 签名私钥明文入库风险**（WS-1）。`.secrets/token-monitor-apt-private.asc` 首行为 `-----BEGIN PGP PRIVATE KEY BLOCK-----`（3,413 字节，**未加密**）。它**不在 `.gitignore`**，只被 **`.git/info/exclude:7`** 排除——该文件是本机私有、永不提交，因此新克隆/CI checkout/备份恢复**完全没有保护**，一次 `git add -A` 就会提交私钥。也**不在 `.dockerignore`**（会进入 Docker 构建上下文）。
  > 已核验的缓解事实：当前 `git ls-files .secrets` = 0（未被跟踪）；`Dockerfile` 只 `COPY` 具体目录，**私钥不会进入镜像**；加密备份 `*.asc.enc` 的口令存放在仓库外的 `/home/lvziw/.config/token-monitor-suite/apt-key-recovery.passphrase`（`README.txt` 有说明），该口令文件未入库。所以这是**未爆的雷**，不是已泄露。
- **P3 · 过期文档堆积**：根目录并存 `AUDIT.md`、`DEVELOPMENT_REPAIR_PLAN.md`、`HUB_STABILITY_PLAN.md`、`WEB_UI_AUDIT_REPORT.md` 等多份历史报告，内容已与当前代码脱节（例如 `HUB_STABILITY_PLAN.md` 描述的 Android 明文禁止问题已修复：现为 `usesCleartextTraffic="true"` 且 `HubApiFactory` 支持 `allowInsecureHttp`；Hub 已补 `uncaughtException`/`SIGTERM` 处理）。
- **P3 · 工作区磁盘**：约 3.7GB 可再生占用（见 §6.5）。

---

## 八、问题之间的因果与放大关系

```
                    ┌─────────────────────────────────────────┐
                    │ session 归档永不封顶（每条会话 +1 项）    │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │ P0-1 每 tick 全量重算归档（283-687ms）    │
                    │      sessionKey 慢 58×                  │
                    └────────────────┬────────────────────────┘
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼────────┐        ┌──────────▼──────────┐      ┌──────────▼──────────┐
│ P0-2 双采集器   │        │ deviceState 3× 深拷贝 │      │ 状态文件 2 空格美化  │
│  CPU/IO ×2     │        │  164ms/次            │      │  序列化 +36%        │
└───────┬────────┘        └─────────────────────┘      └─────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────────────┐
│ 主线程持续 100%+ → 窗口/托盘/IPC 卡顿；RSS 锯齿至 1GB；内存仅剩 124MB     │
└───────┬──────────────────────────────────────────────────────────────────┘
        │ 机器变慢
┌───────▼────────┐        ┌───────────────────────┐      ┌──────────────────┐
│ LD-3 tokscale  │        │ P0-3 Hub 全量重算      │      │ P0-5 SSE 孤儿泄漏 │
│ 超时→孤儿累积   │───────▶│ 656ms-1564ms/次 ingest │─────▶│ 越多越慢、越慢越多│
│ 负载棘轮上升    │        │ 阻塞所有请求+心跳      │      │ 只能重启          │
└────────────────┘        └───────────┬───────────┘      └──────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │ P0-4 limits latch 死锁 │
                          │ 无超时 → 限额永久停更   │
                          │ 只能重启               │
                          └───────────────────────┘
```

**时间线预测（本机 13 会话/天）**：现在 450 会话 ≈ 每 tick 阻塞 0.3–0.7 秒 → 2.5 个月 1000 会话 ≈ >1.5 秒/tick（追不上 debounce）→ 5 个月 2000 会话 ≈ 3 秒/tick（永久冻结）。这与"用一段时间就会出现各种问题"完全一致。

---

## 九、审计可信度与未验证项

**已实测确认**（本机真实数据 / 真实进程 / 独立对照实验）：P0-1、P0-2、P0-3、LD-3（机制）、LD-8、HB-2、HB-4（配置层面）、HB-19、SH-1、AN-1~AN-8 的代码路径、WS-1、WS-2~WS-8、§5 全部 id/键一致性对照。

**代码确认但未在真实故障下复现**（结论基于逻辑推导，非观测）：

1. **P0-4 limits latch**：需要"永不 settle 的 await"。undici 300 秒不活动超时 + MySQL socket 静默停滞是可行路径，但本次未复现出真实停滞。
2. **P0-5 SSE 孤儿**：由子审计用探针在 Node 24 上实测 1500/1500 滞留，但**未在本机运行中的 Hub 上复现**。
3. **LD-3 孤儿进程累积**：缺 SIGKILL/`settled`/监听器清理是代码确认的；但本次 5 分钟轮询中未观察到 tokscale 存活超过超时（60 次 1 秒采样中仅 3 次存在扫描，最多 1 个并发）。
4. **HB-11 `1e300` 导致永久无法入库**：内存仓库下确认数值原样通过；MySQL 侧 1264 报错与事务回滚是**依据 schema 推断**（本机无 MySQL 可执行验证）。
5. **HB-13 deviceId 冲突重复计账**：代码逻辑确认，未构造双机场景实测。
6. **性能绝对值**：全部在 load ≈ 10–14（8 核）下测得，绝对值有波动（同一 transform 在负载高低时可见 283ms vs 687ms 的差异）。**缩放趋势、调用次数与算法复杂度是确定的**。

**方法与披露**：

- 全程只读审计，未修改任何项目文件（除本报告与修复计划两份新文档）。
- 审计期间仓库被外部推进了一个提交（`f44ed48` → `807cd82`，`fix(limits): show codex reserve allowances…`），本报告以 `807cd82` 为准；该提交不影响上述任何结论。
- 子审计在 `/tmp` 下创建了一个一次性探针脚本（仓库外），项目树未被触碰。

---

## 十、修复计划

优先级排序、分批实施步骤、验收标准与回归验证方式见 **`PROJECT_FIX_PLAN.md`**。
