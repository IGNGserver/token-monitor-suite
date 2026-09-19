# Qoder、账号来源与中枢连接问题修复计划

> **Historical Archive / 历史归档说明**
> 
> 本文档是 2026-09 分支独立与桌面端重构过程中的内部审计/计划快照，**不再维护**。
> 文中提及的旧路径（如 `worker/`、`native/macos/`、旧版 `app.js` 等）在当前代码库中已不存在。

---


状态：源码修复与本机自动化验证完成；Windows Qoder `main.sqlite` → 最终 Windows unpacked/NSIS 安装 → Electron UI/localhost fake Hub、Linux AppImage/`.deb` 及 extracted package 启动已验收；macOS、生产 Hub 连接和长运行验收待执行
分析基线：2026-09-04，`HEAD=7ef887cb326ab9427dc80f447298c64cc1f2161c`
范围：记录问题、证据、实施顺序和验收标准；本次已完成可在本机执行的源码修复与自动化验证，未发布版本。

### 0.1 本次执行结果（2026-09-05）

- 已落地 Qoder CN 的可执行 SQLite fixture、严格失败语义、共享数据路径描述、transcript watcher、读取预算、双源去重、estimated 标记和无敏感信息诊断；`QODERCN_CONFIG_DIR` 可覆盖官方默认配置根。
- 追加修正 transcript 增量边界：`sinceMs` 现在按事件真实时间过滤，而不是按当天桶的中午标记；累计 `Result` 事件只作为已处理结果，不会再次计费，并有回归测试覆盖。
- transcript 扫描现在以固定块流式读取，保留文件数、总字节、深度、单轮时限和单行上限；不会把单个 64 MiB 文件一次性载入 Electron 主进程。完整 assistant 事件即使缺少可选 `Credits` 字段也会保留，累计结果事件不会重复计费。
- transcript parser 会在不重复计费 `system` / `progress` / `result` 的前提下继承同一会话 `system.init.model`；完整 assistant 记录缺少 `model` 时仍按已声明模型归档。该兼容性回归按 Qoder CN SDK 消息形状覆盖；Windows 实机的 Qoder 0.1.4.0 `main.sqlite` 也已完成只读字段形状和适配器验收。
- 已落地 Qoder 账号的 `auto` / `manual` / `off` 来源策略、受限 Cookie/cURL/HTTP capture、macOS Chrome 自动候选、有效 Cookie 缓存失效和账号身份归并；自动能力未在 Windows/Linux UI 虚假展示。
- 已落地 provider capability 驱动的 manual-only runtime 清理与竞态保护，以及本机采集、Hub upload、REST read、SSE stream 的独立健康状态、上传保留/退避、Retry-After、恢复、网络/唤醒重连和安全 HTTP 迁移。
- 已加入 `npm run evidence:qodercn` 脱敏真机证据入口；它复用生产 parser 生成版本、源存在性、SQLite integrity、transcript 预算/事件计数、去重和 today/month/allTime 汇总，不输出路径、正文、Cookie、账号或 session 标识。带 `--require-version --require-data` 时，缺版本或 allTime 没有非零 token 会明确失败，不会伪装成通过。
- source descriptor 已补 context 回归：自定义 `homeDir`/`QODERCN_CONFIG_DIR` 会同时驱动 Qoder CN 的 DB、transcript watcher 和 source status；另有真实 localhost fake Hub 测试覆盖半开 POST、最新快照恢复、503 保留重试和 headers-only body deadline。
- Qoder CN 根目录尚未创建时，watcher 会监听最近存在的祖先目录，并只放行通向 Qoder CN 数据源的路径；归因仍使用实际 source root，新增了创建目录后实时发现 transcript 的回归测试。
- 完成性审计进一步修正 Qoder CN legacy DB watcher：使用精确 `sourcePath`，仅保留 `local.db`、WAL/SHM sidecar 及必要的创建路径；同目录无关文件不再触发 Qoder CN targeted tick，新增 watcher/attribution 回归后定向 collector 测试为 90/90 PASS。
- 完成性审计还修正了两条恢复/凭据边界：本机采集 tick 返回 handled failure 时，手工刷新会正确报告 `collection_failed`；OpenCode 环境 Cookie 保留为 automatic source，不会在 runtime config 中伪装成 explicit manual credential，因而 `manual-only` 能真正阻断它。
- upload scheduler 已修正 retryable 失败语义：更新的 summary 只替换 pending，不绕过既有 full-jitter 退避；人工 `retryNow()` 仍可主动恢复；底层 uploader 在 abort 后仍 resolve 时也会清理 active 槽并保留 summary 重试。人工同步恢复也只在 SSE 非 live 时重连，不会打断已有实时流；网络恢复和系统 resume/unlock 会强制重建半开 SSE。`npm run sync:worker`、`npm run update:hub-build`、`npm run verify`、`npm run verify:release-version` 和 `git diff --check` 均通过；当前 verify 结果为 2556 项测试、2551 通过、0 失败、5 项环境条件 skip。最新 Windows/Linux unpacked 打包通过，产物版本为 `0.45.0-rev.21`，并确认包含当前 Qoder parser、scheduler、归档和主进程代码资源。
- Windows 隔离启动还发现并修正两条真实运行时回归：collector 已调用但未导出的 `retainLiveDailyHistory` 会导致每轮 live history 归档失败；显式 `TOKEN_MONITOR_CLIENTS` 在首次保存后重启会被误当作可迁移的旧 GUI 列表，追加 `claude-desktop`/`deepseek-harness`。现在环境选择在首次启动、自动保存和重启读取中都保持原集合，并分别有归档与客户端迁移回归测试。
- `npm run evidence:qodercn` 当前结果为 `NOT RUN`：本机 Linux 没有 Qoder CN 版本、legacy DB 或 transcript root 数据；不能用 Qoder CLI 的其他统计目录替代 Qoder CN 证据。
- 本轮通过 SSH 对可达 Windows 工作站做了只读盘点：现有安装 ASAR 版本为 `0.45.0-rev.21`，旧 `%APPDATA%\\QoderCN`、`%USERPROFILE%\\.qoder-cn` 及对应数据库/Transcript 根不存在。实际 Qoder `0.1.4.0` 使用 `%APPDATA%\\com.qoder.app.stable\\main.sqlite`，`PRAGMA quick_check=ok`，含 46 条消息、6 个会话；当前适配器在实机 Node `node:sqlite` 只读后端解析出 24 条 assistant usage rows、6 个会话、模型 `Lite/qfmodel`，估算 input/output 合计分别为 6953129/2631173，且没有泄露原始 message id。现有安装未改动。
- 最终 `0.45.0-rev.21` Windows `win dir` 产物已复制到隔离临时目录并以 exe/ASAR SHA-256 核对一致：exe 为 225654784 bytes / `bf54ac48a7b17f49f2c5a37abd2ad006e828545333f121a26afa7c29eab2c1cd`，ASAR 为 18998764 bytes / `6003cfbf1071a8dc36e64a405d8833d4d6e79ad68bf69ce3db64cd47e26063a8`；从最终 ASAR 提取的 `qoderCnUsage.js`、`collector.js`、`main.js`、`dailyHistoryArchive.js`、`clientTracking.js` 与源码哈希一致。
- Windows 原生 Node 24 工作站在按锁文件 `npm ci` 后执行 `npm run dist:win` 成功，生成 NSIS 安装版和 portable 版；安装器 `Token-Monitor-Setup-0.45.0-rev.21.exe` 为 110061981 bytes / `E4295D730F528AA2F38BF44D4E5BE49A26B2C3DB07AC277F243B9B2CB09A2A6F`，以静默方式安装到全新 `%TEMP%` 目录后退出码为 0，安装 exe/ASAR 与构建目录逐一 SHA-256 一致。保持 SSH 会话启动安装副本后，CDP/renderer 读取到 `Token Monitor`、`Qoder CN 9,584,302` 和“估算”徽标；这是隔离 fresh install PASS，未覆盖现有安装，也未宣称不同版本升级。
- 本机按锁文件重新 `npm ci` 后以 Electron 43.4.0 执行 `npm run dist:linux` 成功；AppImage 为 `4845276245df92433f4b3ba7bff5bb8d68faf7e18d78d3274f1b463e58a39b68`，`.deb` 为 `c6833e652cfaa55eefe50c34fb1a5b801657402c75ea7aa09c6d217d0969234a`，包元数据为 `0.45.0~rev.21`。从 `.deb` payload 的精确临时根启动实际 Wayland renderer，CDP 在 20 秒内可达且进程保持存活；本机系统 `dpkg` 升级未执行（已有 rev.18 用户系统包/运行实例，非交互 sudo 不可用）。
- 可达 macOS 13.7.8 x86_64 VM 使用临时 Node 24.19.0 按锁文件 `npm ci` 后执行 `npm run dist:mac:x64` 成功；DMG 为 `9b9038da550346901e978cd29296a5c55349776a248a4ca12a396a8ee6e73ac0`，zip 为 `7f99796a48fce76aa188e5993b3abdff7b6475730395861a384d9e8cad2645ab`，DMG 只读挂载校验通过，隔离复制后的 `Info.plist` 为 `0.45.0-rev.21` / `com.javis.tokenmonitor`。该 VM 没有 Developer ID，builder 明确跳过代码签名；复制的 app binary 可启动并监听 DevTools，但 console user 是 root、没有 GUI 登录会话，未创建 renderer page，macOS GUI 安装启动与签名仍为 `NOT RUN`。临时 Node、源码、DMG 和 app 已清理，VM 已恢复 stopped。
- 2026-09-05 在 Windows 工作站以最终 unpacked 副本、隔离 profile 和仅监听 `127.0.0.1` 的脱敏 fake Hub 完成应用级 Qoder CN 端到端：首次启动与重启各成功 POST 一条记录；脱敏摘要均为 `deviceId=qoder-main-e2e`、`platform=win32-x64`、`qoderMainRows=24`、`qoderUsedSources=[main-sqlite]`、`qoderFailureCode=null`、`qoderEstimated=true`、`qoderMonthTokens=9584302`、`qoderAllTimeTokens=9584302`。由于真实库最新事件早于 2026-09-05，`qoderTodayTokens=0` 是日期窗口结果，不影响 month/allTime 非零对账。CDP 读取的真实 renderer 在 MONTH 视图显示 `Qoder CN 9,584,302` 和本地化“估算”徽标；两次启动的设置均保持 `clients=qodercn`、`migratedDefaultClients` 为空，watcher 只出现 Windows Roaming/Qoder 主库/用户根路径，没有追加默认客户端。该项关闭了“真实 Qoder 主库 → Electron 采集 → UI → localhost Hub POST”证据链，但 fake Hub 不替代生产 Hub、跨平台安装或长运行验收。
- 生产 Hub 检查仍受网络/服务状态阻断：NAS alias `192.168.5.17` 从 Linux/PVE 返回 `No route to host`；Windows 工作站虽能建立到 `22`/`17321` 的 TCP 连接，但直接请求 `/api/health` 在约 5 秒后得到 empty reply（HTTP `000`），HTTPS 握手也失败，未得到任何可验证的 Hub API 响应。为排除 PVE 内部替代目标，曾只读启动并检查 `NAS-Windows` VM 100（guest IP `192.168.5.9`），确认无 `17321` listener 后已恢复为 stopped，未执行部署或数据操作。
- `macos13-vm`（`192.168.5.25`）仍为 `No route to host`；可达的 `macos26-vm`（`192.168.5.29`）启动后实际为 macOS 13.7.8 x86_64 的干净基础系统，没有 Chrome、Qoder、Node 或 Token Monitor，检查后已恢复 stopped，因此真实 macOS Chrome global/CN 自动导入仍为 `NOT RUN`。Windows 工作站和两台 Ubuntu VM 可达，但 Ubuntu 没有 Qoder CN 数据。不同版本安装升级（Windows 仅完成 fresh install，Linux 仅完成 package/extracted 启动）、断网/半开连接/睡眠唤醒/Hub 重启和 12 小时长运行验收仍为 `NOT RUN`。
- 以下仍必须在目标环境执行，当前记录为 `NOT RUN`：生产 Hub（而非 fake Hub）上的真实部署/权限/多设备对账；真实 macOS Chrome global/CN 自动导入；不同版本安装升级（Windows 仅完成 fresh install，Linux 仅完成 package/extracted 启动）；断网/半开连接/睡眠唤醒/Hub 重启和 12 小时长运行验收。因此本文的整体 DoD 尚未宣告完成。

