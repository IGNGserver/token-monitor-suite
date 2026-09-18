# 网页端“添加服务商账号”与额度功能深度分析及整改方案

本文档对本项目网页端（Hub Web）的**“添加服务商账号”功能、各服务商额度获取可行性、现有认证方式合理性、以及额度页显示与统一性规范（以 Codex 和 Antigravity (AGY) 为基准）**进行全面系统审计与对比分析，并输出具体修改方案。

---

## 目录

1. [背景与架构定位](#一背景与架构定位)
2. [第一部分：服务商额度与数据获取真实可行性逐一分析](#二第一部分服务商额度与数据获取真实可行性逐一分析)
3. [第二部分：现有认证方式合理性与最佳实践分析](#三第二部分现有认证方式合理性与最佳实践分析)
4. [第三部分：额度页显示规范、正确性及统一性深度对比（以 Codex 和 AGY 为基准）](#四第三部分额度页显示规范正确性及统一性深度对比以-codex-和-agy-为基准)
5. [第四部分：问题清单与整改工作文档](#五第四部分问题清单与整改工作文档)

---

## 一、背景与架构定位

在本项目最新的两层/纯 Docker Compose 架构下：
- **客户端（Widget / Headless Agent）**：原则上不再在本地探测并上传私密额度凭据，限额与配额的权威中心收敛至 **Docker Compose Hub**。
- **Hub 端（accountService）**：集中存储账号凭据（AES-256-GCM 加密落库 MySQL `hub_accounts` 表），由 Hub 侧工作线程池定时轮询各大服务商真实额度接口（通过 `probeLimitProvider`），将归一化后的数据写入 `hub_account_limits` 并聚合分发到 `/api/stats`。
- **网页端（Hub Web / PWA）**：
  1. `/accounts` 页面：用于添加、编辑、刷新、启用/禁用、删除 Hub 端管理的服务商账号。
  2. `/limits` 页面：用于向用户直观展示当前各账号的套餐、剩余百分比、额度条、重置时间与资金/余额消耗情况。

---

## 二、第一部分：服务商额度与数据获取真实可行性逐一分析

权威集合 `LIMIT_PROVIDER_IDS` 包含 20 个 Provider，Hub 手动添加列表 `HUB_ACCOUNT_PROVIDERS` 包含 17 个（排除了仅本地运行的 `cursor`、`grok`、`kiro`）。下面对这 20 个服务商的数据获取真实可行性进行逐一审计：

### 1. Codex (`codex`) —— ✅ **真实可行**
- **数据源**：
  - OpenAI 官方 CLI 接口：`https://chatgpt.com/backend-api/wham/usage`（或 `https://api.openai.com/...`）。
  - 配额数据：提供主限额窗口（5-hour Session、Weekly）以及专属额度（Luna Reserve、Spark、Code Review 等 allowance）。
  - 重置额度：`fetchCodexResetCredits` 支持拉取可选的重置次数（available/total resets）。
- **实测可行性**：代码已完整实现并在生产验证。

### 2. Antigravity (`antigravity` / AGY) —— ✅ **真实可行**
- **数据源**：
  - 远程 Cloud API：`https://antigravity.google/...`（通过 Google OAuth 换取的 Access Token 调用），拉取 `_quotaSummaryWindows`。
  - RPC 模式：当提供本地/内网语言服务端的 `endpoint` 和 `csrfToken` 时，通过 gRPC-Web/HTTP RPC 调用 `GetUserStatus` / `GetQuotaSummary`。
- **配额数据**：提供分组配额（如 Gemini Pro、Gemini Flash、Claude/GPT 的 5-hour 与 Weekly 窗口）及重置倒计时。
- **实测可行性**：完全可行，数据丰富且结构清晰。

### 3. DeepSeek (`deepseek`) —— ✅ **真实可行（但无速率窗口）**
- **数据源**：官方余额查询接口 `https://api.deepseek.com/user/balance`。
- **配额数据**：DeepSeek API 没有类似 Codex 的时间滑动窗口（Rate Limit Windows），仅有账户余额 `balance_infos`（人民币 CNY 或美元 USD）。系统通过记录本地消费历史推导今日花费、本月花费，并计算虚拟进度条。
- **实测可行性**：完全可行。

### 4. OpenRouter (`openrouter`) —— ✅ **真实可行**
- **数据源**：
  - `https://openrouter.ai/api/v1/auth/key`（读取 Key 维度的每日、每周、每月及终身消耗和上限）。
  - `https://openrouter.ai/api/v1/credits`（Management Key 可读取账户总 Credits 余额与用量）。
- **配额数据**：包含 Credits 窗口和 Key 限额窗口。
- **实测可行性**：完全可行。

### 5. Claude (`claude`) —— ⚠️ **部分可行（高风险 Web 端点依赖）**
- **数据源**：抓取 Claude 网页版控制台端点：`https://claude.ai/api/organizations`、`/api/organizations/:id/usage`、`/api/organizations/:id/prepaid/credits`。
- **实测可行性**：
  - 如果用户提供有效的网页端 `sessionKey` Cookie，代码可以正确提取出组织的使用量（Session 5-hour 窗口与 7-day 周窗口）。
  - **现实问题**：Anthropic 部署了极强的 Cloudflare Bot 保护与 Cookie 主动刷新机制。在云端 Docker Hub 服务器上发起 HTTP 请求极易触发 Cloudflare 403 质询（Turnstile/WAF）；且 `sessionKey` 有效期短，极易频繁失效变红。

### 6. OpenCode (`opencode`) —— ✅ **真实可行**
- **数据源**：OpenCode Go 官方 API（带 API Key）及 `opencode.ai` Web/Zen 接口。
- **配额数据**：Go 套餐 3 级窗口（Session $12、Weekly $30、Monthly $60）以及 Zen Prepaid 余额。
- **实测可行性**：完全可行。

### 7. GitHub Copilot (`copilot`) —— ✅ **真实可行**
- **数据源**：`https://api.github.com/copilot_internal/usage` 或企业托管 host，配合 `https://api.github.com/user`。
- **配额数据**：月度套餐配额、Premium 额度、重置日期。
- **实测可行性**：只要 Token（例如 `ghu_...`）拥有 Copilot 内部权限即可正常获取。

### 8. MiniMax (`minimax`) —— ✅ **真实可行**
- **数据源**：`https://api.minimax.chat/v1/user/remains` 及 Coding Plan 接口。
- **配额数据**：Token Plan 套餐用量、周期重置时间。
- **实测可行性**：完全可行，代码中还针对国内区/海外区及旧版 API 做了自动 fallback。

### 9. MiMo (`mimo` - 小米大模型) —— ⚠️ **可行但 Cookie 极易失效**
- **数据源**：`https://platform.xiaomimimo.com/api/v1` 平台接口。
- **配额数据**：Token Plan 用量比例、赠送金额、现金余额、过期状态。
- **实测可行性**：只要同时提供 `api-platform_serviceToken` 与 `userId` 即可获取；但小米鉴权要求高，Cookie 寿命有限。

### 10. Kimi (`kimi` - 月之暗面) —— ✅ **真实可行**
- **数据源**：
  - Kimi Code API: `https://api.moonshot.cn/v1/usages`（API Key 鉴权）。
  - Kimi Web: `https://kimi.moonshot.cn/api/chat/usages` + 会员状态接口（Web Access Token 鉴权）。
- **配额数据**：5 小时并发窗口、每周额度、共享月度会员包。
- **实测可行性**：代码成熟，合并展示效果好。

### 11. 智谱 GLM / GLM Team (`zai` / `zaiteam`) —— ✅ **真实可行**
- **数据源**：`https://open.bigmodel.cn/api/paas/v4/user/package`（或海外区 / 团队项目路径）。
- **配额数据**：5 小时窗口、每周窗口、MCP 额度。
- **实测可行性**：使用标准 API Key 即可稳定轮询。

### 12. 火山引擎 Volcengine (`volcengine`) —— ✅ **真实可行**
- **数据源**：火山引擎 Coding Plan 接口（HMAC-SHA256 签名）或方舟 Ark 探测模式。
- **配额数据**：并发/周期配额。
- **实测可行性**：完全可行。

### 13. Qoder (`qoder`) —— ⚠️ **可行但依赖 Session Cookie**
- **数据源**：`https://qoder.com/api/v2/me/usages/big_model_credits`（支持 Global 与 CN）。
- **配额数据**：Big model credits、用户套餐。
- **实测可行性**：需要抓取登录后的 Cookie。

### 14. Command Code (`commandcode`) —— ⚠️ **可行但依赖 Session Cookie**
- **数据源**：`https://commandcode.ai/api/credits` 及 `/api/subscriptions`。
- **配额数据**：5 小时额度、每周额度、月度额度。
- **实测可行性**：需用户手动抓取 Web 登录 Cookie。

### 15. Ollama (`ollama`) —— ⚠️ **非本地 Ollama，而是 Ollama Cloud 网页版**
- **数据源**：`https://ollama.com/settings`（解析网页 HTML 中的使用计量表）。
- **配额数据**：Session / Weekly 额度。
- **实测可行性**：需要抓取 ollama.com 登录后的 Cookie，页面改版可能造成解析失效。

### 16. 第三方聚合 / OneAPI / NewAPI (`thirdparty`) —— ✅ **真实可行**
- **数据源**：New API / OneAPI 规范的 `/api/usage`、`/api/user/self` 等端点。
- **配额数据**：账户剩余额度、已用额度、美元/人民币换算。
- **实测可行性**：完全可行且生态广泛。

### 17. 无法在 Hub 独立添加的本地服务商（Cursor、Grok、Kiro）
- **Cursor (`cursor`)**：依赖本地安装目录下的 SQLite / 本地 credentials.json；
- **Grok (`grok`)**：依赖本机 CLI RPC 进程或抓取本地配置；
- **Kiro (`kiro`)**：依赖执行本机 `kiro` CLI 二进制；
- **现状**：Hub 网页端下拉列表中已将这三者排除在手动添加列表之外（`HUB_ACCOUNT_PROVIDERS` 排除），这完全正确。

---

## 三、第二部分：现有认证方式合理性与最佳实践分析

### 1. Codex 认证方式分析
- **现状实现**：
  - 提供三种方式：
    1. **OAuth 授权码流（推荐，默认激活）**：利用官方 Codex CLI 的 Client ID 和 PKCE，生成授权链接，用户在 OpenAI 授权后，在重定向拦截页或复制重定向 URL / Code 回填到 Hub。Hub 使用 PKCE Verifier 换取 `access_token` 和 `refresh_token`。后端有独立的 `refreshOAuthCredential` 自动刷新 Token。
    2. **auth.json 粘贴**：直接粘贴本地 `~/.codex/auth.json` 文件内容。
    3. **手工 Access Token**：粘贴 JWT。
- **合理性评价**：
  - **OAuth 流程是目前最佳方式**：具备 `refresh_token` 自动续期能力，用户无需每次手动换 Token。
  - **体验痛点**：Codex OAuth 的回调地址是 `http://localhost:1455/auth/callback`。当用户在没有启动 Codex CLI 的浏览器中完成授权后，浏览器会跳转到无法打开的 `http://localhost:1455/...`。虽然界面有说明让用户复制地址栏 URL，但对非技术用户非常不友好，经常造成“打不开网页以为报错”的困惑。

### 2. Antigravity (AGY) 认证方式分析
- **现状实现**：
  - 提供两种方式：
    1. **OAuth 授权码流（推荐，默认激活）**：利用 Google Installed-App OAuth Client ID，生成 Google 登录授权链接。用户登录 Google 并授权后，Google 页面会直接展示一段授权码（格式为 `4/0A...`），用户点击复制按钮粘贴到 Hub 完成兑换。同样具备 `refresh_token` 自动续期。
    2. **RPC 模式**：输入 `endpoint`（如 `http://127.0.0.1:port`）与 `csrfToken`。
- **合理性评价**：
  - **AGY 的 OAuth 是全站最佳体验范本**：Google 授权页完成后不依赖 localhost 拦截，而是直接在页面上大字提供“复制授权码”按钮，用户复制 `4/0A...` 粘回 Hub 即可，零失败率，且 Token 支持无缝自动轮转。
  - **RPC 模式对于 Hub 服务端是不合理的**：Hub 如果部署在公网或 Docker 容器中，根本无法访问用户本地电脑的 `127.0.0.1` 语言服务端口。除非用户把 AGY RPC 反向代理到公网。因此在 Hub 端，OAuth 才是唯一实用的真方案。

### 3. 其他服务商认证方式横向对比与缺陷

| 服务商 | 当前 Hub 录入认证方式 | 是否最佳？ | 存在的主要缺陷与建议改进 |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | API Key (`sk-...`) | ✅ **最佳** | 官方唯一标准认证，永久有效，体验优秀。 |
| **OpenRouter** | API Key (`sk-or-...`) | ✅ **最佳** | 标准认证。建议在 UI 提示使用 Management Key 才能查看 Credits 余额。 |
| **Claude** | 纯 Cookie (`sessionKey=...`) | ❌ **脆弱** | 抓取繁琐，容易掉登录态，且在云端受 Cloudflare WAF 拦截。如官方或三方协议支持 OAuth/Setup Token 应跟进。目前应补充抓取指导及 WAF 警告。 |
| **Qoder** | 纯 Cookie | ⚠️ **次优** | 需从控制台复制 Cookie，缺少登录状态失效预警。 |
| **MiMo** | 纯 Cookie (`userId=...; serviceToken=...`) | ⚠️ **次优** | 需要从 Network 抓取多个 Header，格式要求严格（必须包含指定两字段）。表单占位符不够直观，极易填错。 |
| **Kimi** | API Key 或 Web Token | ⚠️ **混合但不够清晰** | API Key 只能获取并发额度，无法获取 5h/7d 比例；Web Token 才能获取完整额度。但输入框未作权重说明，导致很多用户只填 API Key 却发现缺少额度条。 |
| **Copilot** | 个人 Access Token (`ghu_...`) | ⚠️ **次优** | 多数用户不知道去哪里找 `ghu_` 开头的 Token（需从编辑器或本地 session 提取）。建议增加获取说明文档指引。 |
| **Volcengine** | AK/SK 或 API Key | ✅ **较合理** | 火山引擎签名机制标准，支持 Coding Plan 与 Ark Key 双模式。 |
| **Z.ai / Z.ai Team** | API Key + Org/Project | ✅ **合理** | 官方规范。 |
| **Third-party** | Base URL + API Key + 适配器下拉 | ✅ **优秀** | 支持 NewAPI / OneAPI 协议，灵活性极高。 |

---

## 四、第三部分：额度页显示规范、正确性及统一性深度对比（以 Codex 和 AGY 为基准）

### 1. Codex 与 AGY 的黄金标准（标杆）

以桌面端成熟的渲染标准（`renderProviderWindows` 及 `antigravityQuotaGroups`）为准绳，Codex 和 AGY 确立了优秀的额度显示范式：

#### (1) Codex 的黄金显示标准：
- **双核心时间窗口（5-hour Session + Weekly）**：
  - 采用 2 列卡片式布局。
  - 具有明确的剩余百分比数字（如 `85%`）、不同颜色状态指示（>50% 绿色、20-50% 橙黄、<20% 红色高危）。
  - 配备紧凑的水平进度条（Meter）。
  - 进度条下方明确显示**重置倒计时**（如 `重置于 3小时后` 或 `周三 18:00`）。
- **专属额度（Named Allowances）**：
  - Luna Reserve、Spark、Code Review 单独成行展示，清晰标出特定限额。
- **重置次数（Reset Credits）**：
  - 明确标出剩余重置机会（如 `2 次重置机会`），不与普通百分比混淆。

#### (2) AGY 的黄金显示标准：
- **模型/功能分组（Quota Groups）**：
  - AGY 的配额天然包含多模型类别（如 `Gemini Pro`、`Gemini Flash`、`Claude/GPT`）。
  - 标杆展示方式是将不同模型分为独立的 Group 模块（`limit-window-group`），每个 Group 内部清晰对应各自的 5-hour 和 Weekly 窗口。

---

### 2. 现行网页端 `/limits` 页面暴露的严重不一致与缺陷

经过对 `src/hub/web/js/app.js` (`renderLimits` / `renderLimitCards`) 和 `src/hub/web/js/data.js` (`limitCards`) 源码的细致审查，发现网页端额度展示存在以下严重缺陷：

#### 缺陷 1：AGY 在网页端被“平铺打散”，丢失了模型分组（严重违背 AGY 规范）
- **桌面端做法**：调用 `antigravityQuotaGroups` 将窗口按模型（Gemini Pro / Flash / Claude）聚合成多个组。
- **网页端现状**：网页端 `renderLimitCards` 直接以 `grid-2` 平铺遍历所有 `card.windows`。AGY 返回的 6 个窗口（每个模型各 2 个）被机械地平铺在 2 列网格里，窗口标题变成了冗长的 `Gemini Pro 5-hour`、`Gemini Pro weekly`、`Claude 5-hour`……没有层级和视觉分组，界面极度杂乱拥挤。

#### 缺陷 2：无百分比的额度（Balance / Credits）展示错误与仪表盘缺失
- **现状逻辑**（`data.js:569-588` 与 `app.js:1492-1506`）：
  - 当一个窗口只有剩余绝对值（例如 DeepSeek 余额 `$50.00`，或 Codex Credits `500`），`remaining` 为 `null`。
  - `showMeter` 判断为 `showMeter !== false && window.remaining != null`，导致无百分比的窗口只渲染一条空荡荡的灰色细线 `<div class="limit-balance-line"></div>`。
  - 而当 DeepSeek 具备消耗记录时，代码虽然计算了虚拟百分比，但在网页端却把数值强行格式化成了 `primary = Math.round(window.remaining) + '%'`，而实际上的金额数字被挤到了下方极小的辅助文字中，用户一眼根本看不到自己账户还剩多少钱！

#### 缺陷 3：Codex 的额外额度与重置额度展示不统一
- Codex 的 `resetCredits` 在 `data.js` 中被单独转换成一个 kind 为 `resetCredits` 的 window。
- 但在 `app.js` 的 `localizeWindowLabel` 中，虽然映射了 `tr('limits.resetCredits')`，但进度条显示异常（因为 availableCount / totalCount 在网页端容易被当作百分比处理，如果没有 totalCount 则显示不出进度条）。

#### 缺陷 4：卡片头部副标题（Subtitle）信息混杂且未统一
- 网页端 `renderLimitCards` 拼接卡片头部副信息：
  ```javascript
  const sub = [
    clientLabel(card.provider),
    card.plan || '',
    card.source ? String(card.source).toUpperCase() : '',
    card.accountEmail && card.name !== card.accountEmail ? card.accountEmail : ''
  ].filter(Boolean).join(' · ');
  ```
  - 当 provider 是 `deepseek` 时，`clientLabel('deepseek')` 输出 `DeepSeek`，后面跟 `Pay-as-you-go · API`。
  - 当 provider 是 `codex` 时，输出 `Codex · Plus · OAUTH · user@example.com`。
  - 当多个账号邮箱相同时，缺乏桌面端成熟的 `user@example.com · Personal` 别名工作区消歧机制，排版格式各异。

#### 缺陷 5：重置时间（Resets At）的国际化与友好度不一致
- Codex 和 AGY 核心窗口具有精准的到期时间戳 `resetsAt`。
- 网页端调用 `formatReset(window.resetsAt, state.locale)`，但在多语言下对于临近时间（如“10 分钟内重置”）缺乏桌面端的动态倒计时高亮，只简单输出一个绝对时间字符串。

---

## 五、第四部分：问题清单与整改工作文档

为使网页端添加服务商账号与额度页完全达到现代化、一致性标准，现将需要修改的内容整理为以下执行清单：

### 任务清单（Task Checklist）

| 编号 | 模块 | 修改项名称 | 严重级别 | 修改内容与目标 | 涉及文件 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M-1** | Accounts 表单 | **AGY 认证模式精简与文案修正** | 高 (P1) | 移除 Hub 网页端不切实际的“本地 127.0.0.1 RPC”模式入口，或明确标注“仅用于内网穿透/反代服务”。OAuth 步骤说明中强化“复制 4/0A... 授权码”的高亮指引。 | `src/hub/web/js/app.js`<br>`src/hub/web/js/i18n.js` |
| **M-2** | Accounts 表单 | **Codex OAuth 回调引导优化** | 高 (P1) | 针对 Codex OAuth 授权后重定向到 `localhost:1455` 导致浏览器“无法访问”的普遍痛点，在 Step 2 增加醒目的图文/黄色提示框，说明“浏览器显示打不开页面是正常的，请直接复制地址栏中的全部 URL 粘贴到下方即可完成验证”。 | `src/hub/web/js/app.js`<br>`src/hub/web/js/i18n.js` |
| **M-3** | Accounts 表单 | **MiMo / Kimi / Claude 凭据输入提示细化** | 中 (P2) | 1. MiMo 表单增加对 `userId` 与 `serviceToken` 的独立输入框或自动解析校验，避免整串 Cookie 拼错；<br>2. Kimi 明确区分 API Key（仅并发）与 Web Token（带 5h 额度条）的作用差异；<br>3. Claude 增加云端 Cloudflare 风险提示。 | `src/hub/web/js/app.js`<br>`src/hub/web/js/i18n.js` |
| **M-4** | Limits 页面 | **Antigravity 分组显示（Grouped Layout）重构** | 高 (P1) | 对齐 CodexBar 和桌面端实现：在网页端引入 `antigravityQuotaGroups` 逻辑。当渲染 AGY 卡片时，按 Gemini Pro / Gemini Flash / Claude 等模型分别创建分组框，组内并列展示 5-hour 与 Weekly 两个标准额度条，杜绝扁平打散。 | `src/hub/web/js/app.js`<br>`src/hub/web/css/app.css` |
| **M-5** | Limits 页面 | **金额/Credits 余额型窗口的视觉统一** | 高 (P1) | 针对 DeepSeek、OpenCode Zen、OpenRouter 等余额型数据：当无百分比或为金钱时，主值大字突出显示实际金额（如 `$12.50` 或 `￥88.00`），副文本展示消费细则（Today / Month Spend），不得强行拼装虚假或无意义的百分比。 | `src/hub/web/js/app.js`<br>`src/hub/web/js/data.js`<br>`src/hub/web/css/app.css` |
| **M-6** | Limits 页面 | **Codex 专属额度与重置次数标准化对齐** | 中 (P2) | 确保 Codex 的主 5h 窗口、周窗口、Luna/Spark 专属额度、Reset Credits 各自以标准小卡片并列或专用通栏呈现，统一图标、标签风格及 Reset 倒计时格式。 | `src/hub/web/js/app.js` |
| **M-7** | Limits 页面 | **卡片头部信息与健康徽章规范化** | 中 (P2) | 统一各卡片头部：图标 + 账号展示名（支持工作区区分）+ 套餐徽章（Plus / Team / Tier 等）+ 刷新时间。状态徽章统一映射为 `正常`、`过期/需刷新`、`错误`、`已停用` 四类状态。 | `src/hub/web/js/app.js`<br>`src/hub/web/js/data.js` |

---

### 总结结论
1. **获取可行性**：除本地客户端专属的 Cursor、Grok、Kiro 外，当前 Hub 支持的 17 家服务商**均真实具备额度或数据获取链路**。其中 Codex、AGY、OpenRouter、DeepSeek、OpenCode、Copilot、Z.ai、Volcengine、MiniMax 接口极其可靠；Claude、Qoder、MiMo、Ollama 因强依赖 Web Cookie，在云端环境存在不同程度的生命周期或 WAF 挑战。
2. **认证最佳实践**：**Codex 和 AGY 的 OAuth 模式是最佳范本**，具有自动 Refresh Token 续期优势；AGY 的复制授权码流程用户体验最好，Codex 亟需在 UI 补齐关于 Localhost 拦截复制的引导说明；Cookie 类服务商应优化字段提示。
3. **额度页展示统一**：当前网页端额度页最大的问题是**“一刀切的简单 2 列网格”**抹杀了复杂服务商的层次结构。必须将 AGY 的模型分组体系、Codex 的核心窗口+专属额度体系、以及 DeepSeek/OpenRouter 的资金余额体系进行组件化规范，彻底对齐桌面端的精致布局与设计品味。
