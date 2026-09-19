/* i18n.js: translations + language resolution. No auto-run; main.js drives it. */
var supportedLanguages = ["en", "zh-TW", "zh-CN"];
var languageStorageKey = "token-monitor-site-language";

var translations = {
  en: {
    "meta.title": "Token Monitor: AI Tools usage at a glance",
    "meta.description": "Token Monitor is a local-first desktop app for real-time token, cost, limit, and session monitoring across AI Tools.",
    "meta.ogTitle": "Token Monitor",
    "meta.ogDescription": "Local-first token, cost, limit, and session monitoring for AI Tools.",
    "nav.skip": "Skip to content",
    "nav.primary": "Primary",
    "nav.home": "Token Monitor home",
    "nav.language": "Language",
    "nav.theme": "Toggle light or dark theme",
    "nav.github": "GitHub",
    "nav.sections": "Section navigation",
    "nav.features": "Features",
    "nav.privacy": "Privacy",
    "nav.download": "Download",

    "hero.eyebrow": "Local-first AI coding telemetry",
    "hero.title": "AI Tools usage at a glance",
    "hero.lede": "A local-first desktop app for real-time token, cost, limit, session, and trend monitoring across AI Tools.",
    "hero.actions": "Primary actions",
    "hero.platforms": "Supported platforms",
    "cta.download": "Download latest release",
    "cta.github": "View on GitHub",

    "tools.eyebrow": "Tracks every tool in your loop",

    "feature.title": "Tokens, limits, trends, and session detail in one view.",
    "feature.live.title": "Live token tracking & cost",
    "feature.live.body": "Watch every supported AI coding tool — Claude Code, Codex, Cursor, Kimi, Qwen, Grok, Copilot, and the rest — update within seconds of each turn, with cost and cache-hit rates alongside every count, themed light or dark to match your setup.",
    "feature.limits.title": "AI Tool Limits before you hit the wall",
    "feature.limits.body": "See session, weekly, billing, credits, and balance windows across every supported provider — Claude Code, Codex, Cursor, Grok, Copilot, Kiro, and more — so a limit never surprises you mid-task.",
    "feature.session.title": "Per-session detail on demand",
    "feature.session.body": "Open a Claude Code, Codex, or OpenCode session to see tokens per prompt and per reply, read on-demand from local transcripts or databases. Never synced.",
    "feature.trends.title": "A year of trends, in the same window",
    "feature.trends.body": "Flip to the Trends view for a twelve-month chart with active days, streaks, and your peak day. It is the same view the Hub serves in a browser. The full dashboard below goes deeper.",
    "feature.status.title": "Provider status, next to your quotas",
    "feature.status.body": "Watch Claude, OpenAI, Cursor, and DeepSeek service status on the Limits view's health panel. Each card leads with the active incident title and the count of affected components, and re-checks on your chosen interval.",

    "dash.title": "A year of AI coding, charted.",
    "dash.lede": "Turn on history collection and Token Monitor builds a full year of data: a GitHub-style activity heatmap with streaks, plus per-tool and per-model usage stacked over time in bar and K-line views, rolled up across all your devices.",
    "mock.you": "YOU",
    "mock.newest": "↕ Newest",
    "mock.session.one": "Compare model spend...",
    "mock.session.two": "Inspect reply details...",

    "surfaces.title": "The same usage, on every surface you already use.",
    "surfaces.web.title": "Hub dashboard & PWA",
    "surfaces.web.body": "The Hub serves the identical UI in a browser and installs as a PWA, so a machine without the app still gets the full dashboard.",
    "surfaces.android.title": "Android client",
    "surfaces.android.body": "A native read-only client for your synced devices, totals, trends, and Hub-managed account limits.",
    "surfaces.discord.playing": "Playing",
    "surfaces.discord.title": "Discord Rich Presence",
    "surfaces.discord.body": "Broadcast today's tokens, cost, and top tool to your profile. Opt-in.",
    "surfaces.desktop.title": "Desktop app",
    "surfaces.desktop.body": "A normal macOS, Windows, and Linux window that watches this machine's own logs and updates within seconds.",

    "how.title": "Start with one desktop app. Add a hub for multi-device sync.",
    "how.lede": "Local stays the default path. Add self-hosted sync when you want token usage from multiple devices rolled into one view.",
    "how.local.title": "Local mode",
    "how.local.body": "The desktop app reads local usage summaries through tokscale and renders them on the same machine. No account, no cloud.",
    "how.pivot.note": "Choose Local only or Connect to a hub under Settings → Hub connection. Point it at a Hub URL and the app starts syncing; clear the field and everything stays on this machine.",
    "how.sync.title": "Sync mode",
    "how.sync.body": "Each desktop app or headless agent posts that device's usage summary to your hub, which merges totals and streams them back to every connected client.",
    "how.node.desktop": "Desktop app",
    "how.node.tokscale": "tokscale",
    "how.node.localLogs": "Local AI logs",
    "how.node.mac": "macOS app",
    "how.node.windows": "Windows app",
    "how.node.agent": "Headless agent",
    "how.node.hub": "Self-hosted hub",
    "how.node.summaryStream": "Summary stream",
    "how.backends": "The Docker Compose Hub is the supported sync backend.",
    "how.backends.label": "Supported sync backend",
    "how.backend.compose": "Docker Compose Hub",

    "privacy.title": "Your code and conversations are not the product.",
    "privacy.body": "Token Monitor syncs only the fields needed to show totals, costs, and tool and model breakdowns; account limits are refreshed by the Hub, not uploaded from your devices.",
    "privacy.payload.cap": "The entire record a hub ever receives: counts, costs, labels, and limit percentages. The account behind each limit is a one-way hash, never the login itself.",
    "privacy.never": "Never syncs",
    "privacy.never.1": "Raw prompts or source files",
    "privacy.never.2": "Conversation transcripts",
    "privacy.never.3": "OAuth credentials or provider responses",

    "final.title": "Download the packaged app and keep every coding tool visible.",
    "final.readme": "Read the setup guide",
    "final.downloads": "Release download options",
    "final.mac.title": "macOS .dmg",
    "final.mac.body": "Apple Silicon, M1 and later",
    "final.win.title": "Windows Setup .exe",
    "final.win.body": "Installer build, recommended",
    "final.source": "Intel Mac, Linux, and source installs are covered in the README for advanced setups.",

    "footer.api": "API docs",
    "footer.hub": "Hub deployment guide",
    "footer.license": "License"
  },

  "zh-TW": {
    "meta.title": "Token Monitor：AI Tools 用量一眼看清",
    "meta.description": "Token Monitor 是為 AI Tools 打造的本地優先桌面應用，可即時監控 token、成本與限額，查看 session 明細，並透過自架 hub 同步多台裝置。",
    "meta.ogTitle": "Token Monitor",
    "meta.ogDescription": "為 AI Tools 打造的本地優先 token、成本、限額與 session 監控。",
    "nav.skip": "跳到內容",
    "nav.primary": "主要導覽",
    "nav.home": "Token Monitor 首頁",
    "nav.language": "語言",
    "nav.theme": "切換淺色或深色主題",
    "nav.github": "GitHub",
    "nav.sections": "區塊導覽",
    "nav.features": "功能",
    "nav.privacy": "隱私",
    "nav.download": "下載",

    "hero.eyebrow": "本地優先的 AI coding telemetry",
    "hero.title": "AI Tools 用量一眼看清",
    "hero.lede": "為 AI Tools 打造的桌面應用，即時監控 token、成本、限額、session 與歷史趨勢。",
    "hero.actions": "主要操作",
    "hero.platforms": "支援平台",
    "cta.download": "下載最新版本",
    "cta.github": "查看 GitHub",

    "tools.eyebrow": "涵蓋你工作流裡的每個工具",

    "feature.title": "Token、限制、趨勢與 session 明細，集中在一個畫面。",
    "feature.live.title": "即時 token 追蹤與成本",
    "feature.live.body": "所有支援的 AI 編碼工具 — Claude Code、Codex、Cursor、Kimi、Qwen、Grok、Copilot 等等 — 每輪對話後數秒內更新，每個數字旁都有成本與 cache 命中率，並可切換淺色或深色主題。",
    "feature.limits.title": "在撞牆前看見 AI Tool Limits",
    "feature.limits.body": "跨所有支援的供應商 — Claude Code、Codex、Cursor、Grok、Copilot、Kiro 等等 — 看見 session、每週、帳單、credits 與餘額視窗，限制不再在工作中途突襲你。",
    "feature.session.title": "需要時才看 session 明細",
    "feature.session.body": "打開 Claude Code、Codex 或 OpenCode session，看每個 prompt 與 reply 的 token；從本機 transcript 或資料庫即時讀取，永不同步。",
    "feature.trends.title": "一年的趨勢，就在同一個視窗裡",
    "feature.trends.body": "切到 Trends 視圖就能看到 12 個月的用量長條、活躍天數、連續天數與單日高峰，同一套視圖也會由 hub 在瀏覽器裡提供。想看更深入的，往下捲到完整 dashboard。",
    "feature.status.title": "服務狀態，就在額度面板旁",
    "feature.status.body": "在額度視圖的健康面板就能查看 Claude、OpenAI、Cursor 與 DeepSeek 的服務狀態。每張卡片以進行中的事件標題與受影響元件數開頭，並依你設定的間隔重新檢查。",

    "dash.title": "把一年的 AI coding 畫成圖。",
    "dash.lede": "開啟歷史收集後，Token Monitor 會建立完整一年的資料：GitHub 風格的活動熱力圖與連續天數，加上隨時間堆疊的各工具、各模型用量，提供長條圖與 K 線兩種檢視，並彙整你所有裝置。",
    "mock.you": "你",
    "mock.newest": "↕ 最新",
    "mock.session.one": "比較模型成本...",
    "mock.session.two": "查看 reply 明細...",

    "surfaces.title": "同一份用量，出現在你本來就在用的每個介面。",
    "surfaces.web.title": "Hub 儀表板與 PWA",
    "surfaces.web.body": "Hub 在瀏覽器裡提供完全相同的介面，也能安裝成 PWA，沒裝應用的機器照樣能看到完整儀表板。",
    "surfaces.android.title": "Android 用戶端",
    "surfaces.android.body": "原生唯讀用戶端，查看已同步的裝置、總量、趨勢與 hub 管理的帳號額度。",
    "surfaces.discord.playing": "正在遊玩",
    "surfaces.discord.title": "Discord Rich Presence",
    "surfaces.discord.body": "把今日 tokens、成本與最常用工具廣播到你的個人檔案，可選開啟。",
    "surfaces.desktop.title": "桌面應用",
    "surfaces.desktop.body": "macOS、Windows 與 Linux 上的標準視窗，監看這台機器自己的紀錄並在數秒內更新。",

    "how.title": "先用一個桌面應用。要同步多台裝置時才加 hub。",
    "how.lede": "本地仍是預設路徑。想彙整多台裝置的 Token 用量時，再加一層自架同步。",
    "how.local.title": "本地模式",
    "how.local.body": "桌面應用透過 tokscale 讀取本機用量摘要，並在同一台機器上顯示。不需要帳號、不需要雲端。",
    "how.pivot.note": "在 設定 → 中樞連線 裡選擇 僅本機 或 連線中樞。填上 hub 網址，應用就開始同步；清空欄位，一切就留在這台機器上。",
    "how.sync.title": "同步模式",
    "how.sync.body": "每個桌面應用或 headless agent 會把該裝置的用量摘要送到你的 hub，hub 彙整後再串流回所有已連線的用戶端。",
    "how.node.desktop": "桌面應用",
    "how.node.tokscale": "tokscale",
    "how.node.localLogs": "本機 AI logs",
    "how.node.mac": "macOS 應用",
    "how.node.windows": "Windows 應用",
    "how.node.agent": "Headless agent",
    "how.node.hub": "自架 hub",
    "how.node.summaryStream": "摘要串流",
    "how.backends": "Docker Compose Hub 是目前支援的同步後端。",
    "how.backends.label": "支援的同步後端",
    "how.backend.compose": "Docker Compose Hub",

    "privacy.title": "你的程式碼與對話不是產品。",
    "privacy.body": "Token Monitor 只同步顯示總量、成本與工具／模型拆分所需的欄位；帳戶額度由 hub 刷新，不會從你的裝置上傳。",
    "privacy.payload.cap": "這就是 hub 收到的完整紀錄：數字、成本、標籤與限制百分比。每個限制背後的帳戶都是單向 hash，永遠不是登入身分本身。",
    "privacy.never": "永不同步",
    "privacy.never.1": "原始提示詞或原始碼",
    "privacy.never.2": "對話 transcript",
    "privacy.never.3": "OAuth 憑證或 provider 回應",

    "final.title": "下載打包好的 App，讓每個 coding 工具的用量都看得見。",
    "final.readme": "閱讀設定指南",
    "final.downloads": "Release 下載選項",
    "final.mac.title": "macOS .dmg",
    "final.mac.body": "Apple Silicon，M1 或更新機型",
    "final.win.title": "Windows Setup .exe",
    "final.win.body": "建議使用安裝版",
    "final.source": "Intel Mac、Linux 與原始碼啟動方式請看 README，適合進階設定。",

    "footer.api": "API 文件",
    "footer.hub": "Hub 部署指南",
    "footer.license": "授權"
  },

  "zh-CN": {
    "meta.title": "Token Monitor：AI Tools 用量一眼看清",
    "meta.description": "Token Monitor 是为 AI Tools 打造的本地优先桌面应用，可实时监控 token、成本与限额，查看 session 明细，并通过自托管 hub 同步多台设备。",
    "meta.ogTitle": "Token Monitor",
    "meta.ogDescription": "为 AI Tools 打造的本地优先 token、成本、限额与 session 监控。",
    "nav.skip": "跳到内容",
    "nav.primary": "主要导航",
    "nav.home": "Token Monitor 首页",
    "nav.language": "语言",
    "nav.theme": "切换浅色或深色主题",
    "nav.github": "GitHub",
    "nav.sections": "区块导航",
    "nav.features": "功能",
    "nav.privacy": "隐私",
    "nav.download": "下载",

    "hero.eyebrow": "本地优先的 AI coding telemetry",
    "hero.title": "AI Tools 用量一眼看清",
    "hero.lede": "为 AI Tools 打造的桌面应用，实时监控 token、成本、限额、session 与历史趋势。",
    "hero.actions": "主要操作",
    "hero.platforms": "支持平台",
    "cta.download": "下载最新版本",
    "cta.github": "查看 GitHub",

    "tools.eyebrow": "覆盖你工作流里的每个工具",

    "feature.title": "Token、限制、趋势与 session 明细，集中在一个界面。",
    "feature.live.title": "实时 token 追踪与成本",
    "feature.live.body": "所有受支持的 AI 编码工具 — Claude Code、Codex、Cursor、Kimi、Qwen、Grok、Copilot 等等 — 每轮对话后数秒内更新，每个数字旁都有成本与 cache 命中率，并可切换浅色或深色主题。",
    "feature.limits.title": "在撞墙前看见 AI Tool Limits",
    "feature.limits.body": "跨所有受支持的提供商 — Claude Code、Codex、Cursor、Grok、Copilot、Kiro 等等 — 看见 session、每周、账单、credits 与余额窗口，限制不再在工作中途突袭你。",
    "feature.session.title": "需要时才看 session 明细",
    "feature.session.body": "打开 Claude Code、Codex 或 OpenCode session，看每个 prompt 与 reply 的 token；从本机 transcript 或数据库实时读取，永不同步。",
    "feature.trends.title": "一年的趋势，就在同一个窗口里",
    "feature.trends.body": "切到 Trends 视图就能看到 12 个月的用量柱状、活跃天数、连续天数与单日峰值，同一套视图也会由 hub 在浏览器里提供。想看更深入的，往下滚到完整 dashboard。",
    "feature.status.title": "服务状态，就在额度面板旁",
    "feature.status.body": "在额度视图的健康面板就能查看 Claude、OpenAI、Cursor 与 DeepSeek 的服务状态。每张卡片以进行中的事件标题与受影响组件数开头，并按你设定的间隔重新检查。",

    "dash.title": "把一年的 AI coding 画成图。",
    "dash.lede": "开启历史收集后，Token Monitor 会建立完整一年的数据：GitHub 风格的活动热力图与连续天数，加上随时间堆叠的各工具、各模型用量，提供柱状图与 K 线两种视图，并汇总你所有设备。",
    "mock.you": "你",
    "mock.newest": "↕ 最新",
    "mock.session.one": "比较模型成本...",
    "mock.session.two": "查看 reply 明细...",

    "surfaces.title": "同一份用量，出现在你本来就在用的每个界面。",
    "surfaces.web.title": "Hub 仪表板与 PWA",
    "surfaces.web.body": "Hub 在浏览器里提供完全相同的界面，也能安装成 PWA，没装应用的机器照样能看到完整仪表板。",
    "surfaces.android.title": "Android 客户端",
    "surfaces.android.body": "原生只读客户端，查看已同步的设备、总量、趋势与 hub 管理的账号额度。",
    "surfaces.discord.playing": "正在玩",
    "surfaces.discord.title": "Discord Rich Presence",
    "surfaces.discord.body": "把今日 tokens、成本与最常用工具广播到你的个人资料，可选开启。",
    "surfaces.desktop.title": "桌面应用",
    "surfaces.desktop.body": "macOS、Windows 与 Linux 上的标准窗口，监视这台机器自己的日志并在数秒内更新。",

    "how.title": "先用一个桌面应用。要同步多台设备时才加 hub。",
    "how.lede": "本地仍是默认路径。想汇总多台设备的 Token 用量时，再加一层自托管同步。",
    "how.local.title": "本地模式",
    "how.local.body": "桌面应用通过 tokscale 读取本机用量摘要，并在同一台机器上显示。不需要账号、不需要云端。",
    "how.pivot.note": "在 设置 → 中枢连接 里选择 仅本机 或 连接中枢。填上 hub 网址，应用就开始同步；清空字段，一切就留在这台机器上。",
    "how.sync.title": "同步模式",
    "how.sync.body": "每个桌面应用或 headless agent 会把该设备的用量摘要送到你的 hub，hub 汇总后再流式推送回所有已连接的客户端。",
    "how.node.desktop": "桌面应用",
    "how.node.tokscale": "tokscale",
    "how.node.localLogs": "本机 AI logs",
    "how.node.mac": "macOS 应用",
    "how.node.windows": "Windows 应用",
    "how.node.agent": "Headless agent",
    "how.node.hub": "自托管 hub",
    "how.node.summaryStream": "摘要流",
    "how.backends": "Docker Compose Hub 是目前支持的同步后端。",
    "how.backends.label": "支持的同步后端",
    "how.backend.compose": "Docker Compose Hub",

    "privacy.title": "你的代码与对话不是产品。",
    "privacy.body": "Token Monitor 只同步显示总量、成本与工具／模型拆分所需的字段；账号额度由 hub 刷新，不会从你的设备上传。",
    "privacy.payload.cap": "这就是 hub 收到的完整记录：数字、成本、标签与限制百分比。每个限制背后的账号都是单向 hash，永远不是登录身份本身。",
    "privacy.never": "永不同步",
    "privacy.never.1": "原始提示词或源码",
    "privacy.never.2": "对话 transcript",
    "privacy.never.3": "OAuth 凭证或 provider 响应",

    "final.title": "下载打包好的 App，让每个 coding 工具的用量都看得见。",
    "final.readme": "阅读设置指南",
    "final.downloads": "Release 下载选项",
    "final.mac.title": "macOS .dmg",
    "final.mac.body": "Apple Silicon，M1 或更新机型",
    "final.win.title": "Windows Setup .exe",
    "final.win.body": "建议使用安装版",
    "final.source": "Intel Mac、Linux 与源码启动方式请看 README，适合进阶设置。",

    "footer.api": "API 文档",
    "footer.hub": "Hub 部署指南",
    "footer.license": "许可证"
  }
};

