# 中枢异常崩溃与端侧无法连接问题排查报告及开发计划

> **Historical Archive / 历史归档说明**
> 
> 本文档是 2026-09 分支独立与桌面端重构过程中的内部审计/计划快照，**不再维护**。
> 文中提及的旧路径（如 `worker/`、`native/macos/`、旧版 `app.js` 等）在当前代码库中已不存在。

---


## 一、系统架构与现状审计概述

根据对项目代码（Node Hub 服务端、Electron 桌面端、Android 移动端、Headless Agent）的全面源码审计与网络/协议分析，重点针对**“中枢运行一段时间后异常崩溃导致无法连接”**以及**“桌面端与移动端在外网/公网 HTTP 连接情况下提示中枢离线或无法连接”**两大核心问题，梳理出关键风险点并制定详尽的修复开发计划。

---

## 二、发现的问题与根因分析（按严重程度划分）

### 1. 【致命 / 阻断性】Android 端硬编码禁止非 HTTPS 连接与明文 HTTP 拦截
- **根因代码**：
  1. `android/app/src/main/AndroidManifest.xml` 第 11 行：`android:usesCleartextTraffic="false"`。
  2. `android/app/src/main/java/com/igng/tokenmonitor/android/data/remote/HubApiFactory.kt` 第 73-75 行：
     ```kotlin
     require(allowInsecureHttp || normalized.startsWith("https://", ignoreCase = true)) {
         "Android 客户端只允许 HTTPS Hub；请为 LAN/VPN Hub 配置 TLS。"
     }
     ```
  3. `android/app/src/main/java/com/igng/tokenmonitor/android/data/local/ConnectionConfig.kt` 及设置界面：未提供类似桌面端的 `allowInsecureHubHttp`（允许非安全 HTTP）开关，且默认未开启。
- **引发故障**：用户在**外网 HTTP** 连接场景下（例如使用内网穿透端口映射 `http://remote.host:17321`，或使用公网 HTTP IP 连接中枢时），Android 客户端不仅在 URL 校验层直接 `throw IllegalArgumentException`，而且在底层 OkHttp 网络层也会被 Android 系统强制阻断（`Cleartext HTTP traffic to ... not permitted`），**彻底导致移动端提示中枢离线或无法连接**。

---

### 2. 【致命 / 崩溃隐患】Hub 服务端进程级未捕获异常与信号挂钩缺失
- **根因代码**：
  1. `src/hub/server.js` 与 `docker-entrypoint.sh`：Hub 作为独立后台 Node.js 服务运行，但全局**未监听 `process.on('uncaughtException')` 与 `process.on('unhandledRejection')`**。
  2. 运行时存在多个后台异步操作：
     - `accountService` 自动定时轮询刷新（`refreshAll('interval')` 每 5 分钟并发请求第三方 API/OAuth 刷新）；
     - SSE 心跳定时器与流式写入（`writeSse`）；
     - `fetchUpstreamPricing` / 动态模型价格上游拉取；
  3. `mysql2/promise` 连接池无主动断线重连守护与全局 pool error 监听：当网络波动或 MySQL 服务器瞬断重启（或连接闲置超时 `wait_timeout`），正在执行或等待连接的异步任务一旦抛出未捕获错误，Node.js 22+ 会直接触发进程退出（Crash Exit），导致容器停止或处于反复重启，**外部从此完全无法连接**。
  4. 缺少优雅退出与健康检查就绪守护：Docker 容器健康检查如果未及时响应或进程卡死，服务将失联。

---

### 3. 【高危 / 外网断连】外网反向代理 / CDN 场景下的 IP 速率限制（Rate Limit）雪崩误杀
- **根因代码**：
  `src/hub/server.js` 第 856-861 行：
  ```javascript
  const peer = String(req.socket?.remoteAddress || req.headers['cf-connecting-ip'] || 'unknown');
  const limited = authFailures.take(peer);
  if (!limited.ok) {
    sendJson(res, 429, { error: 'rate_limited' }, ...);
    return null;
  }
  ```
  以及 `ingestRequests.take(result.principal.id)`。