说明：下方第 1 至 6 节保留 2026-09-04 的修复前审计证据；其中“已确认”“没有实现”等表述是当时的基线，不是对当前工作树的重复结论。当前可在本机完成的修复状态以本节为准，真实环境仍以第 9 节逐项证据为准。

## 1. 结论

本轮开发不能判定为“Qoder 适配完成”，连接恢复也没有闭环。需要同时处理三个相互独立、但在实测中会叠加的问题域：

1. **Qoder 有两条不同链路，被开发和验收混在了一起。** `qodercn` 是本地 Token 用量适配器；`qoder` 是“账号”页中的额度账号提供方。最近的 rev.21 改动只给 `qodercn` 增加了模型映射和一套 fork 自己编写的 transcript 估算器，没有给 `qoder` 实现上游 CodexBar 的浏览器 Cookie 自动探测。
2. **`qodercn` 虽然有源码，但尚未达到可交付状态。** 当前安装运行的是 rev.20，界面里没有 `qodercn` 开关；rev.21 源码虽补回开关，却没有监听新的 transcript 路径，提交的 SQLite 端到端 fixture 已损坏且错误地被测试标为 skip，也没有真实 Qoder 数据验收。
3. **中枢同步没有统一的连接生命周期。** 本机采集、POST 上报、REST 拉取和 SSE 订阅是四条松散链路。“刷新”只覆盖采集和 REST；POST 失败时没有无条件自动重试，rev.20 的 POST/SSE 还可能永久挂起。rev.21 加了超时和 SSE 静默检测，但仍没有上传重试、启动就绪屏障、休眠/网络恢复处理或一键恢复语义。

