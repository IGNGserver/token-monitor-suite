# 上游 tokscale `usage` provider 清单（v4.17.0）

> **本文档是 [`LIMITS_PROVIDER_EXPANSION_RESEARCH.md`](./LIMITS_PROVIDER_EXPANSION_RESEARCH.md) 的支撑材料。**
> 主文档给出结论与任务清单；本文档保留逐 provider 的端点/鉴权/字段原始证据，供实现时逐字对照。

上游 `tokscale` 的 `usage`（订阅额度）能力清单。所有端点与鉴权字面量均**摘自上游源码**，非推测。

## 证据来源

- 版本：`tokscale` 4.17.0（与本仓库 `node_modules` 中安装的二进制一致）。
- 源码检出：`junhoyeo/tokscale`，commit `d8fd670a46857e5290e71b10245dc522a344fc17`（2026-09-18），workspace `version = "4.17.0"`。
- **`crates/tokscale-cli/src/commands/usage/` 下 15 个文件已逐字节比对 `raw.githubusercontent.com` 的 `main` 分支，完全一致**（amp, antigravity, claude, codex, copilot, grok, helpers, kimi, minimax, minimax_tokenplan, mod, opencode_go, sakana, warp, zai）。即 `main` == 发布的 4.17.0。
- 复核方式：`git clone --depth 1 https://github.com/junhoyeo/tokscale` 后直接读取；若需重新核验，可对照 `crates/tokscale-cli/src/commands/usage/mod.rs` 的 `usage_providers()`。

### Raw source URLs actually fetched (all HTTP 200)

```
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/mod.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/amp.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/antigravity.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/claude.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/codex.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/copilot.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/grok.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/helpers.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/kimi.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/minimax.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/minimax_tokenplan.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/opencode_go.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/sakana.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/warp.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/crates/tokscale-cli/src/commands/usage/zai.rs
https://raw.githubusercontent.com/junhoyeo/tokscale/main/docs/providers/sakana.md
```

---

## 1. CLI probe results

`tokscale usage --help`:

```
Show subscription usage and quota for AI providers

Usage: tokscale usage [OPTIONS]

Options:
      --json         Output as JSON
      --light        Light terminal output (no TUI)
      --home <PATH>  Read local session data from this home directory for local report commands
  -h, --help         Print help
```

There is **no provider-name flag** — providers are auto-detected by credential probing.

`tokscale usage --json` on this machine returned only the two providers that had credentials here
(Codex/Copilot), confirming the auto-detect + skip behavior. Example metric shape:

```json
[{"provider":"Codex","plan":"Plus","email":"...","metrics":[{"label":"5h","used_percent":0.0,
"remaining_percent":100.0,"remaining_label":null,"resets_at":"2026-09-19T08:36:37+00:00"}, ...],
"reset_credits":{"available_count":0},
"credit_status":{"balance":"0","has_credits":false,"unlimited":false,"overage_limit_reached":false},
"spend_control":{"reached":false}},
 {"provider":"Copilot","plan":"Individual", ...}]
```

### Binary string probe — important correction

The long concatenated provider-label string embedded in the binary is **the CLIENT (usage-tracking)
enum, not the usage-provider registry**. From `strings -n 5` the big blob contains:

```
... Claude Code Codex CLI Cursor IDE Gemini CLI Amp Droid Kilo Code Mux Crush Copilot CLI Goose
Antigravity Zed Agent Cline Gajae-Code Grok Build Jcode Command Code MiMo Code Antigravity CLI
Junie ZCode OpenCode Review CodeBuddy WorkBuddy Devin CLI Devin Desktop Senpi (OmO Native)
Augment Code Kimchi Prime Agent Cherry Studio MiniMax Code FxLM Studio Hindsight 9router Synthetic 9Router ...
```

Those 53 display names come from `crates/tokscale-core/src/clients.rs` (`display: "..."` × 53). Cursor,
Gemini, DeepSeek, Trae, Augment, Devin, Cline, Zed, Qoder, Volcengine, OpenRouter, Ollama, MiMo,
commandcode, kiro-cli, etc. are **tracked clients**, and most have **no** `tokscale usage` provider.

The usage registry is a plain `Vec` in `usage/mod.rs` (not a clap enum), so its labels appear in the
binary as adjacent literals, e.g. `minimax-token-planWarp/Ozusage provider filtered out: no
credentials detected`. The `usage.disabledProviders` doc in `README.md:946` independently enumerates
the same 13 ids.

---

## 2. Provider registry — `crates/tokscale-cli/src/commands/usage/mod.rs`

Module declarations (lines 3–18) — **13 providers, one module each**:

