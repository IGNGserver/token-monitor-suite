# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Yesterday and Week scope tabs:** The scope bar now reads Day / Yesterday / Week / Month / Total. Both presets resolve through the same range API a hand-picked range uses, so the tool, model, project and session breakdowns stay available. "Week" starts on Monday, or on your locale's own first day where the browser publishes one.

### Fixed
- **No stray scrollbar in the tab strips:** The Usage and Management sub-navigation reserved a vertical scrollbar — and the 15px of width next to it — inside the tab bar at every screen size. A strip now scrolls only when its tabs genuinely do not fit.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-Setup-0.47.0-rev.10.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.47.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.AppImage)

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
- **范围选项卡新增「昨天」和「本周」：** 范围条现在是 今日 / 昨天 / 本周 / 本月 / 累计。两个预设走的是与自定义区间同一个范围接口，因此工具、模型、项目、会话明细都照常可用；「本周」以周一为起点，浏览器提供地区惯例时按其惯例。

### 修复
- **选项卡横条里多余的滚动条：** 用量与管理的子导航此前在任何屏幕宽度下都会在标签条内预留一条纵向滚动条，并连带占掉旁边的 15px 宽度。现在只有标签确实放不下时才会横向滚动。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-Setup-0.47.0-rev.10.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.47.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.47.0-rev.9...v0.47.0-rev.10">v0.47.0-rev.9...v0.47.0-rev.10</a></summary>

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
- **範圍選項新增「昨日」與「本週」：** 範圍列現在是 今日 / 昨日 / 本週 / 本月 / 累計。兩個預設走的是與自訂範圍相同的範圍介面，因此工具、模型、專案與工作階段明細照常可用；「本週」以週一起算，瀏覽器提供地區慣例時依其慣例。

### 修復
- **選項橫條中多餘的捲軸：** 用量與管理的子導覽過去在任何螢幕寬度下都會在標籤條內預留一條縱向捲軸，並連帶佔用旁邊的 15px 寬度。現在只有標籤真的放不下時才會橫向捲動。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-Setup-0.47.0-rev.10.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.47.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가
- **범위 탭에 '어제'와 '이번 주' 추가:** 이제 오늘 / 어제 / 이번 주 / 이번 달 / 전체 순으로 표시됩니다. 두 프리셋은 직접 지정한 범위와 같은 범위 API를 사용하므로 도구·모델·프로젝트·세션 상세가 그대로 제공됩니다. '이번 주'는 월요일부터 시작하며, 브라우저가 지역 관례를 제공하면 그 관례를 따릅니다.

### 수정
- **탭 스트립에 남아 있던 스크롤바:** 사용량과 관리의 하위 내비게이션이 모든 화면 너비에서 탭 바 안에 세로 스크롤바와 그 옆 15px 폭을 계속 예약했습니다. 이제 탭이 실제로 넘어갈 때만 가로로 스크롤됩니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-Setup-0.47.0-rev.10.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.47.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **範囲タブに「昨日」と「今週」を追加:** 範囲バーは 今日 / 昨日 / 今週 / 今月 / 累計 の順になりました。両方のプリセットは手動指定の範囲と同じ範囲 API を通るため、ツール・モデル・プロジェクト・セッションの詳細もそのまま利用できます。「今週」は月曜開始で、ブラウザが地域の慣習を提供する場合はそれに従います。

### 修正
- **タブストリップに出る余分なスクロールバー:** 使用量と管理のサブナビゲーションが、あらゆる画面幅でタブバー内に縦スクロールバーとその隣の 15px 幅を予約していました。タブが実際に収まらない場合のみ横スクロールするようになります。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-Setup-0.47.0-rev.10.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.47.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.47.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.10/Token-Monitor-0.47.0-rev.10.AppImage)

</details>

</details>