因此，下一任务不得只修一个按钮或把现有分支 cherry-pick 回来；必须按本文的分阶段任务和验收矩阵完成。

## 2. 审计基线与这两天的开发内容

### 2.1 Git 与发行状态

| 对象 | 已核实状态 |
|---|---|
| 分析开始前工作树 | 干净；`main` 比 `origin/main` 超前 1 个提交 |
| 已发布标签 | `v0.45.0-rev.21` 指向 `43949b2`，GitHub prerelease 已有桌面、Android 和 Hub 产物 |
| 未发布提交 | `7ef887c fix(electron): trigger mode restart when allowInsecureHubHttp changes` |
| 当前本机进程 | `/home/lvziw/.local/share/token-monitor/rev20-root/token-monitor`，2026-09-02 23:21 启动，仍是 `0.45.0-rev.20` |
| 当前本机 Hub 实况 | 审计时 `/health=200`；Hub 中本机记录为 `0.45.0-rev.20/electron-widget`、`stale=false`。本次没有现场复现间歇性断线 |
| 当前本机 Qoder 数据 | 预期 SQLite 和 `~/.qoder-cn/projects` 均不存在；本机不是 Qoder 真机验收环境 |

不能用“当前这一刻 Hub 正常”否定间歇性故障，也不能用当前 Linux 主机的零行结果证明 Qoder 适配正确或错误。连接问题有确定的代码失效链；Qoder 最终验收必须在存在真实数据的目标机器进行。

### 2.2 2026-09-03 至 2026-09-04 的提交时间线

Git 在 9 月 3 日没有独立提交；主要工作被压进 9 月 4 日的一个大提交，然后连续追加修复：

| 提交 | 内容及与本计划的关系 |
|---|---|
| `9a46c25` | 从 rev.18 基线形成 rev.21 大提交，155 个文件、7436 行新增、4535 行删除；提交说明称适配 Qoder CN 0.1.x transcript，同时混入安全、Hub、Android、Worker、诊断等大量改动 |
| `2dac8f0` | 5 秒后合并 rev.20 的跨设备同步/Windows Antigravity 修复线 |
| `81e251d`、`4a6f31b`、`c3e3f6b` | 测试环境与挂起 mock 等跟进修复 |
| `3af081c` | 修正 HTTP 请求超时 timer 被 `unref()` 的问题 |
| `43949b2` | 修正 macOS 独立发行构建并打 `v0.45.0-rev.21` 标签 |
| `7ef887c` | 让 `allowInsecureHubHttp` 改动触发模式重启；当前尚未发布 |

从 rev.20 到已发布 rev.21 的实际差异仍有 154 个文件、6610 行新增、5109 行删除。如此大的发布差异不适合用一次源码测试绿灯代替分功能验收；后续修复必须拆成可独立验证的提交。

## 3. 先统一术语和预期

| ID | 当前职责 | 数据源 | 当前结论 |
|---|---|---|---|
| `qodercn` | 本地 Token/成本/历史统计 | 旧版 Qoder CN SQLite；rev.21 另加 `~/.qoder-cn/projects/**/*.jsonl` 估算 | 源码部分存在，实时接线、fixture、真实验收不完整 |
| `qoder` | “账号”页的 Qoder big-model credits | 手动保存或环境变量提供的 dashboard Cookie，再请求 Qoder API | 只有手动/环境变量，没有浏览器自动探测 |

上游也必须区分：

- Javis Token Monitor 的当前 `qoderCnUsage.js` 是旧的 SQLite 本地适配器。审计固定到 `Javis603/token-monitor@e9df2c8afd975d8873113dfe1d8183935c6dd393`。
- CodexBar 的 Qoder provider 是账号额度适配器，支持 `Automatic` / `Manual` / `Off` 来源策略、macOS Chrome Cookie 导入、有效 Cookie 缓存、失效后清缓存并尝试下一候选，以及 Cookie header/cURL/HTTP capture 的手动解析。审计固定到 `steipete/CodexBar@30f881aee0e8dce08690d8eb971a2a44ef1285be`。

相关上游证据：

- <https://github.com/Javis603/token-monitor/blob/e9df2c8afd975d8873113dfe1d8183935c6dd393/src/shared/qoderCnUsage.js>
- <https://github.com/steipete/CodexBar/blob/30f881aee0e8dce08690d8eb971a2a44ef1285be/docs/qoder.md>
- <https://github.com/steipete/CodexBar/blob/30f881aee0e8dce08690d8eb971a2a44ef1285be/Sources/CodexBarCore/Providers/Qoder/QoderProviderDescriptor.swift>
- <https://github.com/steipete/CodexBar/blob/30f881aee0e8dce08690d8eb971a2a44ef1285be/Sources/CodexBarCore/Providers/Qoder/QoderCookieImporter.swift>

CodexBar 为 MIT 许可。移植时应保留许可/归属，并移植行为与测试，不要逐行机械翻译 Swift。

## 4. 已确认问题

### QD-01：近期交付的不是完整的“上游 Qoder 适配”

严重度：高
状态：已确认

证据：

- rev.20 到 rev.21 没有修改 [`src/shared/qoderLimits.js`](src/shared/qoderLimits.js) 或其测试；当前实现仍只从 `options.qoderCookie` / `QODER_COOKIE` 取值，无 Cookie 就返回 `notConfigured`。
- “账号”页的 Qoder 卡片只有站点选择、打开浏览器、粘贴 Cookie、清除和刷新控件，[`src/electron/renderer/index.html`](src/electron/renderer/index.html) 没有自动来源模式。
- 当前展示能力标签明确是 `['Manual login', 'Web']`，没有 `Auto`。
- rev.21 新增的是 [`src/shared/qoderCnUsage.js`](src/shared/qoderCnUsage.js) 中 fork 自己的 transcript 启发式估算；它不在 Javis 上游固定版本中，也不是 CodexBar 的 Qoder 账号自动探测实现。