- **引发故障**：在外网环境下，用户通常会使用 Nginx、Caddy、Frp、Cloudflare 等公网反向代理接入中枢。
  - Hub 仅识别了 `cf-connecting-ip`，未识别常规反向代理标准头 `X-Forwarded-For` 或 `X-Real-IP`；
  - 代理层发来的所有连接 `req.socket.remoteAddress` 均为代理服务器自身内网 IP（如 `127.0.0.1`、`172.17.0.1`）；
  - 一旦移动端或桌面端某一次密钥输错或短暂网络丢包重试，导致错误次数在 1 分钟内达到 `authFailureLimit = 30`，整个代理 IP 将被限流拉黑！导致**所有后续外网连接（包括桌面端、移动端甚至 Web 控制台）全被拦截返回 HTTP 429**，呈现假死/离线状态。

---

### 4. 【高危 / 外网断连】SSE 长连接在外网 NAT、反代网关、路由器上的静默阻断与半开连接
- **根因代码**：
  1. 服务端 `src/hub/server.js`：SSE 心跳间隔为 30 秒（`sseHeartbeatMs = 30000`），未设置系统底层 `keepAliveTimeout` 与 `headersTimeout`，且响应头缺少针对反向代理的 `X-Accel-Buffering: no` 完整代理友好协商（虽然设置了部分，但未覆盖所有代理网关）。
  2. 桌面端 `src/electron/main.js`：SSE 静默检测为 90 秒（`SSE_IDLE_TIMEOUT_MS = 90 * 1000`）。外网移动蜂窝网络、家庭宽带 NAT 网关或公网代理的 TCP 空闲超时通常是 30-60 秒。
  3. Android 端 `HubRepository.kt`：OkHttp `eventSource` 的 readTimeout 设置为 0（无限等待），且完全依赖系统底层 TCP 发现断开。如果外网链路被 NAT 静默关闭（Half-Open TCP），移动端不会触发 `onFailure`，连接长时间假死，不会收到任何增量数据，直到用户手动杀死 App。

---

### 5. 【高危 / 运行故障】桌面端在非安全 HTTP 下的阻断与同步重启漏洞
- **根因代码**：
  1. `src/shared/hubTransport.js`：
     ```javascript
     function inspectHubTransport(rawUrl) {
       ...
       if (url.protocol === 'http:' && isLoopbackHostname(url.hostname)) {
         return { allowedByDefault: true, secure: false, loopback: true, url };
       }
       if (url.protocol === 'http:') return { allowedByDefault: false, secure: false, loopback: false, url };
     }
     ```
     外网 HTTP URL（如 `http://myhub.ddns.net:17321`）被归类为 `allowedByDefault: false`。
  2. 如果桌面端配置了外网 HTTP，但未在 GUI 开启 `allowInsecureHubHttp` 或未在环境变量配置 `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1`，桌面端会在 `effectiveHubConfig()` 中抛出 `insecure_hub_transport`，并且错误地将同步状态置为 `blocked`，**直接显示离线**。
  3. 服务端本身如果未设置 `TOKEN_MONITOR_ALLOW_INSECURE_HTTP=1` 且未开启 TLS，启动时若绑定非回环地址直接启动失败报错退出。

---

## 三、系统修复与改造开发计划

针对上述隐患，规划 **5 个阶段** 的改造修复方案：

### 阶段 1：移动端（Android）HTTP / HTTPS 兼容性与网络安全配置整改
- **任务目标**：彻底解决 Android 无法在外网 HTTP 下连接的问题。
- **具体工作**：
  1. **配置 Network Security Config**：
     创建 `android/app/src/main/res/xml/network_security_config.xml`，允许用户自定义的域名/IP 或在开启配置时允许 Cleartext HTTP 流量。
  2. **修改 AndroidManifest**：
     引入 `android:networkSecurityConfig="@xml/network_security_config"`，并将 `android:usesCleartextTraffic` 调整为支持安全开关控制（或在 release 中允许特定连接）。
  3. **扩展 ConnectionConfig 与 UI**：
     在 `ConnectionConfig` 和 `ConnectionStore` 中增加 `allowInsecureHttp: Boolean` 选项；在设置界面的“Hub 连接”卡片中添加“允许远程 HTTP 连接（用于无 TLS 的外网穿透或局域网）”Switch 开关。
  4. **改造 HubApiFactory**：
     将 `allowInsecureHttp` 与用户持久化设置联动，当用户勾选时不再强制 `require(normalized.startsWith("https://"))`。
  5. **SSE 心跳探测与超时自愈**：
     OkHttp SSE 客户端配置 Ping 间隔（如 15 秒发送一次 OkHttp Ping），防止外网 NAT 静默丢包导致流假死。

