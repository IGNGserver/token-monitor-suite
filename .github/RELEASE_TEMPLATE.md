# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Hub Web Dashboard Navigation & Routing:** Added independent URL routes for each page with full browser history (forward/back) support.
- **Hub Web Dashboard Redesign:** Redesigned home dashboard into a chart-forward command center with elevated 14-day token activity sparklines, proportion distribution bars for tools and models, visual limit health gauges, and deep-link navigation.
### Fixed
- **Header Navigation:** Removed redundant return-arrow icon in sub-page headers.
- **Header Metrics Scope:** Restricted top summary KPI cards (Tokens, Cost, Devices, Live) to the home dashboard to maximize vertical screen space on functional sub-pages.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.30-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.30-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-Setup-0.45.0-rev.30.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.45.0-rev.30.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.AppImage)

<details>
<summary><strong>First launch and other notes</strong></summary>

### First launch

**macOS:** the app is Developer ID-signed and notarized by Apple. Open the `.dmg`, then drag Token Monitor to Applications.

**Windows:** both executables are signed ([how to verify](https://github.com/IGNGserver/token-monitor-suite/blob/main/docs/code-signing.md#verify-a-download)).

**Linux:** mark the AppImage executable, then run it:

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### Other notes

Other platforms are not pre-built — run from source per the [README](https://github.com/IGNGserver/token-monitor-suite#readme). The macOS `.zip` is the same app repackaged; ignore it unless you specifically need it.

### tokscale dependency

Tokscale is bundled with this app. See **Settings → Tokscale** for the exact version
and the option to download a newer version directly from npm. Tokscale is MIT,
open-source: https://github.com/junhoyeo/tokscale

</details>

---

# 中文

## 更新内容

<!-- app-update-notes:zh:start -->
### 新增
- **中枢网页路由与独立 URL：** 各个子页面支持独立 URL，完整支持浏览器前进、后退与刷新直达。
- **中枢首页图表化大盘重构：** 首页重构为图表优先的可视化仪表盘，首屏呈现近 14 天用量走势交互图，工具与模型采用图形化比例条，紧张额度展示健康度色阶进度仪表，支持卡片快速直达明细。
### 修复
- **页眉导航优化：** 移除子页面页眉多余的返回三角按钮，界面更整洁协调。
- **总览指标条范围：** Token、Cost、设备数、Live 等顶部统计卡片仅在首页展示，为子页面释放完整垂直视口空间。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.30-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.30-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-Setup-0.45.0-rev.30.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.45.0-rev.30.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.AppImage)

<details>
<summary><strong>首次启动与其他说明</strong></summary>

### 首次启动

**macOS：** 应用已使用 Developer ID 签名并通过 Apple 公证。打开 `.dmg`，然后把 Token Monitor 拖到 Applications。

**Windows：** 两个可执行文件均已签名（[查看验证方法](https://github.com/IGNGserver/token-monitor-suite/blob/main/docs/code-signing.md#verify-a-download)）。

**Linux：** 先给 AppImage 执行权限，然后运行：

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### 其他说明

其他平台暂不提供预构建版本，请参考 [README](https://github.com/IGNGserver/token-monitor-suite#readme) 从源码运行。macOS 的 `.zip` 只是同一个 app 的重新打包版本，除非你明确需要，否则可以忽略。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>

---

<details>
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.45.0-rev.29...v0.45.0-rev.30">v0.45.0-rev.29...v0.45.0-rev.30</a></summary>

<!-- github-generated-release-notes -->

</details>

<details>
<summary>繁體中文 · 한국어 · 日本語</summary>

<details>
<summary><strong>繁體中文</strong></summary>

## 繁體中文

## 更新內容

<!-- app-update-notes:zh-TW:start -->
### 新增
- **中樞網頁路由與獨立 URL：** 各個子頁面支援獨立 URL，完整支援瀏覽器前進、後退與重新整理直達。
- **中樞首頁圖表化大盤重構：** 首頁重構為圖表優先的可視化儀表板，首屏呈現近 14 天用量走勢互動圖，工具與模型採用圖形化比例條，緊張額度展示健康度色階進度儀表，支援卡片快速直達明細。
### 修正
- **頁首導覽優化：** 移除子頁面頁首多餘的返回三角按鈕，介面更整潔協調。
- **總覽指標列範圍：** Token、Cost、裝置數、Live 等頂部統計卡片僅在首頁展示，為子頁面釋放完整垂直視口空間。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.30-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.30-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-Setup-0.45.0-rev.30.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.45.0-rev.30.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가
- **Hub 계정 설정:** Hub Web 대시보드에 계정 관리 탭을 추가하여 DeepSeek, Claude, Codex, Antigravity (AGY), Copilot, OpenCode 등 제공자의 간편 입력 및 JSON 자격 증명을 중앙 집중식으로 지원합니다.
- **Codex 및 Antigravity 지원:** auth.json/OAuth Token을 통한 Codex 한도 조회와 RPC 엔드포인트를 통한 AGY 한도 조회를 Hub에서 직접 지원하며, 면책 조항을 추가했습니다.
### 수정
- **Hub Web 상호작용:** 실시간 업데이트 중에도 관리 폼 초안, 포커스, 커서 및 스크롤 위치를 보존하며, 제공자 선택과 구독 충전 내역을 계속 사용할 수 있습니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.30-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.30-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-Setup-0.45.0-rev.30.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.45.0-rev.30.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **Hub アカウント設定:** Hub Web ダッシュボードにアカウント管理タブを追加し、DeepSeek、Claude、Codex、Antigravity (AGY)、Copilot、OpenCode などの簡易入力および JSON 認証情報の集中管理に対応しました。
- **Codex および Antigravity 対応:** Hub 側で auth.json/OAuth Token を用いた Codex の上限取得および RPC 経由での AGY 上限取得に対応し、設定時の免責事項を追加しました。
### 修正
- **Hub Web の操作性:** リアルタイム更新中も管理フォームの下書き、フォーカス、カーソル、スクロール位置を保持し、プロバイダー選択とサブスクリプションのチャージ明細を継続して操作できます。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.30-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.30-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-Setup-0.45.0-rev.30.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.45.0-rev.30.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.45.0-rev.30.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.30/Token-Monitor-0.45.0-rev.30.AppImage)

</details>

</details>