结论：如果需求是“复制 CodexBar 的 Qoder 额度适配”，它根本没有落地；如果需求是“让新版 Qoder CN 本地 Token 可统计”，当前也只能算未经真实数据验证的部分实现。

### QD-02：rev.20 安装版无法从 GUI 启用 `qodercn`

严重度：高
状态：rev.20 已确认；rev.21/HEAD 源码已修，发行/真机未验收

`v0.45.0-rev.20` 的 shared registry 知道 `qodercn`，但 renderer 的 `KNOWN_CLIENTS` 没有它，因此 opt-in 适配器无法在 GUI 打开。rev.21 已把 `qodercn`、label、icon 和 renderer registry 补回；当前正在运行的仍是 rev.20，而且用户设置中的 `clients` 不含 `qodercn`。

这不是继续改业务逻辑的理由，而是要求下一发行必须做“安装产物 + 实际设置开关 + 实际采集”的完整验收。`AUDIT.md` 中对应旧发现对 rev.20 成立，对当前 HEAD 不应重复修一次。

### QD-03：新 transcript 数据源没有接入 watcher/source registry

严重度：高
状态：已确认

[`src/shared/qoderCnUsage.js`](src/shared/qoderCnUsage.js) 会扫描 `~/.qoder-cn/projects/**/*.jsonl`，但 [`src/shared/collector.js`](src/shared/collector.js) 给 `qodercn` 注册的 source/watch root 仍只有旧 SQLite 的父目录和文件。

直接后果：

- 新 transcript 写入不会触发 3–5 秒的 live targeted tick，只能等周期扫描或人工强制采集。
- 只存在新版 transcript 的机器可能被 source status 错报为 missing。
- watcher attribution 不知道事件属于 `qodercn`。

### QD-04：Qoder CN 端到端 fixture 已损坏，但测试把数据损坏伪装成“无 SQLite 后端”并跳过

严重度：阻断验收
状态：已确认

当前 fixture：

- 路径：`tests/fixtures/qoder-cn-local.db`
- 大小：16540 bytes
- SHA-256：`4bf5f4971a76797fc5ac3c6576edb0a279ed32f0f2a0dcf7d70c3e30fe6bf877`
- `PRAGMA quick_check` / 查询结果：`database disk image is malformed`
- 文件中出现 UTF-8 replacement bytes `ef bf bd`，说明二进制内容曾被当文本改写。

上游/仓库历史中的原 fixture：

- 大小：16384 bytes
- SHA-256：`73f37f56c29eeb0c87706197886ef9fe38b10db04d84c372679c263a49a2225d`

[`tests/shared/qoderCnUsage.test.js`](tests/shared/qoderCnUsage.test.js) 的三个端到端测试捕获所有异常后统一 `t.skip('no sqlite backend available...')`，因此数据库损坏也会以成功退出。重跑 Qoder 与上传调度的直接相关测试，结果是 **43 tests / 40 pass / 3 skipped / 0 fail**，三个 skip 全部来自损坏 fixture。

### QD-05：transcript 扫描会同步全量读文件，并在完整历史 tick 中重复扫描

严重度：中高
状态：代码问题已确认；是否直接造成某一次断线尚未复现

[`collectQoderCnTranscriptRows()`](src/shared/qoderCnUsage.js) 使用递归 `readdirSync`、`statSync`、`readFileSync`，单文件允许 64 MiB，但没有总文件数、总字节、目录深度或整轮耗时预算。完整 tick 先为 period 扫一次；启用 history 时又先无条件扫一次 transcript，即使非 anchored tick 随后复用第一次的 `qoderCnRows`，第二次结果也没有被使用。

采集器、IPC、POST 和 SSE 都运行在 Electron main 进程。大 transcript 树会阻塞该进程，是连接不稳定的高可信放大因素。没有故障日志前，不把它写成已复现的唯一断线根因。

### QD-06：新版 transcript 的正确性契约没有闭环

严重度：高
状态：已确认缺少证据

当前测试只用代码内构造的 JSONL，仓库没有来自真实 Qoder 0.1.x 的脱敏结构 fixture，也没有真机的“原始事件数量 → parser rows → today/month/allTime → UI/Hub”对账。另有以下未定义行为：

- SQLite 和 transcript 同时有正用量时直接 concat，没有跨源去重或明确优先级。
- transcript token 是字符启发式估算，不是 Qoder 返回的精确 token；产品/API 没有标记 estimated。
- transcript 目录的项目名被丢弃，所有汇总 `projectLabel=''`。
- 路径或 schema 不匹配时通常返回空数组，会表现为合法零用量而不是可诊断错误。

### AC-01：“只显示手动账号/关闭自动探测”设置不在主线

严重度：高
状态：已确认

当前 rev.20、rev.21 和 HEAD 的业务源码中均没有 `limitProviderAutoDetectDisabled`。历史侧分支有 `a285109 feat(limits): add per-provider account source controls`，但它不是 HEAD 的祖先，不能视为已交付。

该侧分支也不能直接 cherry-pick：它主要在 fresh collector 层过滤自动来源，却没有证明切换后会同步清除 `LimitsRuntime` 中已有的 auto `lastGood`。当前 runtime 对 `unavailable` 等瞬时状态会保留 `lastGood`，因此旧自动账号可能继续留在结果中，违背“关闭后只显示手动账号”的要求。

### ST-01：启动时存在自动“尝试”，但没有端到端启动就绪保证

严重度：高
状态：已确认

需要修正现象描述：源码并非完全没有启动刷新。

- `startCollector()` 会立即调用 `loop()`，所以会开始首轮采集。
- renderer 的 `init()` 会调用一次不带 `force` 的 `refreshStats()`。

真正的问题是：

- `startMode()` 是 fire-and-forget 的队列操作，不返回可等待的 ready 结果；失败只写 main log。
- 首次 renderer refresh 只拉 `/api/stats`，不等待本机首轮采集与首次 POST 成功。
- `DeviceRuntime` 对 `sink.enqueue()` 采用 detached promise；usage tick 成功不等于上传成功。
- 启动没有统一状态表明“本机采集成功、上报成功、REST snapshot 成功、SSE 已连通”各自是哪一步。

因此，用户看到窗口完成启动并不代表本机已上报，也不代表断线恢复器已经工作。

