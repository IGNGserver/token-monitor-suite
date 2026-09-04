# Token Monitor 全代码库安全与架构审计

审计日期：2026-08-27

审计对象：`f09a25c`（`v0.45.0-rev.18`，`main`）

审计方式：仅使用当前工作区源码、项目内文档、测试和 Git 历史；未使用 Memory、其他聊天记录或外部资料。本轮未修改业务代码。

## 结论摘要

当前版本不适合在不加整改的情况下继续发布。没有发现无需任何凭据即可直接远程执行代码的 P0 漏洞，但存在多项 P1：可复现的原型污染、把采集端凭据等同于全局管理员凭据的错误信任边界、明文/URL 密钥暴露面、确定失败且可绕过的发布门禁、回滚后仍持续采集/构建却没有任何产品消费者的整条遗留功能链、已由历史提交修复但被重新引入的更新退出死锁，以及会永久重复计量历史用量的数据完整性缺陷。

最重要的架构事实不是某个孤立函数写得不好，而是 0.45 共享层、Hub、Worker、Android 与被恢复到 0.37 的 Electron 壳之间已经失去统一的产品契约。Git 提交 `a5584a5` 明确写明“Electron/tests 恢复到 0.37，Hub/Worker/agent/shared 保持 0.45”；当前失败测试、Reasonix 本地视图断链、诊断系统断链、macOS Widget 无快照生产者和更新器回归都能从这条版本断层解释。

严重度定义：

- **P0**：无需合理前提即可造成远程接管或大范围不可逆损失。此次未确认 P0。
- **P1**：应阻止发布；可导致进程级破坏、凭据/权限边界失守、核心功能不可用或永久数据错误。
- **P2**：应在下一轮修复；会造成部署、兼容性、可观测性或容量风险。
- **P3**：清理性问题；目前主要增加维护成本和误判概率。

## 已确认问题

### P1-01：Hub ingest 可污染进程级 `Object.prototype`

**证据链**

