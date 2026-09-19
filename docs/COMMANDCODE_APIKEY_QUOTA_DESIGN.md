# Command Code 额度：改用 CLI 的 API Key 机制设计

## 结论先行

**Command Code 的额度查询本项目已经支持了**（`src/shared/commandcodeLimits.js`，511 行，Hub 可添加）。所以这**不是从零开发，而是给已有实现换一条更好的取数通道**。

你的判断是对的，而且比我预期的更有价值：CLI 走的是一条**独立的 API Key（Bearer）路线**，与我们现在的 Cookie 路线**不是同一套鉴权**。实测两条路由的 401 文案明确区分：

| 路线 | 401 文案 | 含义 |
|---|---|---|
| `/internal/billing/credits`（我们现用） | `You're logged out. Please refresh and login.` | 认 **Cookie/会话** |
| `/alpha/billing/credits`（CLI 用） | `Invalid 'Authorization' header or token.` | 认 **Bearer** |

来源：`command-code` **1.58.0**（bin `cmd`）本地解包反查 + 我方 curl 实测。

**最有价值的发现**：两条路线的**响应结构完全一致**（都是 `credits.monthlyCredits` + `credits.windowLimits`）。这意味着现有解析器**基本可以复用**，工作量主要在鉴权传输层，而不是重写解析。这比预期便宜很多。

---

## 一、CLI 的取数机制（已核实）

### 1.1 端点

CLI 用的是 `/alpha/*`，我们用的是 `/internal/*`：

| 端点 | 作用 | 关键字段 |
|---|---|---|
| `GET /alpha/whoami` | 身份 + 组织 | `org.id`、`org.login`、`user.userName`、`orgLimits[]` |
| `GET /alpha/billing/credits?orgId=<id>` | **额度主数据** | `credits.planId`、`monthlyCredits`、`windowLimits`、`purchasedCredits`、`freeCredits`、`purchasedRemaining`、`freeRemaining`、`usagePercent`、`hasCreditsInfo` |
| `GET /alpha/billing/subscriptions?orgId=<id>` | 订阅周期 | `data.planId`、`status`、`currentPeriodStart`、`currentPeriodEnd` |
| `GET /alpha/usage/summary?orgId=<id>&since=<periodStart>` | 期间消费 | `totalCost` |

调用链（CLI 源码）：`whoami → 取 org.id → 并发 credits + subscriptions → 用 subscription.currentPeriodStart 作为 since 拉 summary`。

> **注意**：`orgId` 是显式查询参数。我们现在的实现**完全不用 whoami/orgId**（grep 计数 0），而 CLI 必须传。这是接入 `/alpha/*` 的必修项。

### 1.2 鉴权

```
Authorization: Bearer <apiKey>
Content-Type: application/json
User-Agent: cli
x-cli-environment: production        （源码里 prod → production 归一化）
x-command-code-version: <cliVersion>
```

**API Key 来源（按优先级）**：

1. 环境变量 `COMMAND_CODE_API_KEY`（源码常量 `Io="COMMAND_CODE_API_KEY"`）
2. `~/.commandcode/auth.json` 的 `apiKey` 字段（`resolveCommandAuthDir` = `home/.commandcode`，prod 文件名 `auth.json`；另有 `auth.local.json` / `auth.staging.json`）

**Key 形态**：源码里有 `/^cmd/` 校验，前缀应为 `cmd_`。

**用户如何获得 Key**：`cmd login` 走本地回调 OAuth（PKCE，`127.0.0.1:8085`），成功后**为该终端创建一个 API Key**（拒绝授权时的文案是 "No API key was created for this terminal"）。`cmd logout` / `cmd auth status` 配套。CLI 内另有 `/usage`、`/status` 斜杠命令。

---

## 二、为什么这条路线更好

| 维度 | 现在（Cookie） | 改为 API Key |
|---|---|---|
| **凭据寿命** | 会话 Cookie，几天到几周失效 | API Key，长期有效 |
| **Cloudflare/WAF** | cookie 方案常被拦（这也是我们已写 `claudeRiskNotice` 同类问题的原因） | 走官方 API 头，不经浏览器风控 |
| **获取方式** | 用户要从浏览器 DevTools 复制 Cookie（我们还专门写了 curl 捕获解析） | `cmd login` 后在 `~/.commandcode/auth.json` 抄一个字段 |
| **官方支持度** | 未公开内部路由 `/internal/*` | CLI 自己在用，官方契约 |
| **数据完整性** | 只有 `monthlyCredits` + `windowLimits` | 额外拿到 `usagePercent`、`hasCreditsInfo`、`purchasedRemaining`、`freeRemaining`、`orgLimits` |

