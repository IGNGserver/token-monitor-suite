# Tokscale 能力对齐与客户端补全计划

本文档记录一次系统性的**上游能力盘点**：把本项目（Token Monitor）现有的采集逻辑与 `tokscale` 4.17.0 逐项对比，找出①本项目自研但 tokscale 已支持、②本项目实现落后于 tokscale、③tokscale 已支持但本项目尚未接入的客户端，并给出可执行的开发清单。

对比基线：本项目 `tokscale@4.17.0`（已在本轮升级），上游仓库 `junhoyeo/tokscale` `main` 分支与 4.17.0 发布二进制。文中所有「tokscale 支持/不支持」的判断，均以**实际运行 4.17.0 二进制**或**上游 Rust 源码/README** 为依据，而非推测。

---

## 目录

1. [结论摘要](#一结论摘要)
2. [第一部分：可复用 tokscale 的自研逻辑](#二第一部分可复用-tokscale-的自研逻辑)
3. [第二部分：客户端覆盖补全（30 个）](#三第二部分客户端覆盖补全30-个)
4. [第三部分：不建议改用 tokscale 的部分](#四第三部分不建议改用-tokscale-的部分)
5. [第四部分：开发任务清单](#五第四部分开发任务清单)
6. [第五部分：验证方式](#六第五部分验证方式)

---

## 一、结论摘要

| 方向 | 结论 |
|---|---|
| 客户端覆盖 | 本项目已覆盖 **25** 个 tokscale 客户端 id，尚有 **30** 个未接入 |
| 自研逻辑可回收 | **3 个模块**可下线（`promaUsage` 除外，见下）；其中 1 个已被 tokscale 原生支持 |
| 落后于上游之处 | `sessionDetail` 的会话明细读取范围落后于 tokscale 的 `--group-by session,model` |
| 我方反而更强 | **额度（Limits）**：本项目 20 个 provider，tokscale `usage` 仅 **11** 个 |
| 无需改动 | `history`/`timeMetrics`、`--home` WSL 扫描：已是正确复用 |

**一句话**：客户端覆盖是最大的缺口（30 个）；自研代码的回收空间比预期小，因为 tokscale 的 `usage`（额度）覆盖面远小于本项目，且三个本地适配器（`proma`/`claude-desktop`/`qodercn`）上游根本没有对应实现。

---

## 二、第一部分：可复用 tokscale 的自研逻辑

### 2.1 已核实：`timeMetrics` 无需自研（结论：保持现状）

本项目的 `history.js` 中有 `normalizeTimeMetrics()`，容易被误认为自研指标。实测确认 **tokscale `graph` 输出已自带 `timeMetrics`**：

```
tokscale graph --no-spinner
→ top-level keys: [meta, summary, years, contributions, timeMetrics]
→ timeMetrics: {totalActiveTimeMs, longestContinuousMs, maxConcurrentSessions, sessionCount}
```

本项目 `parseGraphResult()` 正在消费它，数值与 `tokscale time-metrics --json` 完全一致（实测同为 `longestContinuousMs: 60458207`、`maxConcurrentSessions: 35`、`sessionCount: 1915`）。

**行动**：无需改动。但应补一条注释说明「该指标由 tokscale 计算，勿在本地重算」。

另外，tokscale 还有独立的 `tokscale time-metrics --json` 子命令可带 `--since/--until/--client` 过滤。本项目目前只用 `graph` 内的全量值；若将来需要**按自定义区间**展示时长指标，应优先调用该子命令而非自算。

### 2.2 待评估：`sessionDetail` 的读取范围落后于上游

`src/shared/sessionDetail.js`（363 行）自研了会话明细解析，仅覆盖少数客户端（`opencodeSession`、`reasonixSessionDetail`、`sessionFiles`）。

而 tokscale 原生提供 `--group-by session,model` 与 `--group-by client,session,model`，本项目 `runTokscale` **已经在用** `client,session,model`（`collector.js:316`）。

**缺口**：本项目会话明细页对**非 opencode/reasonix** 的客户端（如 claude、codex、commandcode、dsh…）没有逐条明细能力，而 tokscale 的 session 分组已覆盖全部 55 个客户端。

**行动**：评估用 `tokscale --json --group-by session,model` 替代自研逐客户端 reader（见任务 T4）。这是**功能增强**而非纯替换——需先确认 tokscale session 输出能否提供 UI 所需的逐条消息/工具调用明细（若只能给到 session 级聚合，则自研 reader 仍需保留）。

### 2.3 已核实：`--home` 复用于 WSL（已在本轮完成）

本轮已把 DeepSeek Harness 从「本地解析 + 自研 zstd 解码」改为 tokscale 原生 `--client dsh --home`，并实测 `--home` 会正确把 `DSH_HOME` 解析到被扫描的 home（宿主 `DSH_HOME` 不会泄漏进 WSL 扫描）。此模式可作为后续 WSL 客户端的复用范本。

### 2.4 自研但**上游无对应实现**（不可回收）

实测 tokscale 4.17.0 二进制中**不存在** `proma` / `claude-desktop` / `qodercn` 任何客户端 id 或路径字符串：

```
grep -qx "proma"|"claude-desktop"|"qodercn"|"qoder"  → 全部 no
```

因此以下自研适配器必须保留，它们不是「重复造轮子」，而是上游缺失的补位：

| 模块 | 行数 | 上游状态 |
|---|---|---|
| `src/shared/qoderCnUsage.js` | 1371 | tokscale 无 Qoder CN |
| `src/shared/promaUsage.js` | 339 | tokscale 无 Proma |
| `src/shared/claudeDesktopUsage.js` | 590 | tokscale 无 Claude Desktop |
| `src/shared/reasonixSessions.js` + `reasonixSessionDetail.js` | 1595 | tokscale 有 `reasonix` 客户端，但会话明细 reader 仍需自研（见 T4） |

### 2.5 自研的额度（Limits）——我方显著领先，**不要改用 tokscale**

这是本次盘点最重要的反向结论。本项目自研了近 **11000 行** 额度代码，覆盖 **20 个 provider**：

```
claude, codex, opencode, cursor, antigravity, kimi, grok, copilot, commandcode,
mimo, zai, zaiteam, kiro, qoder, deepseek, openrouter, minimax, volcengine,
ollama, thirdparty
```

而 tokscale README 明列的 `usage`（Subscription Usage）**仅支持 11 个 provider**：

```
Claude, Codex, Z.ai, Amp, GitHub Copilot, Grok Build, Kimi, MiniMax,
MiniMax Token Plan, OpenCode Go, Sakana(Fugu)
```

**结论**：改用 tokscale `usage` 会导致**额度覆盖从 20 个倒退到 11 个**，并丢失 `commandcode`（本轮刚验证过的 cookie 路由）、`openrouter`、`volcengine`、`ollama`、`qoder`、`zaiteam`、`mimo`、`kiro`、`deepseek`、`thirdparty` 等。**明确不做此替换。**

> 可选的局部收益：tokscale 支持而我们没有的 `Amp`、`MiniMax Token Plan`、`Sakana(Fugu)` 三家，可作为**独立新增 provider** 接入（见任务 T6），而不是替换现有实现。

---

## 三、第二部分：客户端覆盖补全（30 个）

### 3.1 差集全貌

实测差集（本项目 `KNOWN_CLIENTS` 经 `tokscaleClientFilter` 映射后，与 `tokscale --client` 枚举 55 项求差）：

**已覆盖 25 个**：`antigravity, antigravity-cli, claude, cline, codebuddy, codex, commandcode, copilot, cursor, dsh, grok, hermes, kilocode, kimi, kiro, micode, omp, openclaw, opencode, pi, qwen, reasonix, workbuddy, zcode, zed`

**未覆盖 30 个**：

| tokscale id | 显示名 | 数据路径（来自 `tokscale clients --json`） | 现有图标 |
|---|---|---|---|
| `gemini` | Gemini CLI | `~/.gemini/tmp` | ✅ 已有 svg |
| `amp` | Amp | `~/.local/share/amp/threads` | ❌ |
| `droid` | Droid | `~/.factory/sessions` | ❌ |
| `roocode` | Roo Code | VS Code globalStorage `rooveterinaryinc.roo-cline/tasks` | ❌ |
| `mux` | Mux | `~/.mux/sessions` | ❌ |
| `kilo` | Kilo CLI | `~/.local/share/kilo/kilo.db` | ❌ |
| `crush` | Crush | `~/.local/share/crush/projects.json` | ❌ |
| `goose` | Goose | `~/.local/share/goose/sessions/sessions.db` | ❌ |
| `codebuff` | Codebuff | `~/.config/manicode/projects` | ❌ |
| `trae` | Trae | `~/.config/tokscale/trae-cache/sessions` | ❌ |
| `warp` | Warp | `~/.config/tokscale/warp-cache` | ❌ |
| `gjc` | Gajae-Code | `~/.gjc/agent/sessions` | ❌ |
| `jcode` | Jcode | `~/.jcode/sessions` | ❌ |
| `junie` | Junie | `~/.junie/sessions` | ❌ |
| `opencodereview` | OpenCodeReview | `~/.opencodereview/sessions` | ❌ |
| `devin-cli` | Devin CLI | `~/.local/share/devin/cli/sessions.db` | ❌ |
| `devin-desktop` | Devin Desktop | `Library/Application Support/Devin/User/acp-events` | ❌ |
| `senpi` | Senpi (OmO Native) | `~/.senpi/agent/sessions` | ❌ |
| `augment` | Augment Code | `~/.augment/sessions` | ❌ |
| `kimchi` | Kimchi | `~/.config/kimchi/harness/sessions` | ❌ |
| `prime-agent` | Prime Agent | `~/.prime/agent/sessions` | ❌ |
| `freebuff` | Freebuff | `~/.config/manicode/projects` | ❌ |
| `cherrystudio` | Cherry Studio | `~/.config/CherryStudio/.claude/projects` | ❌ |
| `mcode` | MiniMax Code | `~/.config/tokscale/headless/mcode` | ❌ |
| `fx` | Fx | `~/.fx/sessions` | ❌ |
| `lmstudio` | LM Studio | `~/.lmstudio/server-logs` | ❌ |
| `unsloth` | Unsloth | `~/.unsloth/studio/studio.db` | ❌ |
| `hindsight` | Hindsight | `~/.hindsight/usage` | ❌ |
| `9router` | 9Router | 无扫描路径（枚举存在，`clients` 列表无条目） | ❌ |
| `synthetic` | Synthetic | 无扫描路径（同上） | ❌ |

### 3.2 关键发现

1. **`gemini` 是接近零成本的补充**：`normalizeClientName` 已把含 `gemini` 的名字归一到 `gemini`，`CLIENT_LABELS`/`CLIENT_COLORS` 已有条目，`src/shared-ui/icons/clients/gemini.svg` 已存在。仅缺 `DEFAULT_CLIENTS`、watch 路径、WSL marker、`.github/assets/tools-icon/gemini.png` 与文档表行。

2. **`9router` / `synthetic` 需先定性**：二者在 `--client` 枚举中，但 `tokscale clients` 列表无条目、无扫描路径。它们可能是**上传/聚合型**（非本地扫描）客户端。接入前必须先查明其数据来源，否则会出现「永远 missing」的假客户端。**建议列为待调查项，不盲目接入。**

3. **29/30 缺图标资源**：`AGENTS.md` 的「Adding a tracked client」表要求每个客户端有
   - `src/shared-ui/icons/clients/<id>.svg`（两宿主共用）
   - `.github/assets/tools-icon/<id>.png`（README 表格用）

   当前仅 `gemini` 有 svg。**图标是这 30 项的主要工作量之一**，且属于需要设计资源的阻塞项。

4. **同一厂商多 id 需归并**（沿用本轮 `pi`/`omp` 的经验）：
   - `devin-cli` + `devin-desktop` → 建议归并为单个 `devin` 行（README 单一表格行更合理）
   - `freebuff` + `codebuff` 同读 `~/.config/manicode/projects`（`freebuff` 是 `codebuff` 的衍生），需确认 tokscale 是否会把同一目录计两次 → **存在重复计数风险，必须实测**
   - `kilo` 与 `kilocode` 是不同产品（Kilo CLI vs Kilo Code 扩展），保持分开
   - `mcode`(MiniMax Code) 与 `micode`(MiMo Code) 是不同产品，保持分开

5. **部分客户端需要额外同步步骤**：`trae` 与 `warp` 的 tokscale 数据源是**自建缓存目录**（`~/.config/tokscale/trae-cache`、`warp-cache`），必须先用 `tokscale trae sync` / `tokscale warp sync` 填充，否则永远是 missing。这与现有 cursor/antigravity 的 `SELF_SYNCED_CLIENTS` 模式一致，需同样处理并接入 `selfSyncThrottle`。

6. **`lmstudio` 语义特殊**：README 注明仅统计 Chat Completions/Responses API 的最终响应用量，且**本地推理成本为 $0**。接入后成本列恒为 0，需在文档中说明，避免被当成 bug。

---

## 四、第三部分：不建议改用 tokscale 的部分

| 本项目模块 | 不建议改用 tokscale 的理由 |
|---|---|
| `limitCollector.js` + 20 个 `*Limits.js` | tokscale `usage` 仅 11 家，改则覆盖倒退 9 家（详见 2.5） |
| `promaUsage.js` / `claudeDesktopUsage.js` / `qoderCnUsage.js` | 上游无对应客户端 id 与解析实现 |
| `antigravityProbe.js` / `cursorProbe.js` | 上游有 `antigravity sync` / `cursor sync`，但本项目需要**进程探测**（识别 IDE/CLI 是否在运行）用于状态展示，这是 tokscale 不提供的能力。可复用 tokscale 的 **sync 结果**，但 probe 本身保留 |
| `wslUsage.js` | 上游无 WSL 概念；这是本项目平台特性 |

---

## 五、第四部分：开发任务清单

> 优先级：P0 = 直接补齐能力缺口；P1 = 复用上游降低维护；P2 = 需先调查/评估。

### 阶段一：低成本高收益客户端（P0）

- **T1 `gemini` 接入**
  - `DEFAULT_CLIENTS` 增 `gemini`；`KNOWN_CLIENTS` 自动继承
  - watch 路径 `~/.gemini/tmp`（`clientWatchCandidates()` 增 `add('gemini', …)`）
  - WSL marker `.gemini/tmp` + `MARKER_CLIENTS` 映射
  - 补 `.github/assets/tools-icon/gemini.png`（svg 已有）
  - 5 语言 README 表行 + 计数同步；`.env.example` 客户端 CSV
  - `tests/shared/clientTracking.test.js` 期望列表
  - 注意：`~/.gemini/` 下还有 antigravity 的目录（`antigravity-cli/conversations` 等），watch 时**只**取 `tmp`，避免与 antigravity 重复触发

- **T2 平台一致性检查**
  - 沿用本轮验证方法：用 `tokscale clients --json` 确认每个新 id 的 `sessionsPath` 与项目 watch 路径**逐字一致**（含 macOS/Windows 变体），不一致会退化为「永远 waiting」

### 阶段二：批量客户端接入（P0，工作量最大）

- **T3 按上游 30 项批量接入**，建议分批：
  - **批 1（纯本地 JSONL，易）**：`amp, droid, roocode, mux, gjc, jcode, junie, opencodereview, augment, senpi, prime-agent, kimchi, cherrystudio, fx`
  - **批 2（SQLite）**：`kilo, goose, devin-cli, unsloth`
  - **批 3（需 sync 前置）**：`trae, warp`（接入 `SELF_SYNCED_CLIENTS` + `selfSyncThrottle`，参照 cursor）
  - **批 4（特殊语义）**：`lmstudio`（成本恒 0）、`mcode`（headless 源）、`codebuff`+`freebuff`（同目录，**先验重**）
  - **批 5（待调查）**：`9router`、`synthetic`、`devin-desktop`（macOS 专属路径）
  - 每批需同步：`DEFAULT_CLIENTS`、watch 路径、`normalizeClientName`、UI 标签/配色（`src/shared-ui/core/data.js`）、Discord RPC、图标资源、WSL marker、README×5、`.env.example`、守卫测试
  - **图标资源是外部依赖**，建议先确认 29 个 svg/png 的获取来源，再决定批次顺序

- **T4 会话明细改用 tokscale（P1，需评估）**
  - 目标：让会话明细页覆盖全部客户端，而非仅 opencode/reasonix
  - 先验证 `tokscale --json --group-by session,model` 的输出粒度是否满足 UI（逐条消息/工具调用 vs 仅 session 聚合）
  - 若粒度足够 → 用 tokscale 替换 `sessionDetail.js` 中按客户端分支的自研 reader
  - 若不足 → 保留自研 reader，仅把「session 列表」部分改为 tokscale，明细仍按需读取
  - 影响面：`src/electron/main.js`（`readSessionDetail` 调用方）、Hub 侧同能力

### 阶段三：额度侧补强（P1）

- **T5 新增 tokscale 独有三家 provider**
  - `Amp`（API key，免费额度 + Credits）
  - `MiniMax Token Plan`（`MINIMAX_TOKEN_PLAN_CN_KEY` / `..._GLOBAL_KEY`，区间 + 周配额）
  - `Sakana (Fugu)`（`SAKANA_SESSION_COOKIE`，5 小时 + 周窗口）
  - 落地方式：可**独立新增** `*Limits.js`，或评估直接 shell out `tokscale usage --json` 取其数据后归一化
  - 注意：本项目额度权威中心在 **Hub**（见 `docs/PROVIDER_ACCOUNTS_AND_LIMITS_ANALYSIS.md`），新增 provider 必须同时接 `limitProviders.js`、`limitProviderSources.js`、Hub 账号体系与 renderer 列表

- **T6 `time-metrics` 区间能力（P2，低优先）**
  - 若未来需要按自定义区间展示时长指标，调用 `tokscale time-metrics --json --since/--until`，不要在本地重算
  - 并给 `history.js` 的 `normalizeTimeMetrics` 补注释说明数据来自 tokscale

### 阶段四：代码回收（P2）

- **T7 复审 `sessionDetail` 分支**（依赖 T4 结论）
- **T8 复核 `collector.js` 中是否仍有可交由 tokscale 的本地计算**（本轮已回收 dsh；`LOCAL_PARSED_CLIENTS` 现为 3 项且经证实上游不支持）

---

## 六、第五部分：验证方式

每批客户端接入后必须执行（沿用本轮已验证的方法）：

1. **`npm run verify`** 全绿（含 `verify:product-scope`、`verify:shared-ui`、`verify:css-vars`、lint、test）
2. **上游路径一致性**：`tokscale clients --json` 的 `sessionsPath` 与本项目 watch 路径逐字比对
3. **id 可请求性**：`tests/shared/clientTracking.test.js` 断言每个默认客户端映射到 bundled tokscale 真正接受的 id（**未知 id 是退出码 2 的整体失败，不是静默忽略**）
4. **端点实测**：构造合成 fixture（或使用真实数据）跑完整 `collectUsageOnce()`，确认客户端出现在 `clients`/`clientStatus` 且**不重复计数**
5. **重复计数专项**：对共用目录的组合（`codebuff`/`freebuff`、`gemini`/`antigravity`）单独验证同一份数据只计一次
6. **归并回归**：确认 `normalizeClientName` 与 `normalizeGraphClientIds`（历史图）两处都把上游 id 折回本项目 id——本轮 `omp`/`antigravity-cli` 的漏折正是此类 bug

---

## 附录 A：本轮已完成的同源工作（作为后续范本）

| 变更 | 说明 |
|---|---|
| tokscale `^4.13.0` → `^4.17.0` | `dsh` 客户端自 4.14.0 起才存在 |
| dsh 改用 tokscale 原生 | 删除 431 行自研 zstd 解析器；根因是上游 session 格式版本 0→3 且文件名带 `vN` |
| `TOKSCALE_CLIENT_RENAMES` | `deepseek-harness` → `dsh` |
| `TOKSCALE_CLIENT_ALIASES` | `pi` → `pi,omp`（4.14 起 Oh My Pi 独立成 `omp`） |
| `normalizeGraphClientIds` | 修历史图 id 泄漏（`dsh`/`antigravity-cli`） |
| AGENTS.md | 补「客户端 id 与 tokscale 枚举的接缝」这一非显然约束 |

## 附录 B：上游事实速查（本次实测，2026-09）

```bash
# 客户端全集（55）
tokscale --help | grep -o 'possible values:.*'

# 每个 id 的实际扫描路径 + 消息数 + headless 支持
tokscale clients --json

# 额度（仅 11 家 provider）
tokscale usage --json

# 会话时长指标
tokscale time-metrics --json --no-spinner

# 历史贡献图（含 timeMetrics）
tokscale graph --no-spinner
```

未使用但可能相关的上游能力：`tokscale report`（任务归因报告，`--workspace`/`--summarizer`）、`tokscale import`（ccusage/clawdboard 导入）、`tokscale headless`（仅 codex/mcode）、`tokscale wrapped`。

---

## 七、实施结果（已落地）

本节记录本文档各项任务的实际完成情况。所有变更已通过 `npm run verify`（0 失败）。

### 已完成

| 任务 | 结果 |
|---|---|
| **T1** | 接入 `gemini`：`DEFAULT_CLIENTS`、watch 路径 `~/.gemini/tmp`、WSL marker、UI 标签/配色、README×5、`.env.example`、守卫测试全部到位 |
| **T2** | 28 个新客户端逐个用 `tokscale clients --json` 核验路径一致；文件型源（`kilo.db`/`sessions.db`/`studio.db`/`projects.json`）按 Zed/Kiro 先例注册**父目录**为 watch 根并加 `directChildOnly` 收窄 |
| **T3** | 客户端覆盖 **25 → 53/55**；`KNOWN_CLIENTS` 26 → 54 |
| **T3-图标** | 新增 **23 个 SVG**（全部真实品牌 mark，0 占位）+ **59 个 PNG**；`ICON_ALIASES` 复用同品牌（mcode→minimax、kilo→kilocode、freebuff→codebuff、devin-cli/devin-desktop→devin） |
| **T3-批3** | trae/warp 接入 `SELF_SYNCED_CLIENTS` + `SELF_SYNC_KINDS`，新增 `clientSyncRunners.js` 执行 `tokscale <c> sync`，**以凭据为门**（未登录则静默跳过，避免自动触发交互式登录） |
| **T4** | 评估结论：**不替换**。实测 `--group-by session,model` 只给到 **session 级聚合**（client/sessionId/model/tokens/messageCount/cost），**无逐轮与工具明细**；而 `sessionDetail.js` 提供 `turns[]`/`tools[]`/逐轮 tokens。会话**列表**本就已由 tokscale 提供（`collector.js` 的 `client,session,model`），自研 reader 保留为唯一明细来源 |
| **T5** | 新增 **Amp**（`~/.local/share/amp/secrets.json` 的 `apiKey@https://ampcode.com/` + `ampcode.com/api/internal` 的 `userDisplayBalanceInfo`，解析 `display_text`）与 **Sakana**（cookie 鉴权的 `console.sakana.ai/billing` HTML 抓取，按窗口标签分段锚定，避免 RSC 重复计数）；provider 总数 20 → 22 |
| **T5 修正** | **MiniMax Token Plan 本已实现**（`minimaxLimits.js` 已有 `token_plan/remains` 双区域逻辑），无需新增 |
| **T6** | 确认 `timeMetrics` 由 tokscale `graph` 提供并已在消费；补注释禁止本地重算 |
| **T7/T8** | 复审完成：`sessionDetail` 覆盖 5 个客户端且无 tokscale 替代品（见 T4）；`LOCAL_PARSED_CLIENTS` 经证实的 3 项上游均无实现，保留 |

### 有意不做

| 项 | 原因 |
|---|---|
| **9router / synthetic** | 在 `--client` 枚举中但 `tokscale clients` **无扫描路径**，属提交/聚合型客户端；接入会造出「永远 missing」的假客户端 |
| 用 tokscale `usage` 替换自研额度 | tokscale `usage` 仅 11 家，本项目 22 家；替换会导致覆盖倒退（详见 §2.5） |

### 新增/修改的关键文件

- `src/shared/clientSyncRunners.js`（新）— trae/warp 同步与凭据门
- `src/shared/ampLimits.js`、`src/shared/sakanaLimits.js`（新）— 两个额度 provider
- `src/shared/deepseekHarnessPaths.js`（新）— dsh watch 根解析（上一轮）
- `tests/shared/{deepseekHarnessPaths,ampLimits,sakanaLimits,clientSyncRunners}.test.js`（新）
- `src/shared/{clientTracking,collector,usage,wslUsage,limitCollector,limitProviders,limitProviderSources,credentialStore,selfSyncThrottle,history}.js`、`src/shared-ui/core/data.js`、`src/electron/discordRpc.js`、5 个 README、`.env.example`、`scripts/hub-build-manifest.js`

### 遗留（非阻塞）

1. **trae/warp 需用户先交互式登录**（`tokscale trae login` / `tokscale warp login`）。代码已正确处理：未登录时静默跳过，客户端如实显示 `missing`。本机两个均未登录，故未能端到端验证同步产物。
2. **Amp / Sakana 未做真实凭据端到端验证**（本机无相应账号）。测试覆盖了解析、鉴权门、错误映射与 HTTP 状态映射，均基于上游 Rust 实现逐字对齐。
3. **环境变量覆盖未接线**（`GEMINI_CLI_HOME` 已支持；`CODEBUFF_DATA_DIR`、`*_CODING_AGENT_DIR`、`LM_STUDIO_HOME` 等尚未）。默认路径是绝大多数场景，可按需追加。
4. **`devin-desktop` 的 Windows 原生根**（`AppData/Roaming/Devin/User/acp-events`）未纳入 watch（仅 macOS + `.config` 两个变体）；Windows 原生用户走周期全量 tick。
