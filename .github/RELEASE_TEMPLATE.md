# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Fluent 2 Scrollbars:** Added standard thin scrollbar styling and rounded overlay pill design across all scrollable containers in the shared UI and desktop shell.

### Fixed
- **Preserve expanded details and scroll on refresh:** Auto-refresh now maintains `<details>` expansion state (usage breakdowns, device details, action menus) and desktop scroll position without collapsing lists or bouncing the view.
- **Desktop local-mode management error fallback:** Replaced the unconfigured Hub error cards in Accounts and Management panels with a clean empty state and quick settings link.
- **Button and tab click focus shadow:** Removed the harsh browser 4px box-shadow glow on click, retaining subtle Fluent 2 focus-visible outlines for keyboard navigation.
- **Switch component deformation:** Fixed deformed circular switches by enforcing standard 40x20px pill dimensions and preventing vertical stretch.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.17-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.17-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-Setup-0.47.0-rev.17.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.47.0-rev.17.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.AppImage)

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
- **全站 Fluent 2 滚动条规范：** 网页端与桌面端统一引入细长胶囊圆角滚动条，适配深浅色主题，替换浏览器原生粗灰方块滑块。

### 修复
- **刷新时展开列表收回与页面跳动：** 自动刷新时完整保留表格详情、设备状态等折叠面板的展开状态与桌面端滚动容器位置。
- **本地模式下管理分组报错：** 桌面端处于本地运行时，账号与管理面板优雅降级显示引导提示，不再报错“仪表板加载失败”。
- **按钮与选项卡点击阴影：** 消除鼠标点击时出现的浏览器高对比度扩散外阴影，对齐 Fluent 2 自然的按压过渡效果。
- **开关（Switch）形态畸变：** 修复因最小点击尺寸冲突导致的开关异形拉长，恢复规范的 40x20px 胶囊比例。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.17-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.17-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-Setup-0.47.0-rev.17.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.47.0-rev.17.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.47.0-rev.9...v0.47.0-rev.17">v0.47.0-rev.9...v0.47.0-rev.17</a></summary>

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
- **全站 Fluent 2 捲軸規範：** 網頁端與桌面端統一引入細長膠囊圓角捲軸，適配深淺色主題，替換瀏覽器原生粗灰方塊滑塊。

### 修復
- **重新整理時展開清單收回與畫面跳動：** 自動重新整理時完整保留表格詳情、設備狀態等摺疊面板的展開狀態與桌面端捲動位置。
- **本機模式下管理分組報錯：** 桌面端處於本機執行時，帳號與管理面板優雅降級顯示引導提示，不再報錯「儀表板載入失敗」。
- **按鈕與選項卡點擊陰影：** 消除滑鼠點擊時出現的瀏覽器高對比度擴散外陰影，對齊 Fluent 2 自然的按壓過渡效果。
- **開關（Switch）形態畸變：** 修復因最小點擊尺寸衝突導致的開關異形拉長，恢復規範的 40x20px 膠囊比例。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.17-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.17-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-Setup-0.47.0-rev.17.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.47.0-rev.17.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가됨
- **Fluent 2 스크롤바 표준 적용:** 웹 및 데스크톱 환경 전체에 Fluent 2 표준의 얇은 캡슐형 오버레이 스크롤바를 도입했습니다.

### 수정됨
- **새로고침 시 펼쳐진 목록 접힘 및 스크롤 튐 수정:** 자동 새로고침 시 `<details>` 요소의 펼침 상태와 데스크톱 스크롤 위치를 유지합니다.
- **로컬 모드 관리 패널 오류 수정:** 데스크톱 로컬 모드에서 계정 및 관리 화면 접근 시 대시보드 로드 오류 대신 안내 화면이 표시됩니다.
- **버튼 및 탭 클릭 그림자 제거:** 클릭 시 발생하던 브라우저의 4px 외곽선 그림자를 제거하고 자연스러운 피드백을 적용했습니다.
- **스위치 컨트롤 왜곡 수정:** 스위치 크기 충돌로 인해 세로로 늘어나던 문제를 해결하고 40x20px 표준 비율을 복원했습니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.17-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.17-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-Setup-0.47.0-rev.17.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.47.0-rev.17.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **Fluent 2 スクロールバーの標準化:** Web およびデスクトップ全体で Fluent 2 仕様のピル型オーバーレイスクロールバーを導入しました。

### 修正
- **更新時の展開リストの閉じとスクロール跳びの防止:** 自動更新時に `<details>` の展開状態とスクロール位置を完全に維持するようにしました。
- **ローカルモード時の管理パネルエラー改善:** Hub 未接続時にエラーカードではなく、適切な空状態と設定リンクを表示するようにしました。
- **ボタンやタブクリック時の選択影の除去:** クリック時に表示されていたブラウザの 4px 拡散枠を抑制し、Fluent 2 の自然なインタラクションに合わせました。
- **スイッチコントロールの歪み修正:** 最小サイズ競合による縦長円形の歪みを解消し、40x20px の標準カプセル比率に修正しました。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.17-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.17-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-Setup-0.47.0-rev.17.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.47.0-rev.17.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.47.0-rev.17.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.17/Token-Monitor-0.47.0-rev.17.AppImage)

</details>

</details>