### UP-01：上传失败后，在没有新 summary 时不会自动重试

严重度：高
状态：已确认

[`src/electron/syncUploadScheduler.js`](src/electron/syncUploadScheduler.js) 在开始上传前清掉 `pendingSummary`。若上传失败且期间没有更新数据，它不会把失败的最新 summary 放回 pending，也不会建立 retry timer。实测最小探针结果：

```json
{"attempts":1,"timers":0,"automaticRetry":false}
```

现有测试只证明“失败后再 enqueue 一条新 summary 可以立即发送”或“in-flight 时恰好来了更新会发送最新一条”，没有覆盖“启动时第一次上传失败、之后没有文件事件”的恢复。

### UP-02：rev.20 的 POST 可以永久 pending，后续刷新也无法解除

严重度：高
状态：rev.20 已确认；rev.21 超时部分已修

rev.20 的 `postSyncPayload()` 直接调用 `fetch()`，没有连接/响应体 deadline。若网络形成 half-open：

1. scheduler 的 `uploadInFlight` 永远不清空；
2. 后续采集或手动刷新只会覆盖 `pendingSummary`；
3. `flush()` 也会永久等待同一个 active promise；
4. 退出进程会清掉内存状态，所以“退出重开才恢复”与此完全一致。

rev.21 已通过 `fetchBufferedWithTimeout()` 给 POST 和响应体加 15 秒边界，`3af081c` 又修正 timer 生命周期；但 UP-01 的失败后自动重试仍未解决。

### SS-01：rev.20 SSE 能在明确 EOF/error 后重连，但 half-open 时永远不会进入重连分支

严重度：高
状态：rev.20 已确认；rev.21 部分已修

rev.20 的 SSE `fetch()` 和 `reader.read()` 都没有 deadline。只有非 2xx、EOF 或 promise reject 才会 `scheduleStreamRetry(3000)`，静默连接会永远保持在 pending。

rev.21 已增加：

- 15 秒连接 deadline；
- 90 秒 SSE idle watchdog；
- Hub/Worker 每 30 秒 heartbeat；
- EOF/error 后固定 3 秒重连。

仍缺失：指数退避与 jitter、网络恢复/休眠恢复事件、统一 generation 防旧连接回写、可观测的 attempt/last-event/next-retry，以及人工立即恢复入口。

### RF-01：“刷新”不是连接恢复操作

严重度：高
状态：已确认

当前按钮调用 `refreshStats({ force: true, forceHistory: true })`。main 侧会强制 usage/limits tick，然后 GET `/api/stats`；它不会：

- 重启或优先重试 SSE；
- 取消/替换卡住的 POST；
- 要求 upload scheduler 对最新 summary 做一次 bounded flush；
- 等待/显示本机上报结果。

所以“刷新有时能更新界面，但红点仍离线”“刷新完全没用，只能退出重开”都是当前语义可产生的结果。

### HT-01：rev.21 的远程 HTTP 安全迁移存在同进程恢复漏洞

严重度：高
状态：已发布 rev.21 有问题；HEAD 已有窄修复但未发布

rev.21 默认拒绝非 loopback 的 HTTP Hub，除非 `allowInsecureHubHttp=true`。这是合理的安全默认值，不能通过迁移静默开启。但是：

- 旧 rev.20 profile 没有该字段；升级 rev.21 后 `effectiveHubConfig()` 会在 `startMode()` 内抛 `insecure_hub_transport`。
- `startMode()` 的 catch 只写日志，采集/上传/SSE 都可能没有启动。
- rev.21 标签中的 `MODE_STRUCTURAL_KEYS` 漏了 `allowInsecureHubHttp`。用户勾选允许可信 LAN HTTP 并保存后，当前进程不会重建 mode；REST refresh 可能成功，但 collector/SSE 仍未启动，只有退出重开才恢复。

HEAD 的 `7ef887c` 已把该字段加入 structural key，但尚未进入任何 release，而且没有解决启动失败时继续本地采集、向 UI 发布稳定错误、自动恢复等完整问题。

### OB-01：界面只展示 SSE 读通道状态，上报失败只在日志里

严重度：中高
状态：已确认

当前 `streamConnected` 只表示 `/api/stats/stream`；`postToHub()` 的失败仅写 `[sync-collector]` log。实际存在两个独立健康面：

- 读：REST/SSE 是否能取中枢统计；
- 写：本机 `/api/ingest` 是否被中枢接收。

目前 UI 会把二者压成一个“Live/Offline”点，既可能 SSE live 但本机长期不上报，也可能 SSE offline 但 REST refresh 能取到数据。没有 `lastUploadSuccessAt`、`lastStreamEventAt`、失败码、连续失败数或下一次重试时间，现场很难区分。

## 5. 当前链路为何会出现用户描述的组合现象

```text
                       ┌─ GET /api/stats ───────────────→ 更新当前界面
renderer“刷新” ─ force tick
                       └─ 产生 record ─ detached enqueue ─→ POST /api/ingest
                                                          （失败可能丢失重试；rev.20 可永久挂起）

独立后台链路：GET /api/stats/stream ─────────────────────→ Live/Offline 红点
              （“刷新”不重建；rev.20 静默连接不超时）
```

因此，一次 GET 成功不能证明本机 POST 成功；本机产生了新 record 也不能证明 detached POST 成功；点击刷新也不能证明 SSE 已恢复。

## 6. 实施计划

以下阶段按顺序执行。每个阶段应独立提交、跑对应测试；不得在最后一个大提交中同时完成。

### 阶段 A：先修 Qoder CN 的可验证性和实时接线