```rust
mod amp;  mod antigravity;  mod claude;  pub mod codex;  mod copilot;  mod grok;
pub mod helpers;  mod kimi;  mod minimax;  mod minimax_tokenplan;  mod opencode_go;
mod sakana;  #[cfg(test)] mod test_server;  mod warp;  mod zai;
```

Registry (lines 376–454), verbatim structure:

```rust
type UsageProvider = (&'static str, &'static str, fn() -> bool, Fetch);

fn usage_providers(codex_fetch: Fetch) -> Vec<UsageProvider> {
    vec![
        ("claude",             "Claude",             claude::has_credentials,             Fetch::Single(claude::fetch)),
        ("codex",              "Codex",              codex::has_credentials,              codex_fetch),
        ("zai",                "Z.ai",               zai::has_credentials,                Fetch::Single(zai::fetch)),
        ("amp",                "Amp",                amp::has_credentials,                Fetch::Single(amp::fetch)),
        ("antigravity",        "Antigravity",        antigravity::has_credentials,        Fetch::Multi(antigravity::fetch_all)),
        ("copilot",            "Copilot",            copilot::has_credentials,            Fetch::Single(copilot::fetch)),
        ("grok",               "Grok Build",         grok::has_credentials,               Fetch::Single(grok::fetch)),
        ("kimi",               "Kimi",               kimi::has_credentials,               Fetch::Single(kimi::fetch)),
        ("minimax",            "MiniMax",            minimax::has_credentials,            Fetch::Single(minimax::fetch)),
        ("minimax-token-plan", "MiniMax Token Plan", minimax_tokenplan::has_credentials,  Fetch::Multi(minimax_tokenplan::fetch_all)),
        ("warp",               "Warp/Oz",            warp::has_credentials,               Fetch::Single(warp::fetch)),
        ("sakana",             "Sakana",             sakana::has_credentials,             Fetch::Single(sakana::fetch)),
        ("opencode-go",        "OpenCode Go",        opencode_go::has_credentials,        Fetch::Multi(opencode_go::fetch_all)),
    ]
}
```

Shared output types (mod.rs 25–101):

```rust
pub struct UsageMetric { label, used_percent, remaining_percent, remaining_label: Option<String>, resets_at: Option<String> }
pub struct UsageOutput { provider, account: Option<UsageAccount>, credential_source: Option<String>, plan,
                         email, metrics: Vec<UsageMetric>, reset_credits: Option<UsageResetCredits>,
                         credit_status: Option<UsageCreditStatus>, spend_control: Option<UsageSpendControl> }
pub struct UsageAccount { id, label: Option<String>, is_active: bool }
```

`Fetch::Single` wraps one output into a vec; `Fetch::Multi` returns the vec directly (mod.rs 360–371).
Providers with no credentials are filtered out before any fetch; each active provider is fetched on
its own scoped thread (mod.rs 502–577). Subscription results are cached to
`<cache dir>/subscription-usage-cache.json` with a 5-minute TTL (mod.rs 285–349).

---

## 3. Summary table

