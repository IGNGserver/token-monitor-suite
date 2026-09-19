# 额度获取（Hub 账号）扩展可行性研究

本文档研究：在本项目已支持的 **54 个 harness** 中，哪些**有订阅制**、其额度**能否由 Hub 服务端获取**、用什么原理（API Key / OAuth / Cookie / CLI），并指出现有实现的**机制缺陷与数据缺失**及改进方案。

**架构前提（决定了本文所有结论）**：额度获取在中枢（Docker Compose Hub）完成，不在客户端。Hub 通过 `probeLimitProvider(provider, options)` 调用各 provider 的 fetcher，凭据由用户在 Hub Web 的 `/accounts` 页手动录入并经 AES-256-GCM 加密存库。

**关键约束（实测确认）**：Hub 探测时 `limitCollector.js:4376` 会把 `env` 置为 `Object.create(null)`：

```js
const probeDeps = suppressAutoDetectedAccounts
  ? { ...deps, env: Object.create(null) }   // ← Hub 上环境变量为空
  : deps;
```

且 `hasExplicitLimitProviderConfig()`（`limitCollector.js:136`）是**白名单式门槛**——未列出的凭据形态即使传进来也会被判定为「未配置」而直接返回。因此一份能力**必须同时**满足三件事才算「Hub 可用」：

1. 凭据能通过 `options`（而非 env / 本地文件 / CLI）传入；
2. `hasExplicitLimitProviderConfig()` 认这种凭据；
3. 探测过程**不依赖本机资源**（不 spawn CLI、不读 Keychain、不依赖 localhost 服务）。

--- 

## 目录