**额外收益（重要）**：`usagePercent` 是**厂商自己算的百分比**。我们目前用「计划目录表推算分母 + 三重交叉校验」的启发式（`trustedMonthlyAllowance`）来避免分母错误——那是**因为 Cookie 路线拿不到可信分母**。拿到 `usagePercent` 后可以直接采信厂商值，大幅降低那套启发式的必要性与出错面。

---

## 三、顺带发现的真实缺陷（与你的请求独立，但必须修）

对照 CLI 的官方计划表，**我们的计划表有错**：

| planId | 我方 | CLI 官方 | 问题 |
|---|---|---|---|
| `individual-pro` | **80** | **30** | ❌ 数值错 |
| `individual-pro-v1` | 缺失 | 80 | ❌ 缺条目 |
| `individual-provider` | 缺失 | 15 | ❌ 缺条目 |
| `teams-pro` | 缺失 | 40 | ❌ 缺条目 |
| `individual-max` | "Max 10x" | "Max" | ⚠️ 名称不符 |
| `individual-ultra` | "Max 20x" | "Ultra" | ⚠️ 名称不符 |

CLI 官方表（源码常量）：`{"individual-go":10,"individual-goat":70,"individual-pro":30,"individual-pro-v1":80,"individual-provider":15,"individual-max":150,"individual-ultra":300,"teams-pro":40}`

**为什么这不只是文案问题**：`monthlyCreditsUsd` 被 `trustedMonthlyAllowance()` 当作月窗口分母，且要求 `fiveHourCap`/`weeklyCap` 与表中数值**精确相等**才采信。`individual-pro` 真值若是 30 而我们写 80，则：

1. 真 Pro（30 额度）账号会被判 `monthlyRemaining > allowance` 不符 → 月窗口直接丢分母；
2. 我们表里 Pro 的 `fiveHourCapUsd:16/weeklyCapUsd:40` 若也是按 80 推的，则三重校验**必然失败**，月度额度条静默消失。

**另需注意**：CLI 用**前缀匹配**（`sr.find(id => planId.startsWith(id))`），且顺序是
`["individual-go","individual-goat","individual-pro","individual-pro-v1","individual-provider","individual-max","individual-ultra","teams-pro"]`。
由于 `"individual-pro-v1".startsWith("individual-pro") === true` 且 `individual-pro` **排在前面**，上游会把 `pro-v1` 误判成 30 额度的 Pro——**这是上游自身的排序缺陷，我不建议照抄**。我们保持**精确匹配**更安全，只是需要把 `individual-pro-v1` 作为独立条目补齐。

> 关于 `fiveHourCapUsd`/`weeklyCapUsd`：这两个字段**不在 CLI 源码中**，来自计划文档，我无法用 CLI 交叉验证。接入 `/alpha/*` 后 `windowLimits` 由 API 直供，这两个字段的用途会显著下降。

---

## 四、设计方案

### 4.1 核心策略：双通道，Bearer 优先

保留 Cookie 通道（**向后兼容**——已有用户存的是 cookie），新增 API Key 通道。Credential 解析顺序：

```
options.commandcodeApiKey  →  Bearer /alpha/*       source: 'api'
options.commandcodeCookie  →  Cookie /internal/*    source: 'web'
```

不做「自动回退」：两条路线鉴权类型不同，混用只会把「Key 无效」和「Cookie 过期」搅成一个含糊错误。哪个字段配了就明确走哪条，错误也按该路线如实上报。

### 4.2 改动清单（按项目 `AGENTS.md` 的 provider 落地清单）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/shared/commandcodeLimits.js` | 新增 `/alpha/*` 请求构造（Bearer + CLI 头）+ `whoami` 解析 orgId；`fetchCommandcodeLimits` 按凭据分派；新增 `commandcodeApiKey()` / `hasCommandcodeApiKey()` |
| 2 | 同上 | 修计划表（§三）：`individual-pro`→30、补 `individual-pro-v1`/`individual-provider`/`teams-pro`、修 Max/Ultra 名称 |
| 3 | 同上 | 读 `usagePercent` / `hasCreditsInfo` / `purchasedRemaining` / `freeRemaining`；`orgLimits` 作为 org 级 caps 窗口 |
| 4 | `src/shared/limitCollector.js` | 门槛 `case 'commandcode'` 接受 `commandcodeApiKey` \|\| `commandcodeCookie`；dispatch 不变（同一 fetcher） |
| 5 | `src/shared/limitProviderSources.js` | `MANUAL_PROVIDER_KEYS.commandcode` 增加 `commandcodeApiKey` |
| 6 | `src/hub/accountService.js` | `case 'commandcode'` 传 `commandcodeApiKey`（目前只传 cookie） |
| 7 | `src/shared/credentialStore.js` | 增加 `['providers','commandcode','apiKey']` |
| 8 | `src/shared-ui/views/accounts.js` | Command Code 表单增加 API Key 字段（与 Cookie 并存，标注优先） |
| 9 | `src/shared-ui/core/i18n.js` | 5 语言新增占位符/说明文案 |
| 10 | 测试 | `tests/shared/commandcodeLimits.test.js` 增加 Bearer 通道、orgId 链路、计划表修正、双通道分派 |