function normalizeLanguage(value) {
  if (!value) return "";
  var normalized = value.replace("_", "-");
  if (supportedLanguages.indexOf(normalized) !== -1) return normalized;
  var lower = normalized.toLowerCase();
  if (lower === "zh" || lower.indexOf("zh-hant") === 0 || lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo") return "zh-TW";
  if (lower.indexOf("zh-hans") === 0 || lower === "zh-cn" || lower === "zh-sg") return "zh-CN";
  if (lower.indexOf("en") === 0) return "en";
  return "";
}
function readStoredLanguage() { try { return normalizeLanguage(window.localStorage.getItem(languageStorageKey)); } catch (e) { return ""; } }
function storeLanguage(language) { try { window.localStorage.setItem(languageStorageKey, language); } catch (e) {} }
function languageFromHash() { return normalizeLanguage(window.location.hash.slice(1)); }
function preferredLanguage() { return languageFromHash() || readStoredLanguage() || normalizeLanguage(window.navigator.language) || "en"; }

function translateElement(element, messages) {
  var key = element.getAttribute("data-i18n");
  if (key && messages[key]) element.textContent = messages[key];
  var attrConfig = element.getAttribute("data-i18n-attr");
  if (!attrConfig) return;
  var pairs = attrConfig.split(",");
  for (var i = 0; i < pairs.length; i++) {
    var parts = pairs[i].split(":");
    var attr = (parts[0] || "").trim(), attrKey = (parts[1] || "").trim();
    if (attr && attrKey && messages[attrKey]) element.setAttribute(attr, messages[attrKey]);
  }
}
function applyLanguage(language) {
  var active = supportedLanguages.indexOf(language) !== -1 ? language : "en";
  var messages = translations[active];
  document.documentElement.lang = active;
  document.title = messages["meta.title"];
  var nodes = document.querySelectorAll("[data-i18n], [data-i18n-attr]");
  for (var i = 0; i < nodes.length; i++) translateElement(nodes[i], messages);
  var langBtns = document.querySelectorAll("[data-lang]");
  for (var j = 0; j < langBtns.length; j++) langBtns[j].setAttribute("aria-checked", String(langBtns[j].getAttribute("data-lang") === active));
  var cur = document.querySelector("[data-lang-current]");
  if (cur) cur.textContent = active === "zh-TW" ? "繁" : active === "zh-CN" ? "简" : "EN";
  storeLanguage(active);
  if (window.location.hash !== "#" + active) window.history.replaceState(null, "", "#" + active);
}
function setupLanguageButtons() {
  var btns = document.querySelectorAll("[data-lang]");
  for (var i = 0; i < btns.length; i++) {
    (function (b) { b.addEventListener("click", function () { applyLanguage(b.getAttribute("data-lang")); }); })(btns[i]);
  }
  window.addEventListener("hashchange", function () { applyLanguage(preferredLanguage()); });
}