1. 用量 period 的大多数动态键容器仍是普通对象，包括 `clientModels` 和 `clientModelCosts`（[`src/shared/usage.js:146`](src/shared/usage.js#L146)）。
2. `normalizeClientName()` 会保留 `__proto__`；末尾过滤规则允许下划线，且没有拒绝原型保留键（[`src/shared/usage.js:165`](src/shared/usage.js#L165)）。
3. 对嵌套映射的写入先读取 `period.clientModels[clientKey]`，再向其写入模型键（[`src/shared/usage.js:659`](src/shared/usage.js#L659)）。当 client 是 `__proto__` 时，读取到的是 `Object.prototype`，因此内层赋值修改全局原型。`clientModelCosts` 有同样问题（[`src/shared/usage.js:671`](src/shared/usage.js#L671)）。
4. Node Hub ingest 在保存前调用这套归一化；Worker 使用由同一源文件 vendored 的实现，因此两个 Hub 都受影响。
5. 项目其他模块已经显式防御相同类别的问题，例如 `clientHealth` 拒绝 `__proto__` / `constructor` / `prototype`，项目聚合使用 null-prototype map；说明这不是项目接受的键语义，而是遗漏。

**复现**

向 `normalizeDeviceRecord()` 传入由 `JSON.parse()` 生成的：

```json
{"today":{"clientModels":{"__proto__":{"auditPolluted":7}}}}
```

实测输出：

```json
{"own":true,"value":7,"normalized":{}}
```

进一步把模型名设为 `constructor` 后，`typeof ({}).constructor` 从 `function` 变为 `string`。这证明不是单纯丢字段，而是进程级对象语义被改写。

**影响**

任何能调用 ingest 的客户端都能污染 Node 进程或 Worker isolate，造成不可预测的数据错误、异常分支和拒绝服务。当前共享密钥本身权限已经过大，但不应把“已获上传权”视为“允许修改运行时全局对象”。

**建议**

- 所有由 wire key、模型名、客户端名、session id 构成的 map 统一使用 `Object.create(null)` 或 `Map`，不只修这两个字段。
- 每次读取动态键都使用 own-property 语义；对 `__proto__`、`prototype`、`constructor` 做统一拒绝或安全存储。
- 增加覆盖 `clients`、`models`、`clientModels`、cost maps、sessions、history、Hub 聚合和 Worker vendored 副本的保留键回归测试。
- 修复源文件后运行 `npm run sync:worker`，不能只改 Worker 副本。

### P1-02：一个共享密钥同时授予上传、全量读取、计费管理和删除权限

**证据链**

- Node Hub 只在路由分派前做一次 `isAuthorized()`，之后同一密钥可访问 stats、原始 devices、history、subscriptions、pricing、ingest 和 delete（[`src/hub/server.js:608`](src/hub/server.js#L608)）。
- ingest 直接信任 payload 中的 `deviceId` 并按该 ID 读取/覆盖现有记录，没有把凭据绑定到设备身份（[`src/hub/server.js:500`](src/hub/server.js#L500)）。
- 同一凭据可以删除任意 ID（[`src/hub/server.js:709`](src/hub/server.js#L709)）。Worker 采用相同的单密钥门禁和权限模型（[`worker/src/index.js:188`](worker/src/index.js#L188)）。
- API 文档也只定义一个 shared secret，没有角色或 capability（[`docs/API.md:8`](docs/API.md#L8)）。

**影响**

把密钥部署给每个 headless agent 后，任一终端失陷都会升级为整个 Hub 的管理员失陷：攻击者可以读取其他设备与账号标识、伪装任意设备、篡改订阅/定价、删除设备，并持续制造合法格式的假数据。这里的信任边界把“不可信采集端”错误地当成“可信控制平面”。

**建议**

- 至少拆成三类 capability：绑定 `deviceId` 的 ingest token、只读 viewer token、可变更 pricing/subscriptions/devices 的 admin token。
- 对现有 shared secret 提供明确迁移期；旧密钥只能暂时映射为 admin，不能继续作为所有 agent 的长期凭据。
- 设备身份由凭据声明确定，payload 中 ID 只作一致性校验；增加重放/幂等键和安全审计日志。
- 对 ingest、SSE 和管理操作分别做限流和配额。

### P1-03：高权限密钥存在明文传输和 URL 泄漏路径

**证据链**

- 裸主机/IP 会自动补成 `http://`（[`src/shared/config.js:77`](src/shared/config.js#L77)），项目文档与 `.env.example` 直接给出 `http://<lan-ip>:17321`。
- Android 全局允许 cleartext traffic（[`android/app/src/main/AndroidManifest.xml:5`](android/app/src/main/AndroidManifest.xml#L5)），因此 bearer secret 和所有返回数据可走明文 HTTP。
- Node Hub 虽支持 TLS，但有 secret 时默认可绑定 `0.0.0.0`，TLS 仍是可选项（[`src/hub/server.js:219`](src/hub/server.js#L219)）。无 secret 时强制 loopback 是正确保护，但不能保护常规多设备模式（[`src/hub/server.js:60`](src/hub/server.js#L60)）。
- Worker 明确接受 `?secret=`（[`worker/src/index.js:31`](worker/src/index.js#L31)）；文档还声称这个 URL 留在设备本机、密钥“不会进入外部日志”（[`worker/README.zh-CN.md:105`](worker/README.zh-CN.md#L105)）。URL 实际必然发送到 Worker，并可能进入客户端诊断、代理、边缘请求日志或截图，不能作此保证。
- 泄漏的不是只读小组件 token，而是 P1-02 所述的全局管理密钥。

**影响**

可信 LAN 只能降低风险，不能提供传输机密性。密钥一旦被旁路观察或落入 URL 日志，攻击者获得完整 Hub 控制权。

**建议**

- 非 loopback Hub 默认要求 HTTPS，或在 UI/CLI 中对明文远端连接做强警告并要求显式 opt-in。
- Android 使用 Network Security Config，仅对明确的开发/私网目标允许 cleartext，不要应用级全开。
- 删除高权限 query secret。若 Widgy 确实无法发送 header，应使用只允许 `GET /api/stats`、可轮换、可过期、不可管理/上传的专用只读 token。
- 修正文档中“不会进入外部日志”的错误安全承诺，并要求 URL/错误日志统一脱敏。

### P1-04：发布门禁不是 fail-closed；当前已发布标签上的测试确定失败

**证据链**

- 在独立 TMPDIR 下运行 `npm run verify`：lint 通过，Node 测试共 2458 个，2445 通过、5 失败、8 跳过。
- `tests/shared/diagnosticReport.test.js` 在模块加载阶段引用已删除的 `src/electron/diagnostics`（[`tests/shared/diagnosticReport.test.js:14`](tests/shared/diagnosticReport.test.js#L14)）。
- 另外 4 个 Reasonix 测试稳定失败，直接暴露 P1-05 中的产品链断裂。
- macOS Widget CI 仍点名 11 个已删除的 Electron 测试文件（[`.github/workflows/ci.yml:54`](.github/workflows/ci.yml#L54)）。单独执行 `node --test tests/electron/macWidgetBridge.test.js` 确定返回 `Could not find ...`。
- release workflow 在 tag 上直接构建；各 build/android/hub-image job 没有运行 lint/test，也不依赖一个已验证的 CI 结果（[`.github/workflows/release.yml:24`](.github/workflows/release.yml#L24)）。当前 HEAD 同时是 `v0.45.0-rev.18`。
- Android 的根 `test` 任务只依赖 `runRepositoryTests`（[`android/build.gradle.kts:9`](android/build.gradle.kts#L9)），而 app 将所有标准 `Test` task 禁用（[`android/app/build.gradle.kts:160`](android/app/build.gradle.kts#L160)）。因此 `gradlew test` 显示 `BUILD SUCCESSFUL` 时只执行 5 个 Repository 测试，另外 16 个 DTO/formatter 测试没有进入默认门禁；显式 `:app:runUnitTests` 才执行全部 21 个。

**影响**

CI 红灯不能阻止 tag release，Android 还能产生覆盖面失真的绿灯。测试已经从质量门禁退化为可选信息，回滚后的断链可以持续进入安装包和 Hub 镜像。

**建议**

- 暂停 release，先让默认 `npm run verify`、mac-widget job 和 Android 全量单测全部变绿。
- release 必须依赖同一 commit/tag 的必需 CI 检查，或在 release workflow 内重新运行完整 verify、Worker drift、Android `runUnitTests` 和适用的原生测试。
- 根 Android `test` 改为依赖 `runUnitTests`，并为未来新增测试类建立自动发现，避免继续维护手写类名清单。
- 删除不存在的 CI 测试路径；若 Widget 继续保留，改为验证当前真实入口，不能用不存在的文件制造“覆盖”。

### P1-05：桌面回滚留下了多条“内部仍互相引用、产品功能已不存在”的完整遗留链

这不是普通死文件，而是生产者、协议、构建、测试和消费者只剩一部分的版本断层。

#### A. Reasonix native 详情：采集后必然被丢弃

- Reasonix 是默认追踪客户端（[`src/shared/clientTracking.js:8`](src/shared/clientTracking.js#L8)），headless agent 明确启用 native session scan（[`src/agent/agent.js:69`](src/agent/agent.js#L69)）。
- collector 读取 native session/project 并生成 `nativeSessions` / `nativeProjects`（[`src/shared/collector.js:1389`](src/shared/collector.js#L1389)）。
- agent 没有 UI，而 sync payload 明确删除这两个字段（[`src/shared/syncPayload.js:190`](src/shared/syncPayload.js#L190)），因此 agent 扫到的数据没有任何可达消费者。
- Electron 当前没有启用 `reasonixNativeSessionsEnabled`；即使手工把字段送入 `composeLocalSyncStats()`，该函数也只返回 aggregate periods/devices/limits，不保留 native 字段（[`src/electron/syncDisplayStats.js:41`](src/electron/syncDisplayStats.js#L41)）。
- 当前 renderer 的 session row helper 只遍历 `period.sessions`，完全忽略 `options.nativeSessions`（[`src/electron/renderer/sessionRows.js:82`](src/electron/renderer/sessionRows.js#L82)）。对应的 4 个测试稳定失败。

结论：Reasonix 的 Tokscale 聚合 token 仍可工作；失效的是本地 native session/project 详情链。当前实现却继续扫描、缓存和维护这条链，产生 IO、复杂度和隐私面，没有产品输出。

#### B. macOS Widget：原生消费者与构建链存在，快照生产者已经删除

- 原生 Widget 只从 App Group 的 `snapshot.json` 读取数据（[`native/macos/TokenMonitorWidget/WidgetSnapshot.swift:21`](native/macos/TokenMonitorWidget/WidgetSnapshot.swift#L21)），timeline provider 直接依赖该文件（[`native/macos/TokenMonitorWidget/WidgetTimelineProvider.swift:51`](native/macos/TokenMonitorWidget/WidgetTimelineProvider.swift#L51)）。
- 当前仓库仍有 600 行 JS snapshot builder、完整 Swift 扩展、构建/签名/打包命令和独立 CI job；README 仍宣传 source-only preview（[`README.md:147`](README.md#L147)）。
- 但当前 Electron main/preload 对 mac Widget 没有任何运行时引用。Git 提交 `a5584a5` 删除了 `macWidgetBridge`、demand、history、history store、snapshot controller、reloader、LaunchServices recovery 和相应测试。
- release workflow 又显式设置 `TOKEN_MONITOR_WIDGET_ENABLED=0`（[`.github/workflows/release.yml:107`](.github/workflows/release.yml#L107)）。

结论：它既不在正式产品中，也没有能够写入真实快照的桌面生产者；当前只能构建一个长期显示无数据/旧快照的扩展。CI 还引用被删测试，说明构建链本身也未完成回滚。

#### C. 诊断系统：数据仍生产/传输，UI 与生成器已删除

- `diagnosticReport.js`（1049 行）和 `diagnosticJournal.js`（153 行）只被测试引用，没有生产入口；测试又依赖已删除的 Electron generator 并直接失败。
- collector 仍生成丰富 `clientHealth`（[`src/shared/collector.js:1480`](src/shared/collector.js#L1480)），Hub 仍归一化并在每台 device 中返回它（[`src/shared/usage.js:842`](src/shared/usage.js#L842)、[`src/shared/usage.js:1323`](src/shared/usage.js#L1323)）。
- 当前 Electron、Hub web、Android 和 native Widget 都没有消费 `clientHealth`。Git 回滚删除了 diagnostics panel、diagnostic snapshot/generator 和 client-health presentation。

结论：底层 source checks 仍被简化的 `clientStatus` 使用，不能整块删除；但 richer health/report/journal 的生产、wire、存储和测试已成为无消费者链。

#### D. 其他确认的无生产消费者模块

| 模块 | 当前引用 | 判断 |
|---|---|---|
| `src/shared/fontSettings.js` | 无 | 回滚遗留死代码 |
| `src/shared/archivePeriods.js` | 仅自身测试 | 无产品入口 |
| `src/shared/hubBuildComparison.js` | 仅 tests | Hub 仍计算/返回 build identity，但客户端比较与提示已删除 |
| `src/shared/macWidgetSnapshot.js` | 仅 tests/native 注释 | 无快照写入者 |
| `src/shared/diagnosticReport.js` / `diagnosticJournal.js` | 仅 tests | 无报告生成或展示入口 |

**建议**

不要逐个打补丁。先为每条链做产品决策：

1. **恢复**：补齐唯一生产入口、唯一消费入口、端到端测试和发布资产；或
2. **移除**：删除扫描/协议字段/构建脚本/测试/文档/资产，提供必要的数据兼容清理。

Reasonix native、macOS Widget、diagnostics 三条链必须分别做出上述二选一，不能继续处于“代码很多，所以功能大概还在”的状态。

### P1-06：更新安装失败时“无法正常退出”的已知缺陷被重新引入

**证据链**

- 当前安装路径在调用 `quitAndInstall()` 前直接永久设置 `quitRequested = true`，没有 try/catch、watchdog 或 handoff 确认（[`src/electron/main.js:3813`](src/electron/main.js#L3813)）。
- `requestAppQuit()` 遇到 `quitRequested` 会直接返回（[`src/electron/main.js:3386`](src/electron/main.js#L3386)），窗口 close/blur 逻辑也依赖该标志。
- 当前没有监听 `before-quit-for-update`。
- Git 提交 `43ebd1e` 和 `5e77615` 的提交说明精确记录了同一故障：`quitAndInstall()` 返回 void；若 installer 未 handoff，quit flags 会让 Exit 成为 no-op。后者曾新增 `updateInstallQuit.js` 状态机和约 565 行测试；`a5584a5` 又全部删除。

**影响**

更新器静默未启动或抛错时，应用可留在“认为自己正在退出”的永久状态，托盘退出和普通窗口行为失效，只能从系统层面终止进程。macOS/Windows/Linux 的 handoff 语义不同，简单延时清 flag 还可能与真实安装竞争。

**建议**

恢复基于 `before-quit-for-update` 的可测试状态机、平台策略、同步异常恢复与超时恢复，并恢复针对当前 electron-updater 固定版本的上游行为断言。不要只在当前函数外围加一个通用 `setTimeout`。

### P1-07：删除设备后再次上报会把全量历史永久重复写入 ledger

**证据链**

- 删除设备会删除 `devices`、session 和 ingest state，但刻意保留 `usage_events` 并把 `device_id` 置空（[`src/hub/repository.js:254`](src/hub/repository.js#L254)）。
- 范围聚合会统计时间窗口内所有 usage events，包括已 detach 的记录（[`src/hub/repository.js:278`](src/hub/repository.js#L278)）。
- 下一次相同 ID 上报时 `getDeviceRecord()` 返回 null；delta 计算把当前 all-time snapshot 视为首个基线并全量插入（[`src/hub/server.js:504`](src/hub/server.js#L504)）。
- API 文档明确建议在设备改名后删除旧 ID（[`docs/API.md:266`](docs/API.md#L266)），恰好会触发旧 ID 历史保留、新 ID 全量再次入账。

**最小复现**

同一 payload（all-time 100 tokens）执行 `ingest -> delete -> ingest` 后，MemoryRepository 的 ledger 为：

```json
[
  {"deviceId":null,"totalTokens":100},
  {"deviceId":"audit-device","totalTokens":100}
]
```

范围聚合会得到 200，而真实总量仍是 100。该错误进入不可变 ledger 后不能通过后续正常 snapshot 自愈。

**建议**

- 明确定义“删除展示记录”和“删除/重置计量身份”为不同操作。
- 保留不可见的 device tombstone/baseline，或为设备签发稳定 identity，使重新接入可从最后计数继续做 delta。
- 改名应是原子 rename，不应以 delete + first-ingest 模拟。
- 增加 same-ID reingest、renamed-ID、counter reset、history fallback 与真实 MySQL 的端到端测试，并提供已重复 ledger 的检测/修复工具。

### P1-08：Worker 被宣传为 Android 兼容 Hub，但缺少 Android 无条件调用的接口

**证据链**

- README 明确称 Android 可查看 “Worker or MySQL-backed Hub”，并称 Worker compatible（[`README.md:297`](README.md#L297)）。
- Android API 无条件定义并调用 `/api/usage/range` 与整套 `/api/pricing*`（[`android/app/src/main/java/com/igng/tokenmonitor/android/data/remote/HubApi.kt:19`](android/app/src/main/java/com/igng/tokenmonitor/android/data/remote/HubApi.kt#L19)）；UI 无 capability gate 地暴露 pricing 页面。
- Worker 的实际私有路由只有 stats/devices/history/stream/ingest/subscriptions/delete，最终在未匹配时返回 404（[`worker/src/index.js:196`](worker/src/index.js#L196)、[`worker/src/index.js:293`](worker/src/index.js#L293)）。它没有 usage-range、pricing 和事件 ledger。
- `docs/API.md` 又把 custom range 描述为 Desktop 与 Android 对齐使用的 Hub 合同（[`docs/API.md:272`](docs/API.md#L272)），未声明 Worker 例外。

**影响**

Android 连接 Worker 后，基础 stats 可能正常，但自定义区间和定价管理必然失败。Desktop 会在 404 后退回本机扫描，结果不再是多设备总量；Android 没有等价 fallback。这是“连接成功、部分功能必坏”的协议分叉。

**建议**

- 定义版本化 Hub capabilities endpoint/字段，客户端只展示服务端明确支持的功能。
- 若 Worker 仍称 drop-in/Android compatible，则实现等价的 range ledger 与 pricing；否则明确降级产品范围，并在 Android UI 隐藏/解释不可用功能。
- 用同一组 contract tests 对 Node 和 Worker 跑路由、状态码、shape 与权限矩阵，而不是分别测试各自已有功能。

### P1-09：核心同步请求没有 deadline，单个半开连接可永久冻结上传链

**证据链**

- agent 的 `postUsage()` 通过 `postSyncPayload(fetch, ...)` 发起请求，没有传 `AbortSignal`（[`src/agent/agent.js:125`](src/agent/agent.js#L125)）。
- `postSyncPayload()` 的两次 fetch 都不设 deadline（[`src/shared/syncPayload.js:270`](src/shared/syncPayload.js#L270)）。
- ordered sink 在 active send settle 前不会启动 pending；`flush()` 也会无限等待这个 promise（[`src/shared/orderedSink.js:19`](src/shared/orderedSink.js#L19)、[`src/shared/orderedSink.js:71`](src/shared/orderedSink.js#L71)）。
- Electron 的 upload scheduler 具有相同的 in-flight 等待语义（[`src/electron/syncUploadScheduler.js:28`](src/electron/syncUploadScheduler.js#L28)），而 upload、delete、stats、自定义 range 也没有 deadline；只有 dashboard history 单独实现了 15 秒超时。
- SSE 有 AbortController，但没有连接 deadline 或 heartbeat idle watchdog（[`src/electron/main.js:2782`](src/electron/main.js#L2782)）。

**影响**

一个 TCP 半开、代理不回包或 Hub 接受请求后不结束响应，就能让该进程后续记录永远压缩在 pending 中；one-shot/flush 也可能永不退出。界面仍可能展示本地数据，让运营者误以为同步正常。

**建议**

- 建立唯一 Hub client：所有普通请求统一 connect/headers/body deadline，SSE 统一 connect deadline 和基于 30 秒 heartbeat 的 idle watchdog。
- 超时必须真实 abort socket，并进入有界指数退避；上传保留 latest-wins，但要暴露“最后成功上报时间/连续失败次数”。
- stop/once 要有明确的 bounded flush 策略并返回非零状态，不能永久等，也不能静默丢最后一条。

## P2 问题

### P2-01：MySQL migration 用事务包装 DDL，提供了并不存在的原子性

`runMigrations()` 对每个 SQL 文件执行 `beginTransaction -> 多条 DDL -> INSERT schema_migrations -> commit`（[`migrations/run.js:18`](migrations/run.js#L18)）。`001_mysql_hub.sql` 含多条 `CREATE TABLE`，且多数没有 `IF NOT EXISTS`。MySQL DDL 会发生隐式提交；中途失败时 `rollback()` 不能撤销已创建的表，migration 又没有被标记。下次启动会在已有表处再次失败，部署被永久卡住并需要人工修库。

建议使用单语句、可重入 migration，或采用成熟 migration runner 的 MySQL 语义；至少记录每一步、用 advisory lock 防并发执行，并增加“001 执行到一半后重启”的真实 MySQL 测试。

### P2-02：Android“测试连接”不验证密钥，错误凭据也显示成功

Android `testConnection()` 只调用无需鉴权的 `/api/health`（[`android/app/src/main/java/com/igng/tokenmonitor/android/data/repository/HubRepository.kt:48`](android/app/src/main/java/com/igng/tokenmonitor/android/data/repository/HubRepository.kt#L48)），成功后 UI 直接显示“连接成功”（[`android/app/src/main/java/com/igng/tokenmonitor/android/ui/ConnectionViewModel.kt:32`](android/app/src/main/java/com/igng/tokenmonitor/android/ui/ConnectionViewModel.kt#L32)）。因此空/错误 secret、甚至命中另一个只提供相似 health JSON 的服务都可能通过，真实 stats 随后才报 401。

建议测试 health 后再调用一个最小 authenticated endpoint，并校验 `role/runtime/version/capabilities`；只有两步都成功才保存/报告连接成功。

### P2-03：客户端注册表重复实现已漂移，默认追踪工具在设置中不可见

shared `DEFAULT_CLIENTS` 包含 `commandcode` 和 `reasonix`，`KNOWN_CLIENTS` 还包含 opt-in `qodercn`（[`src/shared/clientTracking.js:8`](src/shared/clientTracking.js#L8)、[`src/shared/clientTracking.js:23`](src/shared/clientTracking.js#L23)）。当前 renderer 又维护一份手写 `KNOWN_CLIENTS`，缺少这三个 ID（[`src/electron/renderer/app.js:49`](src/electron/renderer/app.js#L49)），而设置列表完全由它生成（[`src/electron/renderer/app.js:7219`](src/electron/renderer/app.js#L7219)）。对应 label/icon/color/Discord/CSS 映射也未接线。

结果是两个默认启用的采集器无法在 GUI 中关闭/隐藏/固定，opt-in `qodercn` 无法从 GUI 启用；用户看到的工具注册表和真实采集注册表不同。现有 guard test 只验证 shared 内部 superset，没有验证 renderer/Discord/assets 的跨层一致性。

建议将 client manifest 变成单一数据源并生成 renderer/Discord/docs 映射，或至少增加解析真实 renderer 注册表的 contract test。

### P2-04：SSE 不处理 backpressure，ingest 还会重复全量聚合并回传所有设备

- Node `res.write(payload)` 的返回值被忽略；只有同步 throw 才移除客户端（[`src/hub/server.js:485`](src/hub/server.js#L485)）。慢消费者会持续堆积 socket buffer。
- Worker 对每个 writer 调用 `write()` 但不 await，下一次 broadcast/heartbeat 可继续排队（[`worker/src/index.js:122`](worker/src/index.js#L122)、[`worker/src/index.js:145`](worker/src/index.js#L145)）。
- 有订阅者时 ingest 先为 broadcast 做一次全量 `getStats()`，HTTP 响应又做一次并把完整 stats 返回给上传端（[`src/hub/server.js:500`](src/hub/server.js#L500)、[`src/hub/server.js:669`](src/hub/server.js#L669)）。Worker 同样一边异步 broadcast、一边重新计算 response stats（[`worker/src/index.js:232`](worker/src/index.js#L232)）。

设备数和 snapshot 体积增长后，一次小 ingest 会放大为多次全库读取、全量序列化和 N 份排队写。建议为每个 SSE client 只保留 latest snapshot、检测 Node writable backpressure、限制慢客户端；ingest 只返回 ack/revision，broadcast 与响应复用同一次缓存聚合。

### P2-05：Node/Worker 输入边界不一致，标识字段缺少协议级长度限制

Node 对 JSON body 有 1 MiB 上限（[`src/shared/http.js:3`](src/shared/http.js#L3)），Worker 直接 `request.json()`，没有应用级等价限制（[`worker/src/index.js:232`](worker/src/index.js#L232)）。`normalizeDeviceRecord()` 对 `deviceId`、hostname、platform 和 agentVersion 基本不截断（[`src/shared/usage.js:825`](src/shared/usage.js#L825)），而 MySQL schema 的 `device_id` 是 `VARCHAR(191)`，其他字段也是有限列。相同 payload 在 Worker 可成功、在 Node 可能变成数据库错误；超大嵌套对象还会扩大解析/归一化成本。

建议把请求大小、字符串长度、数组/映射条目数、session/history 上限定义在共享 wire validator 中，Node 与 Worker 在进入业务归一化前返回一致的 400/413。

## P3 与纵深防御

### P3-01：Hub Web 把 admin secret 存入 Web Storage，但静态响应没有浏览器安全头

Web dashboard 的“remember”会把 shared secret 存到 `localStorage`，否则存到 `sessionStorage`（[`src/hub/web/js/api.js:19`](src/hub/web/js/api.js#L19)）。静态服务器只设置 content type/cache/CORS，没有 CSP、`X-Content-Type-Options`、frame 限制或 `Referrer-Policy`（[`src/hub/static.js:116`](src/hub/static.js#L116)）。当前审计没有确认可利用的 stored XSS；模板中的主要设备/模型/账号文本普遍经过 `escapeHtml()`，service worker 也正确排除了 `/api/*` 缓存（[`src/hub/web/sw.js:37`](src/hub/web/sw.js#L37)）。

仍建议在拆分只读/admin token 后，让 dashboard 默认只持有 viewer token；补 CSP、nosniff、frame-ancestors、Referrer-Policy 和 Permissions-Policy，减少未来模板回归把全局 admin secret 一并暴露的后果。

## 正向控制与未发现项

以下设计经代码确认是有效控制，不应在修复时误删：

- Node Hub 无 secret 时强制绑定 loopback，而不是把未鉴权数据暴露到 LAN（[`src/hub/server.js:60`](src/hub/server.js#L60)）。
- Node 请求体有明确的 1 MiB 上限，并在 413 后关闭连接。
- Electron renderer 使用 `contextIsolation: true`、`nodeIntegration: false`，外部导航默认拒绝且只打开 HTTPS allowlist；响应统一注入 CSP（[`src/electron/main.js:3946`](src/electron/main.js#L3946)、[`src/electron/main.js:4217`](src/electron/main.js#L4217)）。
- GUI provider credentials 通过统一 credential store 管理，默认不下发 renderer；Android 连接信息使用 EncryptedSharedPreferences，且 `allowBackup=false`。
- Worker 在未配置 secret 时拒绝所有私有数据路由；可选 public stats 会移除 devices、账号标识和 project 字段。
- Hub Web service worker 不缓存任何 `/api/*` 响应。
- 静态文件服务对 decode、`..`、反斜杠、盘符和 root escape 做了明确检查；本轮未发现目录穿越。

## 修复优先级与建议顺序

### 阶段 0：立即停止带病发布

1. 将当前 release workflow 改为依赖完整、同 commit 的必需检查。
2. 修复/移除 5 个 Node 失败测试和 mac-widget 不存在的测试路径。
3. 让 Android 默认 `test` 执行全部 `runUnitTests`；将这一步加入 CI/release。

### 阶段 1：封堵安全与不可逆数据风险

1. 修复所有动态 map 的原型污染，并同步 Worker vendored 副本。
2. 拆分 ingest/view/admin 权限；停止在 URL 和明文远端连接中使用全局 admin secret。
3. 修复 delete/reingest ledger 重复计量；在继续接收生产 ingest 前评估现有库是否已有重复事件。

### 阶段 2：恢复核心可靠性

1. 恢复 update install handoff 状态机与平台测试。
2. 为全部 Hub HTTP/SSE 路径建立统一 deadline、abort、backoff 和可见的最后成功状态。
3. 修复 SSE backpressure、ingest 双重聚合和全量响应放大。
4. 使 migration 可重入，并做真实 MySQL 故障恢复测试。

### 阶段 3：消除版本断层

1. 对 Reasonix native、macOS Widget、diagnostics 分别决定“完整恢复”或“完整删除”。
2. 定义 Node/Worker capabilities；让 Android/Desktop 按 capability 展示功能，或实现真正等价的协议。
3. 把客户端 manifest、labels、icons、colors、Discord、docs 与 guard tests 合并为单一来源。
4. 清理 font settings、archive periods、hub build comparison 等确认无消费者模块；删除前先验证是否属于计划恢复功能。

## 本轮验证记录

| 检查 | 结果 | 说明 |
|---|---|---|
| `git status --short`（审计前） | PASS | 工作区初始干净 |
| `npm run lint` | PASS | ESLint 无错误 |
| `TMPDIR=... npm run verify` | FAIL | 2458 tests：2445 pass、5 fail、8 skip；失败均可单独复现 |
| `node --test tests/shared/diagnosticReport.test.js` | FAIL | 缺少 `src/electron/diagnostics` |
| Reasonix 两个测试文件 | FAIL | 27 tests：23 pass、4 fail；native display/sync 链断裂 |
| mac Widget 缺失测试最小复现 | FAIL | `Could not find tests/electron/macWidgetBridge.test.js` |
| 原型污染最小复现 | PASS（漏洞已复现） | `Object.prototype` 获得攻击者键；`constructor` 可被改成字符串 |
| delete/reingest 最小复现 | PASS（缺陷已复现） | 100-token snapshot 在 ledger 中产生两条 100-token event |
| `bash android/gradlew --no-daemon -p android test` | PASS，但门禁失真 | 只执行 5 个 Repository 测试；标准 debug/release tasks 为 SKIPPED |
| `:app:runUnitTests` | PASS | 显式执行全部 21 个 Android JVM tests |
| 真实 MySQL migration/故障恢复 | NOT RUN | 本轮没有配置独立 MySQL 测试实例；不能把 memory repository 当作 MySQL DDL 证明 |
| macOS Widget Xcode/签名/安装 | NOT RUN | 当前环境为 Linux；静态证据已确认运行时生产者缺失 |
| Windows/macOS 更新安装 handoff | NOT RUN | 需要真实平台与 installer；结论来自当前控制流和修复该同一故障的 Git 历史 |

## 最终判断

这个仓库的主要风险已经从“某几个功能有 bug”上升为“多运行时之间没有可执行的统一契约”。当前最危险的模式是：共享层继续生产字段，Hub/Worker继续传输或持久化，旧桌面壳却没有消费；测试一部分仍描述新产品，一部分随旧壳回滚；release 又不要求这些测试通过。修复应以恢复发布门禁、收紧信任边界和建立跨运行时 contract tests 为主线，而不是在每个红点上做局部兼容。