1. **恢复二进制 fixture。** 从固定上游提交或本仓库 `e27ad3b` 以 binary-safe 方式恢复 `tests/fixtures/qoder-cn-local.db`；核对 16384 bytes 和 SHA-256 `73f37f...a2225d`。
2. **让真实错误失败。** 三个 fixture 测试只有在明确的 backend absence（例如 sqlite3 `ENOENT` 且 `node:sqlite` 模块不存在）时才允许 skip；数据库损坏、schema 错误、SQL 错误、超时都必须 fail。增加 `PRAGMA quick_check` guard。
3. **取得真实 0.1.x 数据证据。** 在目标机器确认实际版本、真实数据根、文件名、事件 schema、时间戳、模型字段、usage/credits 字段；制作结构忠实、去 Cookie/账号/对话内容的最小 transcript fixture。禁止继续依据注释或手写 JSON 推断生产 schema。
4. **统一 source descriptor。** 让 `qoderCnDataPaths()` 同时返回 legacy DB 与 transcript roots，供 parser、source status、watcher、配置 fingerprint 共用，避免再次出现“能扫但不监听/不显示已检测”。
5. **接入 live watcher。** 把 transcript root 加入 `clientWatchCandidates()` 和 attribution；新增测试证明创建/追加 JSONL 事件会只触发 `qodercn` targeted tick，并在 3–5 秒产品承诺内更新。
6. **消除主进程同步双扫。** 一轮 collection 只读一次相应时间窗；history 复用 full rows。改为有界的异步/流式读取或把解析移出 Electron main 的关键事件循环；至少限制总文件数、总字节、深度、单轮耗时，并输出不含内容的诊断计数。
7. **定义双源规则。** 用真实样本确定 SQLite/transcript 是否版本互斥；若可能重叠，使用稳定 request/message identity 去重。无法证明 identity 时采用明确的 source precedence，不能直接 concat。
8. **标记估算。** 如果 0.1.x 确实没有精确 token，只能显示估算值；wire/UI/README 要明确 `estimated`，并说明公式及不包含的系统提示/工具 schema。不能以精确 token 或精确成本发布。
9. **补 source diagnostics。** 至少记录：候选根是否存在、匹配文件数、读取文件数/字节数、识别/忽略事件数、最后数据时间、使用的源、失败码、是否 fallback/estimated。不得记录路径中的用户名、对话正文或凭据。
10. **安装产物验收。** 在 rev.21 之后的新构建中确认 Settings → Collection 能看到并启用 Qoder CN，重启后设置保留，实际 record、Hub 和 UI 都有 `qodercn`。

### 阶段 B：真正移植 Qoder 账号额度适配

1. 以固定 CodexBar 提交为行为参考，实现 `off`、`manual`、`auto` 三态；当前手动 Cookie 兼容路径继续可用。
2. 先把上游的安全手动输入语义移植到所有桌面平台：接受纯 `Cookie:` header、受限 cURL capture、受限 HTTP request capture；只允许 `qoder.com` / `qoder.com.cn`，从可信 URL/Host 推断站点，拒绝冲突 host、shell substitution、多目标 URL 和不安全参数。
3. 自动探测按上游真实能力声明。固定 CodexBar 版本仅在 macOS 声明 Chrome 自动导入；第一阶段不得在 Windows/Linux UI 虚假展示可用。若要跨平台，需要单独批准、评审浏览器 Cookie 解密依赖/原生 helper；项目当前没有这套基础设施，且 AGENTS.md 禁止未讨论就加依赖。
4. 自动模式按候选顺序探测 global/CN 与 Chrome profiles，只缓存**已被 API 验证有效**的 Cookie header。401/403 清除对应缓存并继续下一候选；网络/5xx 保留 last-good 但不能误报 unauthorized。
5. 原始 Cookie 只在 main/shared 与统一 credential store 中存在，renderer 只收到 configured/source/status。POSIX 权限沿用 `0600`；日志、诊断、Hub wire、崩溃报告不得包含 Cookie/cURL 原文。
6. account identity 不能继续只用 Cookie hash 表示用户身份。优先使用 Qoder 返回的稳定用户标识；没有稳定 ID 时才使用 credential-derived 私有 key，并保证 Cookie 更新不会让同一账号永久重复。
7. 增加 global/CN、manual/auto/off、缓存命中、缓存失效、候选切换、恶意 capture、超时/401/429/5xx、凭据不出 renderer 的测试。
8. 在真实 macOS Chrome 分别验收 qoder.com 与 qoder.com.cn；至少用一个有效登录和一个过期 Cookie 证明自动恢复链。

### 阶段 C：实现每个账号提供方的“只显示手动账号”策略

1. 采用已经出现过的兼容键 `limitProviderAutoDetectDisabled`，持久化为规范化、去重的 provider ID CSV；默认空，保持现有用户自动探测开启。若决定改名或改结构，先写 migration 与兼容读取，不能同时保留两个事实源。
2. 在每个同时具有 manual 和 automatic 来源的账号面板显示开关：
   - 关闭“自动探测”时，只探测 GUI/credential store 中显式保存且启用的账号；
   - env、CLI/system login、Keychain、本机 app、browser、ambient credential 都视为 automatic，不显示；
   - 没有手动账号时，面板保留添加入口并显示“未配置”，不能用旧 auto last-good 填充；
   - 纯自动、没有手动登录能力的 provider 不展示一个无法满足语义的开关。
3. 建立 provider source capability 表，不在 renderer 手写一份全量列表。collector 和 UI 从同一份 metadata 判断哪些来源是 manual/automatic、是否支持开关。
4. 给每个 provider row 增加不含敏感信息的 credential-origin 分类，和现有表示传输方式的 `source=web/rpc/...` 分开；去重时优先保留用户命名、手动管理的账号元数据。
5. 切换到 manual-only 时必须原子完成：提高 provider epoch、取消在途 auto probe、立刻隐藏/清理所有 auto identities、保留仍允许的 manual identities，然后只刷新该 provider。旧 promise 返回后不得把 auto row 写回来。
6. 切回自动时立即触发该 provider 的 auto discovery；失败按 provider retry policy 处理，不重启 usage collector。
7. 不直接 cherry-pick `a285109`。可以复用其 setting 名和 UI 文案，但必须新增 runtime retention/竞态测试：
   - 初始 manual + auto 两行；
   - 关闭后同一刷新周期只剩 manual；
   - 关闭时有 auto probe in-flight，迟到结果不能复活；
   - 重启仍为 manual-only；
   - 再开启后 auto 可重新发现；
   - auto transient failure 只保留仍被策略允许的 last-good。

### 阶段 D：把采集、上报、REST 与 SSE 纳入可恢复生命周期

#### D1. 解耦本机采集与 Hub 传输

- Hub URL 无效、HTTP 被安全策略阻止、鉴权失败或网络离线时，本机 collector 仍必须启动并持续产生最新 snapshot。
- 传输层只保留最新 snapshot，连接恢复后上报；不要把无法连接 Hub 等同于退回一个会停止上报职责的临时 local mode。
- `startMode()`/reconcile 返回 promise 和结构化结果，不再仅 log 后吞掉；每次配置变更使用 generation，旧 SSE/POST/回调不能污染新配置。

#### D2. 重写 upload scheduler 的失败语义