| # | Provider (label) | Registry id | Endpoint(s) | Auth | Windows / metrics returned | Source file |
|---|---|---|---|---|---|---|
| 1 | **Claude** | `claude` | `https://api.anthropic.com/api/oauth/usage` (GET) | `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`; macOS/Windows Keychain service `"Claude Code-credentials"`. **No refresh flow** (deliberately removed, #1001). Header `anthropic-beta: oauth-2025-04-20` | `Session` (five_hour), `Weekly` (seven_day), `Opus` (seven_day_opus), plus dynamic per-model `weekly_scoped` labels. `used_percent` ← `utilization`/`percent` | `claude.rs` |
| 2 | **Codex** | `codex` | usage GET `https://chatgpt.com/backend-api/wham/usage`; reset-credits GET `.../wham/rate-limit-reset-credits`; consume POST `.../wham/rate-limit-reset-credits/consume`; token POST `https://auth.openai.com/oauth/token` | `$CODEX_HOME/auth.json`, `~/.config/codex/auth.json`, `~/.codex/auth.json`; Keychain `"Codex Auth"`; tokscale store `<config>/codex-credentials.json`; read-only OpenCode `$XDG_DATA_HOME/opencode/auth.json`. **Refresh exists**: `grant_type=refresh_token`, `client_id=app_EMoamEEZ73f0CkXaXp7hrann`, only for `CredentialSource::Store` | `5h` / `Weekly` (duration-derived, `N d/h/m/s` otherwise), prefixed for `additional_rate_limits`; `reset_credits`, `credit_status`, `spend_control`, `plan`, `email` | `codex.rs` |
| 3 | **Z.ai** | `zai` | quota GET `https://api.z.ai/api/monitor/usage/quota/limit`; subscription GET `https://api.z.ai/api/biz/subscription/list` | env `ZAI_API_KEY` or `GLM_API_KEY`, `Authorization: Bearer` | `Session` (`unit=3,number=5`), `Weekly` (`unit=6,number=1`), `Web Search` (`TIME_LIMIT`). `percentage` → used_percent | `zai.rs` |
| 4 | **Amp** | `amp` | POST `https://ampcode.com/api/internal`, body `{"method":"userDisplayBalanceInfo","params":{}}` | API key from `~/.local/share/amp/secrets.json` key `"apiKey@https://ampcode.com/"`, `Authorization: Bearer` | `Free` (parsed from `display_text` `$X/$Y remaining`, reset estimated from `+$RATE/h`), `Credits` (`Individual credits: $X remaining`) | `amp.rs` |
| 5 | **Antigravity** | `antigravity` | POST `http://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary` (Connect-RPC, header `Connect-Protocol-Version: 1`) | **No credential of its own.** Talks to the local Antigravity language server. Port discovered from `~/.gemini/antigravity-cli/cli.log` marker `"listening on random port at "` + `"for HTTP"`, else process scan (`crate::antigravity::detect_antigravity_connections`, CSRF from `--csrf_token`). Quota RPC sends no auth header | Label = `bucket.window` (`"weekly"` / `"5h"`) else server `displayName`; `used_percent = 100 − remainingFraction×100`. **One output per model group** (`Fetch::Multi`), group name carried in the account slot | `antigravity.rs` |
| 6 | **Copilot** | `copilot` | GET `https://api.github.com/copilot_internal/user` (+ headers `Editor-Version: vscode/1.96.2`, `Editor-Plugin-Version: copilot-chat/0.26.7`, `User-Agent: GitHubCopilotChat/0.26.7`, `X-Github-Api-Version: 2025-04-01`) | env `GH_TOKEN` / `GITHUB_TOKEN`; Keychain service `"gh:github.com"` (wincred targets `"gh:github.com:"` then `"gh:github.com"`, `go-keyring-base64:` prefix); `~/.config/gh/hosts.yml` → `oauth_token:`. **No `gh` subprocess**; no refresh | `Premium` (premium_interactions), `Chat`, `Completions`, other keys title-cased. Paid tier from `quota_snapshots` (`remaining`/`entitlement`/`percent_remaining`), free tier from `limited_user_quotas`×`monthly_quotas` | `copilot.rs` |
| 7 | **Grok Build** | `grok` | GET `https://grok.com/rest/subscriptions`; GET `https://grok.com/rest/tasks/usage`; POST `https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` (gRPC-web, body `vec![0,0,0,0,0]`). Fallback: spawn `grok agent --no-leader stdio` + JSON-RPC `initialize` / `x.ai/billing` | `$GROK_HOME/auth.json` else `~/.grok/auth.json` (else relative `.grok/auth.json`); per-scope `"key"`/`"email"`, `https://auth.x.ai` scope first. Headers `Authorization: Bearer`, `X-XAI-Token-Auth: xai-grok-cli`, `User-Agent: Grok Build`. **No refresh flow** | `Credits` / `Weekly` / `Monthly` (`cycle_label` by day-span 6–8 / 27–33), plus `Tasks`, `Frequent`, `Occasional`; plan from active `subscriptions[].tier`, `SUBSCRIPTION_TIER_`/`TIER_` stripped | `grok.rs` |
| 8 | **Kimi** | `kimi` | GET `https://api.kimi.com/coding/v1/usages`; POST `https://auth.kimi.com/api/oauth/token` | `$KIMI_CODE_HOME/credentials/kimi-code.json` (blank env = unset) else `~/.kimi/credentials/kimi-code.json`; keys `access_token`/`refresh_token`/`expires_at`. **Refresh exists**: `grant_type=refresh_token`, `client_id=17e5f671-d194-4dfb-9706-5516cb48c098`, proactive 300 s buffer + reactive retry, 0600 atomic write-back | `Session` (window duration ≤ 3600) else `Weekly`; top-level `usage` is `Weekly`; deduped. `limit`/`remaining` strings → used_percent. Plan from `user.membership.level` (`LEVEL_` stripped) | `kimi.rs` |
| 9 | **MiniMax** | `minimax` | GET `https://api.minimax.io/v1/api/openplatform/coding_plan/remains` | env `MINIMAX_API_KEY` or `MINIMAX_API_TOKEN`, `Authorization: Bearer` | `Session` — `"{total-used}/{total} prompts left"`; plan from `current_subscribe_title`/`plan_name` else inferred (100→Starter, 300→Plus, 1000→Max, 2000→Ultra) | `minimax.rs` |
| 10 | **MiniMax Token Plan** | `minimax-token-plan` | GET `https://www.minimaxi.com/v1/token_plan/remains`; GET `https://www.minimax.io/v1/token_plan/remains` | env `MINIMAX_TOKEN_PLAN_CN_KEY` (CN site) and/or `MINIMAX_TOKEN_PLAN_GLOBAL_KEY` (Global site), `Authorization: Bearer` | Per model: interval label `<model_name>` and weekly `<model_name>·wk`; `current_interval_remaining_percent` / `current_weekly_remaining_percent` → remaining. `Fetch::Multi`, one output per configured site, account label `CN`/`Global` | `minimax_tokenplan.rs` |
| 11 | **Warp/Oz** | `warp` | Network (separate module): POST `https://app.warp.dev/graphql/v2` with queries `GetRequestLimitInfo` and `GetWorkspacesMetadataForUser`. **The usage provider itself makes no HTTP call** | Reads the local cache only: `<config>/warp-cache/usage.json`; credentials at `<config>/warp-cache/credentials.json` written by `tokscale warp login` (bearer or Cookie header). No env var | `Requests` (`"N requests left"` / `"N requests used"`), `Spend` (`$X.XX`, informational) | `usage/warp.rs` (producer: `src/warp.rs`) |
| 12 | **Sakana** | `sakana` | GET `https://console.sakana.ai/billing` — **HTML scrape, no public API** | env `SAKANA_SESSION_COOKIE` (precedence) else `<config>/sakana-session`; sent as `Cookie:` header (`__Secure-authjs.session-token[.0/.1]`). **No refresh** — manual cookie re-copy | `5-hour`, `Weekly` — percent from `% used` marker; plan tier `Standard`/`Pro`/`Max` + `$N/mo` + next renewal as `plan` metadata | `sakana.rs` |
| 13 | **OpenCode Go** | `opencode-go` | GET `https://opencode.ai/zen/go/v1/usage` | auth file first: `$XDG_DATA_HOME/opencode/auth.json` else `~/.local/share/opencode/auth.json`, top-level `"opencode-go"` with `"type":"api"` (`"oauth"` deliberately ignored); else env `OPENCODE_API_KEY`. `Authorization: Bearer` | `Rolling`, `Weekly`, `Monthly`; `percent` → used_percent; `remaining_label` = `"rate-limited"` when `status == "rate-limited"`; `plan: "Go"` | `opencode_go.rs` |

---

## 4. Per-provider detail

### 4.1 Claude — `claude.rs`
- Endpoint: `const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";` (line 18). Only URL in the file.
- Auth: `credentials_path()` → `home.join(".claude").join(".credentials.json")` (372–375); fallback `super::helpers::read_keychain("Claude Code-credentials")` (378). `read_keychain` is `security find-generic-password -s <service> -w` on macOS, Windows Credential Manager (`CredReadW`/`CRED_TYPE_GENERIC`) on Windows, `bail!` elsewhere (`helpers.rs:25-50`).
- The `Oauth` struct models `accessToken`, `subscriptionType`, `rateLimitTier` — deliberately **not** `refreshToken`. Comment (~265–272): tokscale used to exchange the refresh token on 401/403 and write back, which broke Claude Code's login (#1001); a rejected token now just reports unavailable usage.
- 429 handling: `Retry-After` parsed (clamped `MAX_RETRY_AFTER_SECS = 3600`, default 5 s) and persisted to `<cache>/claude-cooldowns/<sha256(access_token)>.json`.
- Metrics: `five_hour → "Session"`, `seven_day → "Weekly"`, `seven_day_opus → "Opus"`; dynamic `weekly_scoped` `limits[]` entries use `scope.model.display_name` as the label. `used_percent` ← `utilization` (legacy) or `percent` (scoped); `remaining_percent = 100 − used`; `resets_at` passed through.
- `provider: "Claude"`; `email`, `account`, `credential_source`, `reset_credits`, `credit_status`, `spend_control` all `None`. `plan` = capitalize(`subscriptionType`) + last `_`-segment of `rateLimitTier` (e.g. `"Max 20x"`).

### 4.2 Codex — `codex.rs`
- Endpoints are injected via `CodexEndpoints::production()` (257–266):
  - usage: `"https://chatgpt.com/backend-api/wham/usage"`
  - reset_credits: `"https://chatgpt.com/backend-api/wham/rate-limit-reset-credits"`
  - token: `"https://auth.openai.com/oauth/token"`
  - plus a **hardcoded** consume literal at line 1227: `"https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume"` (POST, body `{"redeem_request_id": <uuid4>}`).
- Headers on usage/reset-credits: `Authorization: Bearer`, `Accept: application/json`, `User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)`, optional `ChatGPT-Account-Id`.
- Auth: `CredentialSource { File(PathBuf), OpenCodeFile(PathBuf), Keychain, Store(String) }` (188–193).
  - `File`: `$CODEX_HOME/auth.json`, `~/.config/codex/auth.json`, `~/.codex/auth.json`.
  - `Keychain`: `super::helpers::read_keychain("Codex Auth")` (549).
  - `Store`: `get_config_dir()/codex-credentials.json` — multi-account store (`version`, `activeAccountId`, `accounts`), the **only** source tokscale may refresh/write.
  - `OpenCodeFile`: `$XDG_DATA_HOME/opencode/auth.json` else `~/.local/share/opencode/auth.json`, document key `openai`, `type: "oauth"` only (`api` ignored); read-only, refresh token not even deserialized.
- Refresh flow exists (1137–1151): form `grant_type=refresh_token`, `client_id=app_EMoamEEZ73f0CkXaXp7hrann`, `refresh_token=…`; `refreshable_account_id()` returns `Some` only for `Store`, so File/Keychain/OpenCode paths stop with re-auth guidance instead.
- Metrics: `rate_limit.primary_window → "5h"`, `secondary_window → "Weekly"`; `rate_limit_window_label` derives `"Weekly"`, `"Nd"`, `"Nh"`, `"Nm"`, `"Ns"` from `limit_window_seconds`. `additional_rate_limits[]` prepend `limit_name`/`metered_feature` capitalized (e.g. `"Spark 5h"`). `used_percent` ← `used_percent`; `resets_at` ← epoch `reset_at` (alias `resets_at`) → RFC 3339.
- Extras: `reset_credits` (summary `available_count` + detail GET with per-credit metadata, merged `details.or(summary)`), `credit_status` (`balance`/`has_credits`/`unlimited`/`overage_limit_reached`), `spend_control` (`individual_limit`/`reached`), `plan` = capitalize(`plan_type`), `email` from the response.
- `credential_source` is `None` for native sources; the **only** non-null value emitted is `"opencode"` (line 1655), set when the native report produced no outputs.
- `fetch_all_report` (CliReadOnly) vs `fetch_all_report_importing_current_auth` (TuiSurface): the latter first snapshots the codex CLI's live login into the tokscale store (`SaveCurrentLogin` intent, `StoreRepairPolicy::Persist`) and makes it active; the former is `ReadOnly` with `StoreRepairPolicy::InMemoryOnly`. Mapped in `usage/mod.rs:494-500`.
- `provider: "Codex"`.

### 4.3 Z.ai — `zai.rs`
- Endpoints: `https://api.z.ai/api/monitor/usage/quota/limit` (GET, `Authorization: Bearer`, `Accept: application/json`) and `https://api.z.ai/api/biz/subscription/list` (GET, same headers, best-effort — `.ok()`).
- Auth: `std::env::var("ZAI_API_KEY").or_else(|_| std::env::var("GLM_API_KEY"))` (173–174, 245–246). No file, no refresh.
- Metrics from `data.limits[]`, keyed by an opaque `(unit, number)` pair: `(Some(3), Some(5)) → "Session"`, `(Some(6), Some(1)) → "Weekly"` for `TOKENS_LIMIT`/`CREDIT_LIMIT` (CREDIT_LIMIT preferred); `TIME_LIMIT → "Web Search"`. `percentage` → used_percent (clamped); `next_reset_time` parsed from number/string/`next_reset_time`/`nextResetTime`; unrecognized codes skipped, never guessed.
- Plan: `data[0].product_name` from the subscription list, else capitalized `data.level`; `" (renews …)"` appended from `nextRenewTime`.

### 4.4 Amp — `amp.rs`
- Endpoint: POST `https://ampcode.com/api/internal`, JSON body `{"method":"userDisplayBalanceInfo","params":{}}`, `Authorization: Bearer {api_key}`.
- Auth: `~/.local/share/amp/secrets.json` (exact `crate::paths::home_dir()` + `.local/share/amp/secrets.json`), JSON key serde-renamed `"apiKey@https://ampcode.com/"`. Env var: **none**.
- Metrics parsed from a free-text `result.display_text`:
  - `Free`: `$X/$Y remaining` → used = (total − remaining), percent; reset estimated from `+$RATE` hourly replenish.
  - `Credits`: `Individual credits: $X` → `$X left` (bar kept full).
- `plan` inferred: has `Free` → `"Free"`, else has `Credits` → `"Credits"`. No refresh flow.

### 4.5 Antigravity — `antigravity.rs`
- `const RPC_PATH: &str = "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";` (43) → POST `http://127.0.0.1:{port}{RPC_PATH}` with `Connect-Protocol-Version: 1` and an empty JSON body. **Never reaches a cloud API.**
- Port discovery: (a) `~/.gemini/antigravity-cli/cli.log`, tail 256 KB then head 64 KB, marker `"listening on random port at "` filtered by `"for HTTP" && !"for HTTPS"`, newest-first, max 4 candidates; (b) `crate::antigravity::detect_antigravity_connections()` process scan needing `--csrf_token` (≥32 hex/`-`) and `--extension_server_port`, heartbeat `POST .../Heartbeat` with `X-Codeium-Csrf-Token`. 5 s per-source round, candidates raced concurrently.
- **Auth: none held by tokscale.** Comment: the token stays inside the language server; no env var, file, or keychain read in this module. `has_credentials()` just probes `discover_quota()`.
- Metrics: `QuotaSummary.groups[]` → one `UsageOutput` per group (`Fetch::Multi`); `groups[].buckets[]` → metrics. Label = `bucket.window` (`"weekly"` / `"5h"`) if non-empty else `bucket.displayName`. `remaining = remainingFraction.clamp(0,1)×100`; `used_percent = 100 − remaining`; `resets_at = bucket.resetTime`. Buckets without a finite `remainingFraction` are dropped, never defaulted to 0.
- `provider: "Antigravity"`, group name in `account.label` (slug id), so it renders as `Antigravity (Gemini Models)`. No plan/email/credits. No refresh flow.

### 4.6 Copilot — `copilot.rs`
- Endpoint: GET `https://api.github.com/copilot_internal/user` (471) with `Authorization: token {token}` plus editor/plugin/user-agent/api-version headers listed in the table. This is the file's only URL.
- Auth resolution order (400–411): env `GH_TOKEN` → `GITHUB_TOKEN`; then Keychain service `GH_KEYRING_SERVICE = "gh:github.com"` (macOS `security find-generic-password`, Windows Credential Manager targets `"gh:github.com:"` then `"gh:github.com"`, `go-keyring-base64:` prefix stripped and base64-decoded); then `gh_config_dir()/hosts.yml` (`GH_CONFIG_DIR` → `XDG_CONFIG_HOME/gh` → Windows `APPDATA/GitHub CLI` → `~/.config/gh`), parsing section `github.com:` key `oauth_token:`. **No `gh` subprocess and no OAuth refresh.**
- `~/…/github-copilot/apps.json` is observability-only (`credential_probe()`), never used for auth.
- Metrics: paid tier from `quota_snapshots` (`remaining`/`entitlement`/`percent_remaining`, fallback ratio), free tier from `limited_user_quotas` × `monthly_quotas`; labels `"Premium"` (`premium_interactions`), `"Chat"`, `"Completions"`, others title-cased. `plan` = capitalize(`copilot_plan`). `provider: "Copilot"`.

### 4.7 Grok Build — `grok.rs`
- Endpoints (12–14):
  - `SUBSCRIPTIONS_URL = "https://grok.com/rest/subscriptions"` (GET)
  - `TASK_USAGE_URL = "https://grok.com/rest/tasks/usage"` (GET)
  - `BILLING_GRPC_URL = "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig"` (POST, `application/grpc-web+proto`, body `vec![0,0,0,0,0]`)
- Shared headers: `Authorization: Bearer {token}`, `X-XAI-Token-Auth: xai-grok-cli`, `Accept: application/json`, `User-Agent: "Grok Build"`.
- Fallback transport (non-HTTP): spawn `grok agent --no-leader stdio` and JSON-RPC `initialize` then `x.ai/billing` over stdin/stdout, 4 s budget, only when `auth.json` holds exactly one credential.
- Auth: `GROK_HOME` env (`var_os`, unfiltered — blank yields a relative `auth.json`) → `$GROK_HOME/auth.json`, else `~/.grok/auth.json`, else `./.grok/auth.json`. Each scope object's `"key"` is a token, `"email"` optional; `auth.x.ai` scopes prioritized. **No refresh flow.**
- Metrics: gRPC protobuf field 1 fixed32 float = used percent, fields 4/5 = period start/end; label via `cycle_label` → `"Weekly"` (6–8 days), `"Monthly"` (27–33 days), else `"Credits"`. Task usage adds `"Tasks"`, `"Frequent"`, `"Occasional"`. JSON fallback computes from `monthlyLimit`×(used/limit) or `usedPercent`/`usagePercent`/`creditUsagePercent`.
- `provider: "Grok Build"`; `plan` from the `status == "active"` subscription's `tier`, normalized by stripping `SUBSCRIPTION_TIER_` then `TIER_` (e.g. `"Super Grok Pro"`); `email` from auth.

### 4.8 Kimi — `kimi.rs`
- Endpoints (inline literals): POST `https://auth.kimi.com/api/oauth/token` (form) and GET `https://api.kimi.com/coding/v1/usages` (`Authorization: Bearer`, `User-Agent: OpenUsage`).
- Auth file candidates: `$KIMI_CODE_HOME/credentials/kimi-code.json` (blank env treated as unset), else `~/.kimi/credentials/kimi-code.json`; keys `access_token`, `refresh_token`, `expires_at`.
- **OAuth refresh flow exists**: `const CLIENT_ID: &str = "17e5f671-d194-4dfb-9706-5516cb48c098";` with `grant_type=refresh_token`; proactive when `now + 300 > expires_at`, reactive on a `NEEDS_AUTH` error, then retried; writes back atomically with 0600 perms.
- Metrics: `limits[]` windows labelled `"Session"` when `duration <= 3600` else `"Weekly"`, plus top-level `usage` as `"Weekly"`, deduped on `label:used_percent:remaining_label:resets_at`. `limit`/`remaining` i64 strings; `remaining_label = "{remaining}/{limit} left"`. Plan from `user.membership.level` with `LEVEL_` stripped. `provider: "Kimi"`.

### 4.9 MiniMax — `minimax.rs`
- Endpoint: GET `https://api.minimax.io/v1/api/openplatform/coding_plan/remains`, `Authorization: Bearer {key}`, `Content-Type`/`Accept: application/json`.
- Auth: env `MINIMAX_API_KEY` else `MINIMAX_API_TOKEN`. No file, no refresh. `base_resp.status_code == 1004` or a cookie/login message ⇒ auth error.
- Metrics: first `model_remains[]` entry with `current_interval_total_count > 0`; single `"Session"` metric `"{total-used}/{total} prompts left"`; `used_percent` from `current_interval_used_count` else `total − (remaining_count|usage_count)`; `resets_at` from `end_time` else `remains_time`. Plan from `current_subscribe_title`/`plan_name`, else inferred from total (÷15 model calls/prompt: 100→Starter, 300→Plus, 1000→Max, 2000→Ultra).

### 4.10 MiniMax Token Plan — `minimax_tokenplan.rs`
- `const TOKEN_PLAN_PATH: &str = "/v1/token_plan/remains";` against two sites:
  - `https://www.minimaxi.com` — key env `MINIMAX_TOKEN_PLAN_CN_KEY` — label `CN`
  - `https://www.minimax.io` — key env `MINIMAX_TOKEN_PLAN_GLOBAL_KEY` — label `Global`
- Auth: env only, `Authorization: Bearer`, trimmed, empty rejected. No refresh.
- Metrics per `model_remains[]` entry: interval `<model_name>` from `current_interval_remaining_percent` (`resets_at` from `end_time`), and weekly `<model_name>·wk` only when `current_weekly_status != 0`. `Fetch::Multi`; one output per site with credentials, `account.label` = `CN`/`Global`; sites with no renderable windows are skipped.

### 4.11 Warp/Oz — `usage/warp.rs` (+ producer `src/warp.rs`)
- **The usage provider makes no network call at all**: `fetch()` reads `crate::warp::load_usage_cache()` and errors `"Warp aggregate usage cache not found"` if absent. `has_credentials()` is also cache-only.
- Producer (`src/warp.rs`, 634 lines): `const WARP_GRAPHQL_ENDPOINT: &str = "https://app.warp.dev/graphql/v2";` — POST with two GraphQL operations, `GetRequestLimitInfo` (`requestLimitInfo { requestLimit requestsUsedSinceLastRefresh nextRefreshTime bonusGrantsInfo { spendingInfo { currentMonthSpendCents currentMonthCreditsPurchased } } }`) and `GetWorkspacesMetadataForUser`. 8 s timeout.
- Auth: `WarpCredentials { authValue, authKind: Bearer | Cookie }` at `<config>/warp-cache/credentials.json`, written interactively by `tokscale warp login` (prompts with `rpassword` unless `--token`); cache at `<config>/warp-cache/usage.json` written by `tokscale warp sync`. **No environment variable.**
- Metrics: `Requests` (`"N requests left"` when a limit exists, else `"N requests used"` with a full bar) and `Spend` (`$X.XX`, informational, full bar). `provider: "Warp/Oz"`; no account/plan/email/credits.

### 4.12 Sakana — `sakana.rs`
- `const BILLING_URL: &str = "https://console.sakana.ai/billing";` — GET with `Cookie`, `User-Agent` (Chrome 124 macOS), `Accept: text/html`. **HTML scrape; there is no public usage API** (documented in `docs/providers/sakana.md` and the file header).
- Auth: env `SAKANA_SESSION_COOKIE` (takes precedence) else `<crate::paths::get_config_dir()>/sakana-session`, trimmed; cookie is the NextAuth/Auth.js `__Secure-authjs.session-token[.0/.1]` value(s). 401/403 → `NEEDS_AUTH`. **No refresh flow** — the user re-copies the cookie.
- Metrics: `LABELS = ["5-hour", "Weekly"]` matched as `>{label}<`; percent from a `% used` marker (f64, clamped); `resets_at` from `Resets on <Month D, YYYY at H:MM AM/PM>`. Windows are bound structurally (label → next label) to defeat duplicated React-Server-Component data; a degraded fallback takes the first N `% used` in document order.
- `plan` metadata: `TIERS = ["Standard", "Pro", "Max"]`, `$N/mo` from `$(\d+)\s*/\s*mo`, next renewal from `Next renewal:? <Month D, YYYY>` → e.g. `"Pro ($20/mo, renews July 22, 2026)"`. No dollars-as-spend, no credits.

### 4.13 OpenCode Go — `opencode_go.rs`
- `const USAGE_URL: &str = "https://opencode.ai/zen/go/v1/usage";` (GET, `Authorization: Bearer`, `Accept: application/json`). Response body capped at 1 MiB.
- Auth, **file first then env**: `auth_path()` = `$XDG_DATA_HOME/opencode/auth.json` (blank XDG ignored) else `~/.local/share/opencode/auth.json`; document key `"opencode-go"` with `"type":"api"` and `"key"` — `"type":"oauth"` is deliberately ignored. Else env `OPENCODE_API_KEY` (trimmed, non-empty). tokscale never rewrites this file.
- Metrics: `usage.rolling → "Rolling"`, `usage.weekly → "Weekly"`, `usage.monthly → "Monthly"`; `percent` → used_percent; `remaining_label = "rate-limited"` when `status == "rate-limited"`; `resets_at` from JSON `resetsAt`. `plan: "Go"`. `Fetch::Multi` returns exactly one output on success, or zero when HTTP 403 carries `{"error":{"type":"EntitlementError"}}` (provider silently omitted). 401 → actionable bail mentioning `/connect` or `OPENCODE_API_KEY`. No refresh flow.

---

## 5. Providers declared but NOT implemented

**NONE.** All 13 entries in the `usage_providers()` registry have a corresponding module, and every
module file listed in `mod.rs` exists. No usage provider appears in any CLI enum/label list without
an implementation.

Important non-finding to prevent a false positive: the binary's long concatenated provider-name
string (`Claude Code Codex CLI Cursor IDE Gemini CLI Amp Droid …`) is the **client/scanner enum**
(`crates/tokscale-core/src/clients.rs`, 53 display names), not a usage-provider list. Names such as
`Cursor IDE`, `Gemini CLI`, `DeepSeek`, `kiro-cli`, `Trae IDE`, `Augment Code`, `Devin CLI`,
`Cline`, `Zed Agent`, `Qoder`, `Volcengine`, `OpenRouter`, `Ollama`, `MiMo Code`, `Command Code`
are tracked clients for local token accounting and have **no** `tokscale usage` provider.

### Documentation drift found (upstream, informational)

`README.md` "#### Supported Providers" (lines 837–849) lists **11** rows and **omits two
implemented providers**: **Antigravity** and **Warp/Oz**. The authoritative 13-id list appears
instead in the `usage.disabledProviders` row at `README.md:946`:
`claude`, `codex`, `zai`, `amp`, `antigravity`, `copilot`, `grok`, `kimi`, `minimax`,
`minimax-token-plan`, `warp`, `sakana`, `opencode-go`.

### Cross-cutting auth summary

- **OAuth refresh-token flow exists in exactly 2 of 13**: Codex (Store credentials only;
  `client_id=app_EMoamEEZ73f0CkXaXp7hrann`) and Kimi (`client_id=17e5f671-d194-4dfb-9706-5516cb48c098`).
- **Claude's refresh flow is explicitly removed** (#1001) and its credential struct does not model a refresh token.
- **Env-var-only** (no file): Z.ai, MiniMax, MiniMax Token Plan.
- **File-only** (no env): Amp, Warp/Oz (own `tokscale warp login`).
- **Local-only / no credential**: Antigravity (talks to the local language server).
- **Keychain usage**: Claude (`"Claude Code-credentials"`) and Codex (`"Codex Auth"`) via
  `helpers::read_keychain`; Copilot (`"gh:github.com"`, plus Windows `wincred` targets).
- **HTML scrape**: Sakana (only provider without any JSON API).
- **`plan` populated**: Claude, Codex, Z.ai, Amp, Copilot, Grok, Kimi, MiniMax, Sakana.
  **`email` populated**: Codex, Grok only.
- **`reset_credits` / `credit_status` / `spend_control` populated by Codex only.**
- **`credential_source` non-null only for Codex (`"opencode"`).**