---

### 阶段 2：Hub 服务端高可用与抗崩溃守护（Process & Connection Resilience）
- **任务目标**：避免任何未捕获异常导致 Node.js 进程退出，保证服务长周期稳定运行。
- **具体工作**：
  1. **全局进程异常捕获守护**：
     在 `src/hub/server.js` 启动入口注册 `uncaughtException` 和 `unhandledRejection` 监听器，记录脱敏错误日志，阻止主进程因为第三方 API 超时、网络抖动、JSON 损坏而异常 Crash。
  2. **MySQL 连接池鲁棒性加固**：
     - 配置 `createMySqlPool` 的 `enableKeepAlive: true`、`keepAliveInitialDelay: 10000`；
     - 增加主动心跳保活机制或在 `transaction` 遇到网络层连接断开代码（如 `PROTOCOL_CONNECTION_LOST`, `ECONNRESET`）时提供有限自动重试机制；
     - 捕获 pool 上的 `error` 事件。
  3. **后台定时任务异常隔离**：
     在 `accountService`、`oauthService` 的轮询 `setInterval` 回调外层加固严格的 `try-catch` 屏障，隔离个别账号的 API 故障对 Hub 全局的影响。
  4. **优雅关机与信号处理**：
     监听 `SIGTERM` 与 `SIGINT`，优雅释放 MySQL 连接池与 SSE 客户端，防止残留孤儿连接和文件句柄泄漏。

---

### 阶段 3：外网反向代理与速率限制穿透加固（Proxy & Rate Limit Hardening）
- **任务目标**：避免通过外网代理/穿透访问时误触发 429 限流导致全局阻断。
- **具体工作**：
  1. **智能客户端真实 IP 识别**：
     新增受信任代理感知逻辑：支持通过环境变量 `TOKEN_MONITOR_TRUST_PROXY=1`，优先从 `X-Forwarded-For`（最左侧原始客户端 IP）或 `X-Real-IP` 解析真实发起 IP，避免所有外网用户公用反代服务器同一个 IP 造成限流连坐。
  2. **限流白名单与自愈容错**：
     对来自内网或已通过合法凭据鉴权通过的请求，防止因瞬时并发上报而误触发 `ingestRateLimit`。

---

### 阶段 4：桌面端（Electron）外网连接自愈与网络唤醒机制完善
- **任务目标**：外网环境下断线自愈、网络切换自愈、长效重连。
- **具体工作**：
  1. **HTTP 边界与配置引导**：
     当用户输入非回环 `http://` 地址且未勾选允许非安全 HTTP 时，UI 给出明确友好提示“当前地址使用的是 HTTP 传输，请在下方勾选【允许可信远端 HTTP】”，而不是直接报模糊的离线。
  2. **SSE 链路自愈增强**：
     外网连接时动态缩小心跳检测间隔（如 45 秒），在检测到系统休眠恢复、网络接口改变（WiFi 切换/重连）时主动触发连接重建。

---

### 阶段 5：验证与自测闭环（Verification & DoD）
- **测试矩阵**：
  1. `npm test` 与 `npm run verify` 全流程通过；
  2. 模拟外网 HTTP URL（如通过本地别名域名/公网非回环模拟）分别测试 Electron 与 Android 客户端双向数据通信（上传 Ingest + 订阅 SSE）；
  3. 模拟 MySQL 瞬时断开、第三方 Account API 抛出严重网络异常，验证 Hub 进程不崩溃且自动恢复；
  4. 模拟通过反向代理并发请求，验证限流模块不会误将反代 IP 整体拉黑。

---

## 四、下一任务提示词（一句话提示词）

你可以将以下提示词直接复制并发送给下一个对话：

> **“请根据 `HUB_STABILITY_PLAN.md` 中的开发计划，实施中枢高可用抗崩溃加固（进程级未捕获异常与 MySQL 连接池保活守护、代理 IP 限流加固）以及桌面端与移动端在外网 HTTP 连接下的兼容性改造（包括 Android 网络安全策略 Cleartext 配置与设置界面开关），并运行全量验证确保通过。”**