- 最新 summary 只有在 2xx 响应体完成后才算 delivered；失败时继续保留，更新 summary 以 latest-wins 替换。
- 延续 rev.21 的连接+body deadline。
- 对网络错误、408/425/429、5xx 自动指数退避并加 full jitter，建议 base 1 秒、cap 30 秒；429/503 尊重 `Retry-After`。
- 401/403/不可恢复的 4xx 不做无限快速重试，发布稳定错误，等待 credential/config change 或人工重试。
- 全程只允许一个 active POST；stop/config generation change 必须 abort 并清 timer。
- 提供 `retryNow()/flushLatest()`，返回本次 bounded attempt 的明确结果与 last-success，不再要求出现下一条文件事件。
- 增加 `getDiagnostics()`：state、lastAttemptAt、lastSuccessAt、failureCode/status、consecutiveFailures、nextRetryAt、pendingRevision、inFlightAgeMs。

#### D3. 完成 SSE supervisor

- 保留 15 秒 connect deadline、heartbeat 与 idle watchdog。
- EOF、idle、网络错误后使用有 jitter 的 capped backoff；成功收到 snapshot/event 后复位 backoff。
- 同一 generation 只能有一条 active stream 和一个 retry timer。
- 监听 Electron `powerMonitor` resume，以及可用的在线/网络状态变化；恢复时立即 abort 旧 half-open stream 并重连，而不是等 90 秒。
- SSE 离线期间保留有界 REST polling 作为读侧降级；REST 成功只表示读侧可用，不能把 SSE 状态伪装成 live。
- 发布 lastConnectAttemptAt、lastEventAt、lastHeartbeatAt、nextRetryAt 与稳定 failure code。

#### D4. 定义真正的启动刷新

在线启动的顺序与并行关系应明确：

1. 加载并校验设置，注册 IPC/状态订阅；
2. 启动本机 collector；
3. 并行启动 REST bootstrap 与 SSE supervisor；
4. 首个完整本机 record 到达后立即进入 upload scheduler；
5. UI 分别显示 collecting / local-ready / upload-pending|ok|failed / stream-connecting|live|backoff；
6. readiness 不能无限等待，超时后继续后台重试并展示可操作错误。

启动成功的判据不是“窗口打开”，而是至少有明确结果说明每一条链路当前的状态。

#### D5. 重新定义人工“刷新”

非 Status 页面点击一次刷新应调用一个 main-process `recoverNow()`：

1. 强制本机 usage/limits tick；
2. 取得最新 record 后调用 bounded `flushLatest()`；
3. 立即重试 REST snapshot；
4. 若 SSE 非 live，取消旧 backoff/half-open 并立即重连；
5. 返回四部分结果，UI 只有全部要求步骤成功才显示整体“已刷新”，否则显示具体失败项和后台是否仍会重试。

不得通过 renderer 连续调用四个松散 IPC 来模拟事务；恢复协调应由 main-process supervisor 持有。

#### D6. 修完远程 HTTP 升级链

- 把 `7ef887c` 纳入下一发行并保留测试。
- 不自动把旧 profile 的 `allowInsecureHubHttp` 改为 true。
- 旧 HTTP profile 启动时继续本机采集，读写传输进入 `blocked/insecure_hub_transport`，UI 明确提示需要 HTTPS 或勾选可信 LAN/VPN。
- 用户同进程勾选并保存后必须立即启动 POST/SSE，无需窗口刷新或退出重开。
- 用户取消允许时立即停止不安全传输、保留本机采集，并清晰显示 blocked。

#### D7. 分开显示读写健康

至少向 renderer 暴露：

| 状态 | 代表什么 |
|---|---|
| Local collection | 本机最近一次采集是否成功 |
| Hub upload | 本机最近一次 `/api/ingest` 是否被接受 |
| Hub read | 最近一次 REST snapshot 是否成功 |
| Live stream | SSE 是否活跃、最后事件时间与下次重连 |

总状态可以摘要，但不能再用单一 `streamConnected` 代表全部同步健康。所有错误文本使用稳定机器码映射，不把 HTML 响应或可能含敏感信息的原始异常直接显示/上传。

### 阶段 E：文档、兼容与发行

1. 更新 README 各语言、配置文档和 Qoder 帮助，明确 `qoder` 与 `qodercn`、自动探测平台范围、estimated token、手动-only 语义和远程 HTTP 安全迁移。
2. settings 新字段按兼容面处理，验证旧 profile、损坏 profile、env override 和 credential store migration。
3. 若 shared closure 中的文件发生变化，运行 `npm run sync:worker` 并确认 generated copies 无 drift；若 Hub 协议/capabilities/build 内容变化，运行 `npm run update:hub-build`。
4. 新版本按项目规则使用 `0.45.0-rev.N`，先 prerelease；不要复用 rev.21 标签。
5. 发行说明必须把“源码/自动化通过”和“真实 Qoder、真实浏览器、睡眠/网络恢复、安装产物验收”分开报告。

## 7. 建议提交拆分

提交标题示例，实际 subject 按最终 diff 调整：

1. `test(qodercn): restore executable database fixture`
2. `fix(qodercn): watch and bound transcript collection`
3. `feat(qoder): add validated account source modes`
4. `feat(accounts): allow manual-only provider discovery`
5. `fix(sync): retain and retry the latest upload`
6. `fix(sync): recover streams after idle and resume`
7. `fix(electron): make refresh repair hub transport`
8. `docs(qoder): distinguish local usage from account credits`

不要使用“fix P0”“review findings”“hardening pass”之类标题，不要添加 AI `Co-Authored-By`。

## 8. 自动化验证矩阵

### 8.1 Qoder/Qoder CN

- pristine SQLite fixture `PRAGMA quick_check=ok`，三个端到端用例必须 PASS，不能 SKIP；
- backend 真缺失才 SKIP，corrupt/schema/query/timeout 必须 FAIL；
- 真实结构脱敏 transcript fixture 覆盖 global/CN 或明确仅 CN、本地时区边界、坏行、超大文件、增量追加；
- 目标机先执行 `QODERCN_VERSION=<实际版本> npm run evidence:qodercn -- --require-version --require-data`，保存脱敏 JSON；该入口只输出可对账的版本、源/完整性状态、计数、模型名和周期汇总，不能替代真实 UI/Hub/安装验收；
- DB-only、transcript-only、两者并存、两者失败、路径变化、重启 anchor；
- watcher 追加事件触发单客户端 refresh；
- full tick 只遍历一次 transcript；总读取预算与超限 failure code；
- `qoder` manual header/cURL/HTTP parser 的 host allowlist 和 shell 注入拒绝；
- auto cache、invalid cache、下一 profile/site、off/manual/auto；
- renderer/preload/default-deny 检查确保 Cookie 不出 main process。

### 8.2 账号来源策略

- provider capability 与 UI 开关一致；
- manual-only 的 fresh、已有 last-good、in-flight race、重启持久化、重新开启；
- 同一身份的 manual/auto 去重，并保留手动名称；
- env/CLI/Keychain/browser/ambient 在 widget manual-only 下确实被排除；
- headless agent 的 CLI/env 行为不被 GUI-only setting 意外破坏。

