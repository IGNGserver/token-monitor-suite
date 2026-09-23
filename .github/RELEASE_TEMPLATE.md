# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Hub Web information architecture:** Replaced the legacy navigation with Overview, Usage, Devices, Limits, Trends, Accounts, Management, and Settings pages while preserving old URLs.
- **Usage detail:** Added tool/model/project/session tabs with input, output, cache, uncached-token, cost, and expandable breakdown views.
- **Headless agent package:** Added a release archive for machines that collect usage without the desktop app.
### Improved
- **Trends and device visibility:** Added 7/30/90/365/all trend ranges, activity summaries, device runtime/status details, and explicit custom-range scope notices.
- **Shared sync runtime:** Unified upload scheduling, retry/backoff, device identity, and summary/archive handling between Electron and the headless agent.
### Fixed
- **Web compatibility:** Legacy tool, model, project, session, device, status, subscription, and pricing routes now redirect into the new page model without losing their tab.
- **Configuration boundaries:** Web settings now expose only web-safe preferences and clearly identify desktop-only controls.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.5-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.5-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-Setup-0.47.0-rev.5.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.47.0-rev.5.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.AppImage)

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
- **中枢网页信息架构：** 将旧导航重构为总览、用量、设备、限额、趋势、账号、管理和设置页面，同时保留旧 URL。
- **用量明细：** 新增工具、模型、项目、会话标签页，支持输入、输出、缓存、未缓存 Token、成本和可展开明细。
- **无界面 Agent 发布包：** 新增适用于无 Electron 设备的独立采集 Agent 发布压缩包。
### 改进
- **趋势与设备信息：** 新增 7/30/90/365/全部趋势范围、活跃摘要、设备运行时/状态详情和自定义范围说明。
- **共享同步运行时：** Electron 与无界面 Agent 统一上传调度、重试退避、设备身份和摘要/归档处理。
### 修复
- **网页兼容性：** 旧工具、模型、项目、会话、设备、状态、订阅和定价路由会映射到新页面，并保留对应标签。
- **配置边界：** 网页设置只暴露网页安全配置，并明确标注桌面端专属控制项。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.5-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.5-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-Setup-0.47.0-rev.5.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.47.0-rev.5.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.47.0-rev.4...v0.47.0-rev.5">v0.47.0-rev.4...v0.47.0-rev.5</a></summary>

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
- **中樞網頁資訊架構：** 將舊導覽重構為總覽、用量、裝置、限額、趨勢、帳號、管理和設定頁面，同時保留舊 URL。
- **用量明細：** 新增工具、模型、專案、工作階段分頁，支援輸入、輸出、快取、未快取 Token、成本和可展開明細。
- **無介面 Agent 發布包：** 新增適用於無 Electron 裝置的獨立採集 Agent 發布壓縮包。
### 改進
- **趨勢與裝置資訊：** 新增 7/30/90/365/全部趨勢範圍、活躍摘要、裝置執行時/狀態詳情和自訂範圍說明。
- **共享同步執行時：** Electron 與無介面 Agent 統一上傳排程、重試退避、裝置身分和摘要/歸檔處理。
### 修正
- **網頁相容性：** 舊工具、模型、專案、工作階段、裝置、狀態、訂閱和定價路由會映射到新頁面，並保留對應分頁。
- **設定邊界：** 網頁設定只暴露網頁安全設定，並明確標註桌面端專屬控制項。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.5-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.5-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-Setup-0.47.0-rev.5.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.47.0-rev.5.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가
- **Hub Web 정보 구조:** 기존 탐색을 Overview, Usage, Devices, Limits, Trends, Accounts, Management, Settings 페이지로 재구성하고 기존 URL을 유지합니다.
- **Usage 세부 정보:** 도구, 모델, 프로젝트, 세션 탭에서 입력, 출력, 캐시, 미캐시 토큰, 비용 및 펼칠 수 있는 세부 정보를 제공합니다.
- **Headless Agent 패키지:** Electron 위젯 없이 수집하는 장치를 위한 독립 릴리스 아카이브를 추가했습니다.
### 개선
- **추세 및 장치 정보:** 7/30/90/365/전체 기간, 활동 요약, 장치 런타임/상태 정보와 사용자 지정 기간 안내를 추가했습니다.
- **공유 동기화 런타임:** Electron과 Headless Agent가 업로드 일정, 재시도, 장치 ID와 아카이브 처리를 공유합니다.
### 수정
- **웹 호환성:** 기존 도구, 모델, 프로젝트, 세션, 장치, 상태, 구독 및 요금 URL이 새 페이지와 탭으로 연결됩니다.
- **설정 경계:** 웹 설정에는 웹에서 안전한 항목만 표시하고 데스크톱 전용 제어를 명확히 구분합니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.5-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.5-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-Setup-0.47.0-rev.5.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.47.0-rev.5.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **Hub Web 情報アーキテクチャ:** 旧ナビゲーションを Overview、Usage、Devices、Limits、Trends、Accounts、Management、Settings に再構成し、旧 URL も維持しました。
- **Usage 詳細:** ツール、モデル、プロジェクト、セッションのタブで、入力、出力、キャッシュ、未キャッシュ Token、コスト、展開可能な詳細を確認できます。
- **Headless Agent パッケージ:** Electron ウィジェットなしで収集する端末向けの独立リリースアーカイブを追加しました。
### 改善
- **トレンドとデバイス情報:** 7/30/90/365/全期間の範囲、アクティビティ概要、デバイスのランタイム/状態詳細、カスタム範囲の案内を追加しました。
- **共有同期ランタイム:** Electron と Headless Agent でアップロードスケジュール、再試行、デバイス ID、アーカイブ処理を統一しました。
### 修正
- **Web 互換性:** 旧ツール、モデル、プロジェクト、セッション、デバイス、ステータス、サブスクリプション、料金 URL を新しいページとタブへ接続しました。
- **設定境界:** Web 設定には Web で安全な項目だけを表示し、デスクトップ専用の操作を明確に区別します。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.5-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.5-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-Setup-0.47.0-rev.5.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.47.0-rev.5.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.47.0-rev.5.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.5/Token-Monitor-0.47.0-rev.5.AppImage)

</details>

</details>