1. [现状总览](#一现状总览)
2. [第一部分：现有实现的问题与改进](#二第一部分现有实现的问题与改进)
3. [第二部分：可新增的额度 provider](#三第二部分可新增的额度-provider)
4. [第三部分：明确不做](#四第三部分明确不做)
5. [第四部分：任务清单与优先级](#五第四部分任务清单与优先级)
6. [第五部分：验证方式](#六第五部分验证方式)

---

## 一、现状总览

### 1.1 覆盖情况

| 维度 | 数量 |
|---|---|
| harness（客户端）总数 | 54 |
| 已注册额度 provider（`LIMIT_PROVIDER_IDS`） | 22 |
| 其中**可从 Hub UI 添加**（`HUB_ACCOUNT_PROVIDERS`） | 17 |
| **已实现但 Hub UI 无法添加** | 5（cursor, grok, kiro, **amp**, **sakana**） |

> ⚠️ **发现一处回归**：上一轮新增的 `amp` / `sakana` 已在 `limitProviderSources.js` 声明 `authority: 'hub'`、`manual: true`，但**没有加入 `HUB_ACCOUNT_PROVIDERS`**，导致它们在额度页无法被添加。这是必须优先修的 bug（见 T1）。

### 1.2 现有 22 个 provider 的鉴权形态

按 Hub 录入的凭据类型分类（这是判断「是否易失效」的最重要维度）：

| 类型 | provider | 失效风险 |
|---|---|---|
| **API Key / Token**（稳定） | deepseek, minimax, openrouter, zai, zaiteam, volcengine, copilot, kimi(API Key), amp, thirdparty | 低 |
| **OAuth（可自动续期）** | codex, antigravity | 低 |
| **Cookie**（易失效） | claude, opencode, qoder, commandcode, mimo, ollama, sakana, kimi(Web Token) | **高** |
| **本地资源**（Hub 不可用） | cursor, grok, kiro | Hub 无法使用 |

**观察**：22 个里有 **8 个走 Cookie**，占 36%。这是当前最大的稳定性短板——用户在 Hub 上填的 cookie 会在数天到数周内失效变红，而 Hub 无法自动续期。

### 1.3 上游 tokscale 的对照

实测 `tokscale` 4.17.0（源码 `crates/tokscale-cli/src/commands/usage/mod.rs:376`）的 `usage` 注册表**恰好 13 家**，全部已实现：

```
claude, codex, zai, amp, antigravity, copilot, grok, kimi,
minimax, minimax-token-plan, warp, sakana, opencode-go
```

**本项目 22 家 ⊃ 上游 13 家**，多出 9 家（cursor, kiro, qoder, commandcode, mimo, deepseek, openrouter, volcengine, ollama, thirdparty）——额度覆盖面我们**领先上游**，所以**不应**用 tokscale 替换（详见 §四）。

上游仅有、我们**没有**的额度 provider 只有一家：**`warp`**（见 T3）。

> ⚠️ 重要澄清：tokscale 二进制里那串长 provider 名（"Claude Code Codex CLI Cursor IDE Gemini CLI Amp Droid … 9router"）是**客户端扫描枚举**（`crates/tokscale-core/src/clients.rs`，53 项），**不是** `usage` 注册表。Cursor / Gemini / DeepSeek / kiro / Trae / Augment / Devin / Cline / Zed / Qoder / Volcengine / OpenRouter / Ollama / MiMo / Command Code 都**没有** tokscale 的额度实现。

---

## 二、第一部分：现有实现的问题与改进

### 2.1 Claude —— 已实现 OAuth 却只暴露 Cookie（最高优先级）

**问题**：这是最典型的「机制不好」案例。

代码里**已经有完整的 OAuth 能力**：
- `CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'`（`limitCollector.js:73`）
- `readClaudeCredentials()` 会读 `CLAUDE_CODE_OAUTH_TOKEN`、`~/.claude/.credentials.json` 的 `claudeAiOauth`
- `refreshClaudeAccessToken()` / `refreshClaudeCredentials()` 已实现**完整的 refresh_token 续期**（`limitCollector.js:890, 1597`）

但 Hub 这条路**完全没接**：
```js
// accountService.js:205
case 'claude': return { ...options, claudeWebCookie: cookie };   // ← 只传 cookie
```
```js
// limitCollector.js:138
case 'claude': return Boolean(options.claudeWebCookie);          // ← 只认 cookie
```
```js
// limitProviderSources.js:15
claude: ['claudeWebCookie'],                                     // ← 只声明 cookie
```

**后果**：Hub 被迫使用最脆弱的方式（Cookie + Cloudflare WAF），而**已经写好的、可自动续期的 OAuth 路径被闲置**。用户在云上填的 `sessionKey` 极易被 Cloudflare 403 拦截且频繁失效。

**改进**：Hub 侧增加 OAuth 凭据形态（`claudeAccessToken` + `claudeRefreshToken`），与 Codex 同构。这是**投入产出比最高的一项**——后端能力已存在，只需打通输入与门槛。

**参考实现**（上游 tokscale `usage/claude.rs`）：
- 端点 `GET https://api.anthropic.com/api/oauth/usage`
- Header `Authorization: Bearer <accessToken>` + `anthropic-beta: oauth-2025-04-20`
- 凭据来源 `~/.claude/.credentials.json` 的 `claudeAiOauth.accessToken`（或 macOS Keychain `"Claude Code-credentials"`）
- ⚠️ 注意：上游**刻意移除了** refresh（issue #1001），而我们**已有** refresh——这是我们相对上游的优势，应保留。

### 2.2 Cursor —— HTTP-only 却被判为「不支持」

**问题**：`cursorProbe.js` **完全没有本地依赖**（实测 `grep -cE "keychain|sqlite|spawn|execFile"` = **0**），它只做 HTTP：

```
GET https://cursor.com/api/usage-summary      (Cookie: WorkosCursorSessionToken=<token>)
GET https://cursor.com/api/auth/me
GET https://cursor.com/api/usage?user=<sub>
```

`fetchCursorLimits()` 目前只从 `cursorAuth.readActiveAccount()`（本地文件）取 token，**忽略 `options`**；`hasExplicitLimitProviderConfig` 里虽然已有 `cursor` 分支（`cursorManualAccountConfigured`），但 `MANUAL_PROVIDER_KEYS` 与 `HUB_ACCOUNT_PROVIDERS` 都没放行，`limitProviderSources` 直接标 `unsupported`。

**结论**：Cursor 被判为「Hub 不支持」是**策略选择而非技术限制**。它的凭据就是一个可粘贴的 cookie 字符串（`WorkosCursorSessionToken`）。

**改进**：新增 `cursorSessionToken` 录入项，`fetchCursorLimits` 支持 `options.cursorSessionToken` 优先于本地文件。

### 2.3 Grok —— 同样已支持 Bearer 却未在 Hub 放行

**问题**：`grokLimits.js:80` 明确支持 `options.grokBearerToken`：

```js
if (options && options.grokBearerToken) {
  const raw = cleanSecret(options.grokBearerToken);
  if (raw) return { token: raw, source: 'settings' };
}
```

端点 `POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`（Bearer + `X-XAI-Token-Auth: xai-grok-cli`）。本地凭据来自 `~/.grok/auth.json` 的 `key` 字段（**本身就是一个 bearer token**，可直接复制到 Hub）。

但 `hasExplicitLimitProviderConfig()` **没有 `case 'grok'`**（实测计数 0），`HUB_ACCOUNT_PROVIDERS` 也没有 grok。

**改进**：加 `case 'grok': return Boolean(options.grokBearerToken)` + 录入项。

### 2.4 Kiro —— 真正的「Hub 不可用」（保持排除）

**问题**：`kiroLimits.js` 的唯一取数方式是 **spawn `kiro-cli chat --no-interactive /usage` 并解析 stdout**（`runKiroUsageCli`，`kiroLimits.js:272`）。文件里**没有任何 HTTP 端点或 token 字段**（实测 grep `https://` 无 api 端点）。

**结论**：这与 Hub 架构根本冲突（Hub 容器里没有也不该有 kiro-cli）。**维持 `unsupported` 是正确的**，但应在 UI 上明确告知用户「Kiro 额度仅桌面端可用」，而不是静默缺失。

### 2.5 Kimi —— 缺 refresh，且 API Key 与 Web Token 的语义未在 UI 说明

**问题 1（缺 refresh）**：上游 `usage/kimi.rs` 实现了 refresh：
```
POST https://auth.kimi.com/api/oauth/token
  grant_type=refresh_token, client_id=17e5f671-d194-4dfb-9706-5516cb48c098
```
并有 300s 主动 + 被动刷新、0600 原子写回。我们 `kimiLimits.js` 中 refresh 相关计数为 **0**——**完全没有**。

其中 `kimiWebAccessToken` 是 Web Token（会过期），没有 refresh 就意味着**必然周期性变红**。

**问题 2（语义混淆）**：`kimiApiKey` 与 `kimiWebAccessToken` 是两个不同能力：
- API Key（`api.kimi.com/coding/v1/usages`）→ 只能拿到并发额度
- Web Token → 才能拿到 5h/每周比例窗口

现有 UI 未说明优先级，用户常只填 API Key 然后奇怪「为什么没有额度条」。

**改进**：(a) 实现 refresh_token 续期（上游有现成实现）；(b) UI 明确「Web Token 才能获得 5 小时/每周窗口」。

### 2.6 Codex —— 数据基本齐全，仅一处表达差异（**经复核后修正**）

> 初稿曾判定我们「缺 `credit_status` / `spend_control`」，**复核后确认该判断有误**。实际差异是**表达方式**而非能力缺失。

上游 `UsageOutput` 把它们作为**独立顶层字段**（`credit_status`、`spend_control`），我们则**折叠进 `windows`**：

| 能力 | 我方实现 | 上游实现 |
|---|---|---|
| `reset_credits` | ✅ 顶层 `resetCredits`（`limitCollector.js:2128`） | ✅ 顶层 |
| credits（balance / unlimited / has_credits） | ✅ `credits` 窗口（`codexCreditsWindow`，`:2262`） | ✅ `credit_status` 顶层 |
| `individual_limit`（消费管控额度） | ✅ `named` 窗口「Spend limit Monthly」（`:2240`） | ✅ `spend_control` 顶层 |
| `overage_limit_reached` | ⚠️ 仅作 `detail` 文字（`:2272`） | ✅ 布尔字段 |
| `spend_control.reached` | ❌ 未读取 | ✅ 布尔字段 |

**真实缺口只有最后一行**：`spend_control.reached`（消费管控是否已触顶）我们没有当作独立信号读取。

**改进（低优先级）**：读取 `payload.spend_control.reached`，在触顶时给出明确提示。这属于**锦上添花**，不影响主流程。

### 2.7 Cookie 类 provider 的共性改进（claude/opencode/qoder/commandcode/mimo/ollama/sakana）

**问题**：8 个 provider 依赖手工复制的 Cookie，普遍存在：
1. **无失效预警**：cookie 过期后只是变红，用户不知道「该重新复制了」还是「服务挂了」。部分实现已区分 `unauthorized`，但 UI 未突出「需要重新登录」。
2. **复制指引不足**：MiMo 需要 `api-platform_serviceToken` + `userId` 两个字段（`limitProviderSources.js:22`），格式严格，极易填错。
3. **HTML 抓取脆弱**：`ollama`（`ollamaLimits.js:115` `parseOllamaUsageHtml`）与 `sakana`（`sakanaLimits.js`）是正则解析 HTML，页面改版即失效——需在文案中说明。

**改进**（不需要新端点，属于质量提升）：
- UI 上把 `unauthorized` 状态渲染为**明确的「凭据已失效，请更新」**，并附该 provider 的获取步骤链接。
- 为 MiMo 增加分字段输入（`serviceToken` / `userId`），而非一个大文本框。
- 为 HTML 抓取的 provider 标注「页面改版可能导致失效」。

---

## 三、第二部分：可新增的额度 provider

以下均为**订阅制 + 有额度接口 + Hub 可用（无需本地资源）**。端点均经实测（未带凭据访问返回 401/403，证明确实存在且需鉴权，而非 404）。

### 3.1 强烈推荐（稳定 API Key，无 Cookie）

| provider | 端点 | 鉴权 | 返回窗口 | 我方 harness | 实测 |
|---|---|---|---|---|---|
| **Warp / Oz** | `POST https://app.warp.dev/graphql/v2`，`GetRequestLimitInfo` | Bearer `wk-...`（Warp Settings → API keys）；也支持 Cookie | `requestLimit` / `requestsUsedSinceLastRefresh` / `nextRefreshTime` / `currentMonthSpendCents` | `warp` ✅ | 422（路由存在） |
| **Droid / Factory** | `GET https://api.factory.ai/api/billing/limits` | Bearer `FACTORY_API_KEY` | 5 小时 / 每周 / 每月 | `droid` ✅ | **401** |
| **Cline / ClinePass** | `GET https://api.cline.bot/api/v1/users/me/plan/usage-limits` | Bearer Cline API Key | `five_hour` / `weekly` / `monthly`（**仅百分比**） | `cline` ✅ | **401** |
| **Kilo Code** | `GET https://app.kilo.ai/api/trpc/user.getCreditBlocks,kiloPass.getState` | Bearer（`KILO_API_KEY` 或 CLI auth） | credit blocks + 订阅周期用量/tier | `kilo`/`kilocode` ✅ | **401** |

> **Warp 特别说明**：这是上游 tokscale 有、而我们**唯一缺失**的额度 provider。上游的实现里 `usage/warp.rs` **自己不发 HTTP**，只读 `tokscale warp sync` 写下的缓存；真正的取数在 `crates/tokscale-cli/src/warp.rs`。我们若接入，应**直接调 GraphQL**（Hub 上没法跑 sync），即实现比上游更直接。字段名叫 "requests" 但实际是 credits；`isUnlimited` 需短路处理；加购额度是独立池、不叠加。

> **Kilo 风险提示**：`app.kilo.ai/api/trpc/...` 是**未公开的应用内 tRPC 端点**（Kilo 官方文档没有额度 API），稳定性中等；建议同时实现 `GET https://api.kilo.ai/api/profile/balance` 作为回退。

### 3.2 推荐（OAuth，可自动续期）

| provider | 端点 | 鉴权 | 说明 |
|---|---|---|---|
| **Gemini / Google Code Assist** | `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota` | OAuth **refresh token**（`~/.gemini/oauth_creds.json`）→ `https://oauth2.googleapis.com/token` 续期 | 返回 `buckets[{modelId, remainingFraction, resetTime}]`；项目/tier 由 `:loadCodeAssist` 获取 |

**⚠️ 重大范围限制（务必先读）**：Google 已于 **2026-06-18** 停止为「Gemini Code Assist for individuals」「Google AI Pro」「Google AI Ultra」提供服务，**且明确包含 Gemini CLI**（[官方弃用公告](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals)）。**仅 Code Assist Standard / Enterprise 与 Workspace/教育版仍可用**。消费级替代品就是 Antigravity（**我们已支持**）。

因此接入时必须**优雅降级**：被弃用的账号表现为 `loadCodeAssist` 返回 200 但无 `currentTier`、且 `ineligibleTiers[].reasonCode == "UNSUPPORTED_CLIENT"`，随后 `retrieveUserQuota` 返回 403 `SUBSCRIPTION_REQUIRED`。此时应提示「该套餐已停服，请改用 Antigravity」，而不是报一个笼统的错误。

### 3.3 可选（企业版 / 需评估）

| provider | 端点 | 鉴权 | 限制 |
|---|---|---|---|
| **Augment Code** | `https://api.augmentcode.com/analytics/v0/*`（`credit-usage-by-user` 等） | Service-account Bearer | **仅企业版 + preview**；消费级路径是 Cookie（脆弱） |
| **Devin** | `GET https://api.devin.ai/v3/organizations/{org_id}/consumption/daily` | Service-user Bearer `cog_...` | **仅企业版**；消费级走 Chrome localStorage（脆弱） |
| **CodeBuddy（腾讯，CN）** | `POST https://copilot.tencent.com/v2/billing/meter/get-user-resource` | Bearer OAuth + `X-Product: SaaS` | CN 区；需区分「补充包」与「赠送包」，不可合并 |
| **Crush（Charm Hyper 网关）** | `GET https://hyper.charm.land/v1/credits` | Bearer `sk-hyper-...` | **仅其官方网关**有余额；Crush 本身是 BYO-key |
| **Alibaba Coding Plan** | `POST https://modelstudio.console.alibabacloud.com/data/api.json?action=...codingPlan...` | Cookie 或 API Key | 5h/周/月配额；CN 版域名不同 |
| **Zed** | `GET https://cloud.zed.dev/client/users/me` | **Keychain**（macOS），header 形如 `Authorization: {user_id} {token}` | **macOS-only → Hub 不适用**；除非用户手工粘贴 token |

### 3.4 关于 Qwen 的更正

**Qwen Code 的「2000 请求/天」免费额度已于 2026-04-15 停服**（[QwenLM/qwen-code PR #3210](https://github.com/QwenLM/qwen-code/pull/3210)：注释掉 `qwen-oauth` 子命令、清空 `QWEN_OAUTH_MODELS`、文档移除 `authType`）。

**结论**：**不要**为 Qwen 免费额度开发。真正的付费替代是 **Alibaba Cloud Coding Plan**（5h/周/月，见 3.3），其 API Key 形如 `sk-sp-xxxxx`、base URL `https://coding-intl.dashscope.aliyuncs.com/v1`（[官方文档](https://www.alibabacloud.com/help/en/model-studio/coding-plan)）。若要做 Qwen，应做这一项而非免费额度。

---

## 四、第三部分：明确不做

| 项 | 原因 |
|---|---|
| **Roo Code** | **服务已下线**。实测 `GET https://app.roocode.com/api/extension/credit-balance` → **HTTP 410** `{"error":"service_shut_down","message":"Roo Code Cloud is no longer available."}`；`roocode.com` 301 跳转到 `roomote.dev`。接入只会让每个用户看到 410。 |
| **用 tokscale 替换现有额度实现** | 上游 `usage` 仅 13 家，我们 22 家。替换会导致**覆盖倒退 9 家**（cursor, kiro, qoder, commandcode, mimo, deepseek, openrouter, volcengine, ollama, thirdparty）。 |
| **Qwen 免费额度** | 已于 2026-04-15 停服（见 3.4）。 |
| **Gemini 消费级额度** | 已于 2026-06-18 停服（见 3.2）。 |
| **Trae 作为额度源** | 实测其端点返回**逐 session 的 token 用量**，**没有订阅配额字段**（`api-sg-central.trae.ai/trae/api/v1/pay/query_user_usage_group_by_session`）。可作为**用量**源，不能作为**额度**源。企业版另有配额 API，但仅 CN 企业版。 |
| **Kiro** | 只能 spawn CLI 解析 stdout，Hub 架构不可用（见 2.4）。 |

### 无订阅额度（BYO Key / 纯本地）——无需开发

`pi`, `omp`(Oh My Pi), `senpi`, `gjc`, `jcode`, `prime-agent`, `fx`, `unsloth`, `goose`, `mux`, `reasonix`, `hermes`, `openclaw`, `codebuff`, `freebuff`, `proma`, `qodercn`, `opencodereview`, `lmstudio`, `hindsight`, `cherrystudio`, `micode`, `mcode`, `workbuddy`, `devin-desktop`(消费级), `jcode` 等——这些工具是自带 API Key 或纯本地运行，**没有厂商订阅配额**可查。

> 注：`kimchi`、`junie`、`cherrystudio`、`lmstudio`、`workbuddy`、`proma`、`hindsight` **有**订阅制，但**未找到公开额度接口**（只能在其自家控制台查看），因此暂不纳入。

---

## 五、第四部分：任务清单与优先级

### P0 — 修 bug 与打通已有能力（后端逻辑几乎已存在）

| # | 任务 | 说明 | 预估 |
|---|---|---|---|
| **T1** | **修 `amp`/`sakana` 无法从 Hub 添加** | 加入 `HUB_ACCOUNT_PROVIDERS`；`limitProviderSources` 已声明 `authority:'hub'`，仅 UI 列表缺失 | 小 |
| **T2** | **Claude 接入 OAuth** | Hub 侧新增 `claudeAccessToken` + `claudeRefreshToken` 录入；`hasExplicitLimitProviderConfig` 与 `accountService.providerOptions` 放行；复用**已有**的 `refreshClaudeCredentials` | 中（收益最高） |
| **T3** | **Warp 额度接入** | 直调 `app.warp.dev/graphql/v2` 的 `GetRequestLimitInfo`（不走 sync 缓存）；`wk-` API Key；上游唯一有而我们缺的 provider | 中 |
| **T4** | **Cursor 接入 Hub** | 新增 `cursorSessionToken`；`fetchCursorLimits` 支持 `options` 传入 | 小 |
| **T5** | **Grok 接入 Hub** | 加 `case 'grok'` 门槛 + `grokBearerToken` 录入（代码已支持该 option） | 小 |

### P1 — 补数据完整性

| # | 任务 | 说明 |
|---|---|---|
| **T6** | Codex 补 `spend_control.reached` | **仅此一项缺失**（经复核：credits / individual_limit 我方已有，只是折叠进 windows）；触顶时给出明确提示 |
| **T7** | Kimi 实现 refresh_token 续期 | 上游 `auth.kimi.com/api/oauth/token`，`client_id=17e5f671-...`；解决 Web Token 必然过期的问题 |
| **T8** | UI 凭据失效提示 | 把 `unauthorized` 渲染为「凭据已失效，请更新」+ 获取步骤链接 |

### P2 — 新增 provider

| # | 任务 | provider | 凭据 |
|---|---|---|---|
| **T9** | Droid / Factory | `api.factory.ai/api/billing/limits` | `FACTORY_API_KEY` |
| **T10** | Cline / ClinePass | `api.cline.bot/api/v1/users/me/plan/usage-limits` | Cline API Key |
| **T11** | Kilo Code | `app.kilo.ai/api/trpc/...`（+ `api.kilo.ai/api/profile/balance` 回退） | `KILO_API_KEY` |
| **T12** | Gemini（企业版，含弃用降级） | `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota` | OAuth refresh token |
| **T13** | Alibaba Coding Plan | `modelstudio.console.../codingPlan...` | Cookie 或 API Key |

### P3 — 按需评估

T14 Augment（企业版 service-account）、T15 Devin（`cog_` 企业版）、T16 CodeBuddy（CN）、T17 Crush（Hyper 网关）、T18 Zed（仅手工粘贴 token，说明 macOS Keychain 限制）。

### 每个新 provider 的落地清单

参照 AGENTS.md 的「Adding a tracked client」表，额度 provider 需要**同时**改动：

1. `src/shared/limitProviders.js` — `LIMIT_PROVIDER_IDS`（顺序须与 README 表一致）
2. `src/shared/limitProviderSources.js` — `HUB_MANUAL_PROVIDER_IDS`、`MANUAL_PROVIDER_KEYS`、`LIMIT_PROVIDER_SOURCE_CAPABILITIES`
3. `src/shared-ui/core/data.js` — `HUB_ACCOUNT_PROVIDERS`（Hub 下拉）、`PROVIDER_LABELS`
4. `src/shared/limitCollector.js` — `hasExplicitLimitProviderConfig()` 门槛 + `providerFetchers()` dispatch
5. `src/shared/credentialStore.js` — `LEGACY_LOCAL_LIMIT_CREDENTIAL_PATHS`
6. `src/hub/accountService.js` — `providerOptions()` 的实测分支
7. `src/shared-ui/views/accounts.js` — 该 provider 的录入字段
8. 新建 `src/shared/<provider>Limits.js` + `tests/shared/<provider>Limits.test.js`
9. `scripts/hub-build-manifest.js` + `npm run update:hub-build`
10. README×5 的 ✅ 行 + `tests/docs/readmeConsistency.test.js` 的硬编码顺序表

---

## 六、第五部分：验证方式

1. **`npm run verify` 全绿**（0 失败），含 README 顺序一致性、Hub build registry。
2. **门槛与 dispatch 同测**：`hasExplicitLimitProviderConfig(provider, options)` 与 `providerFetchers()[provider]` 必须同时认该 provider——只加一半会让用户在 UI 添加成功但永远拉不到数据。
3. **Hub 语义专项**：新 provider 必须在 `env = Object.create(null)` 下工作（不得依赖环境变量），且不 spawn 任何子进程。
4. **端点活性**：未带凭据探测应返回 **401/403**（证明路由存在且需鉴权），**404 表示端点错误**。
5. **响应解析**：用合成响应覆盖正常 / 401 / 403 / 429 / 5xx / 空 body / 字段缺失，断言 `status` 映射正确（`unauthorized` vs `unavailable` vs `sourceRateLimited`）。
6. **无凭据时**：必须返回 `notConfigured` 而非抛错。

---

## 附录：数据来源与可信度

**配套文档**：逐 provider 的上游端点/鉴权原始证据见 [`upstream-tokscale-usage-providers.md`](./upstream-tokscale-usage-providers.md)（实现时逐字对照用）。

| 结论 | 来源 | 可信度 |
|---|---|---|
| 我方 22 个 provider、Hub 漏 amp/sakana | 本仓库源码实测 | **已核实** |
| Hub `env` 置空、白名单门槛 | `limitCollector.js:4376` / `:136` | **已核实** |
| Claude OAuth 已实现但未接 Hub | `limitCollector.js:73,890,1597` + `accountService.js:205` | **已核实** |
| Cursor 无本地依赖 | `grep -cE "keychain\|sqlite\|spawn" cursorProbe.js` = 0 | **已核实** |
| Kiro 仅 CLI stdout | `kiroLimits.js:272` `runKiroUsageCli` | **已核实** |
| Codex 仅缺 `spend_control.reached`（初稿误判，已复核修正） | 我方源码 `limitCollector.js:2128/2240/2262/2272` vs 上游 `codex.rs:1487-1503` | **已核实** |
| tokscale 13 家 usage provider | `/tmp/tokscale-src` 检出 + `usage/mod.rs:376`（与 4.17.0 二进制一致） | **已核实** |
| Warp 端点 | 上游 `src/warp.rs` + 实测 422 | **已核实** |
| Cline / Factory / Zed / Kilo / Crush 端点 | 实测 401（CodexBar 文档） | **已核实（路由存在）** |
| Roo Code 停服 | 实测 **410** `service_shut_down` | **已核实** |
| Gemini / Qwen 停服 | 官方弃用公告 + qwen-code PR #3210 | **已核实（文档）** |
| Augment / Devin 端点 | 官方文档（企业版） | 文档可信，**未做带凭据实测** |
| Kimi / Codex refresh 细节 | 上游 Rust 源码 | **已核实** |