### 8.3 Hub 故障注入

可控 fake Hub 至少覆盖：

- 启动时离线，随后恢复；
- POST 连接永不返回、只返回 headers 不返回 body、EOF/reset、DNS、refused；
- 401/403、408、413 reduced retry、429 + `Retry-After`、500/503；
- SSE 连接无 headers、headers 后静默、heartbeat 后静默、正常 EOF、非法 event；
- 失败期间连续产生多条 summary，只提交最新一条且无并发 POST；
- mode/URL/secret/allow-insecure 在 active retry 和 active stream 中切换，旧 generation 不回写；
- `recoverNow()` 在 active/idle/backoff/blocked 各状态下均有 bounded 结果；
- sleep/resume 和网络 offline/online 后无须重启进程即可恢复。

本机已执行 `tests/electron/syncHubFaultInjection.test.js`（3/3 PASS），覆盖真实 localhost HTTP 的半开 POST、最新快照串行恢复、503 pending 重试和 headers-only body deadline；其余 Electron 主进程生命周期、SSE watchdog、DNS/refused、模式切换和睡眠/网络恢复仍须在可运行的目标桌面环境执行，不能由这组底层 fake Hub 测试替代。

本轮另以最终 Windows unpacked 副本和真实 Qoder `main.sqlite` 做了受控应用级验收：两次启动均完成 `qoderMainRows=24` 的 `main-sqlite` 采集和成功 POST；renderer 的 MONTH 视图显示 Qoder CN 非零值并标出估算。fake Hub 只验证本机 Electron→HTTP 接收链，不代表生产 Hub 或完整故障矩阵通过。

### 8.4 项目级门禁

```bash
npm run sync:worker          # 仅当共享闭包发生变化；随后确认无 drift
npm run update:hub-build     # 仅当 Hub build/capability 内容变化
npm run verify
npm run verify:release-version
git diff --check
```

还应对将要发布的平台构建 unpacked/安装包，并从产物内部核对版本与 Qoder 代码/资源，不以源码目录存在代替产物证明。

## 9. 真实验收矩阵与时限

每一项必须记录 `PASS`、`FAIL` 或 `NOT RUN`，附版本、平台、时间和可脱敏证据。

| 场景 | 通过标准 |
|---|---|
| Qoder CN 0.1.x 真机 | 启用后已知会话产生非零、可对账的 `qodercn`；新事件 5 秒内进入本机 UI，下一次成功 POST 后出现在 Hub；若为估算，UI 明示 estimated |
| Qoder 账号 manual | global 与 CN 各至少一次；手动 Cookie/capture 登录后额度、账号、站点正确，重启仍可用 |
| Qoder 账号 auto | macOS Chrome 有效登录可发现；过期缓存会清除并找到新 Cookie；没支持的 OS 不显示虚假 Auto |
| manual-only | 同一 provider 同时准备手动和自动账号；关闭后只剩手动，重启不复活自动，重新开启可恢复 |
| 在线冷启动 | collector 立即开始；首个完整 record 完成后 20 秒内 Hub `receivedAt` 前进，SSE/REST 状态分别可见 |
| 离线冷启动 | 本机仍有数据；网络恢复后 30 秒内最新 snapshot 上报并自动重连，无人工刷新/重启 |
| half-open POST | 15 秒边界后进入 retry；恢复后自动上传最新 snapshot，期间手动刷新不会永久等待 |
| half-open SSE | 无 heartbeat/event 后在设定 idle 窗内重连；网络/系统 resume 触发立即重连 |
| 人工刷新 | 20 秒内返回 collection/upload/REST/SSE 分项结果；可从 rev.20 所描述的 stuck 状态恢复或明确报不可恢复原因 |
| HTTP 安全迁移 | rev.20 的 HTTP profile 升级后提示 blocked 但本机继续采集；同进程勾选允许后立即恢复；不自动降低安全性 |
| 长运行 | 至少 12 小时，期间一次睡眠唤醒、一次网络切换、一次 Hub 重启；最终无需退出客户端，且本机记录不 stale |
| 安装产物 | Windows、macOS、Linux 至少按发布范围安装/升级；显示预期版本、Qoder 开关和连接状态，不能只验证 CI artifact/checksum |

当前 Linux 开发机没有 Qoder 数据；Windows 工作站的 Qoder `main.sqlite` 只读 schema/适配器、最终 unpacked/NSIS fresh-install 产物、Electron renderer 和受控 localhost fake Hub 链路已按上文记录为 `PASS`；Linux AppImage/`.deb` 构建及 extracted `.deb` Wayland renderer 启动也为 `PASS`。生产 Hub、真实不同版本升级、macOS 浏览器导入、跨平台 macOS 安装、网络/睡眠和长运行仍为 `NOT RUN`，不得把整体状态写成完成。

## 10. Definition of Done

只有以下条件全部满足，才能把本计划标为完成：

- QD-01 至 QD-06 的实现和测试全部关闭；SQLite fixture 不再损坏或被错误跳过；
- `qoder` 自动/手动/off 与 `qodercn` 本地 Token 在 UI、代码、文档和测试中明确分离；
- manual-only 对所有声明支持的 provider 符合“只显示手动账号”，并通过 last-good/in-flight/restart 测试；
- 启动后本机采集与上报无需点击刷新；离线启动、half-open、Hub 重启、休眠/网络恢复均会自动恢复；
- 人工刷新能主动修复采集、上传、REST 和 SSE，而不是只更新界面；
- 已发布 rev.21 的远程 HTTP 同进程恢复漏洞进入新 release，且安全默认值不倒退；
- UI 能分别说明本机采集、Hub 上报、Hub 读取、实时流的状态；
- `npm run verify`、必要的 Worker/Hub 同步门禁、`git diff --check` 全部 PASS；
- 真实 Qoder、真实浏览器、三桌面平台安装、断网/休眠/长运行验收按范围 PASS；任何未执行项明确为 `NOT RUN`，不以源码或 mock 通过替代。

## 11. 明确不做的事

- 不把远程 HTTP 对旧用户静默设为允许；
- 不把 Cookie、账号原始凭据或对话正文写入日志、Hub、fixture 或 renderer；
- 不在未经讨论时增加浏览器 Cookie 解密依赖；
- 不把启发式字符计数宣传成 Qoder 精确 token；
- 不直接合并整个 `a285109` 侧分支；
- 不用“当前 Hub 恰好在线”或“自动化 0 fail 但关键 E2E skipped”作为问题已修复的证据。