**不需要改**：`limitProviders.js`（id 已存在）、`HUB_ACCOUNT_PROVIDERS`（已在）、README 表格 ✅（已是 ✅）、build manifest（文件已在清单里）。

### 4.3 关键实现约束（Hub 架构）

沿用前面几轮确立的三条硬约束，Command Code 全部满足，**因此可做**：

1. 凭据经 `options` 传入 —— ✅ 用户粘贴 API Key；
2. `hasExplicitLimitProviderConfig()` 认这种凭据 —— ✅ 第 4 项改动；
3. 不依赖本机资源 —— ✅ 纯 HTTP。**不会**去 spawn `cmd`、不读 `~/.commandcode/auth.json`、不依赖 `COMMAND_CODE_API_KEY` 环境变量（Hub 会 `env` 置空）。

> 桌面端的 `~/.commandcode/auth.json` 自动发现**可以**作为可选增强（`automatic: true`），但它**不能**成为 Hub 的唯一路径。建议第一阶段只做 Hub 手工录入。

### 4.4 待你确认的一个取舍

`usagePercent` 采信后，是否**保留** `trustedMonthlyAllowance` 那套交叉校验？

- **建议保留但降级为 fallback**：厂商 `usagePercent` 优先；缺失时才用目录表推算。这样既拿到准确性提升，又不因 API 字段变动而失去分母。

---

## 五、验证方式

1. **端点活性**：未带凭据 `GET /alpha/whoami` 应返回 401（已实测），不是 404。
2. **鉴权头**：断言 `Authorization: Bearer <key>` 且带 `x-cli-environment` / `x-command-code-version`。
3. **orgId 链路**：合成 `whoami` 响应 → 断言后续请求 URL 带 `?orgId=<id>`；`whoami` 无 org 时降级为不带该参数。
4. **双通道分派**：只给 key → 只打 `/alpha/*`；只给 cookie → 只打 `/internal/*`；两者都给 → 走 key 且**不触碰** cookie 路线。
5. **状态映射**：401→`unauthorized`、403→`unauthorized`、429→`sourceRateLimited`、5xx→`unavailable`、空 body→`unavailable`、无凭据→`notConfigured`。
6. **计划表**：用 CLI 官方 8 条 planId 逐条断言解析出的 label 与月额度，并断言 `individual-pro-v1` **不会**被误判为 `individual-pro`（防上游式前缀误匹配）。
7. **Hub 语义专项**：在 `env = Object.create(null)` 下工作，不 spawn 任何子进程。
8. `npm run verify` 全绿。

---

## 六、可信度标注

| 结论 | 来源 | 可信度 |
|---|---|---|
| 项目已有 commandcode 额度支持（Cookie 路线） | 本仓库源码 | **已核实** |
| CLI 用 `/alpha/*` + Bearer API Key | `command-code` 1.58.0 解包源码 | **已核实** |
| 两条 401 文案不同（区分 Cookie/Bearer） | 我方 curl 实测 | **已核实** |
| 两条路线响应结构一致 | CLI 源码读取字段 + 我方现有解析器比对 | **已核实** |
| `~/.commandcode/auth.json`、`COMMAND_CODE_API_KEY` | CLI 源码常量 | **已核实** |
| CLI 官方计划表（8 条） | CLI 源码 `rr`/`or` 常量 | **已核实** |
| 我方计划表 3 处错漏 | 与上条逐条比对 | **已核实** |
| `/alpha/*` 的 `success` 信封细节 | 无法在无真实 Key 时确认 | **未验证** |
| 网站是否有 API Key 管理页 | 未查到 | **未验证**；已验证路径是 `cmd login` |
| `fiveHourCapUsd`/`weeklyCapUsd` | 不来自 CLI 源码，来源不明 | **未验证** |

**未做**：任何代码改动。本文档是分析与设计。
