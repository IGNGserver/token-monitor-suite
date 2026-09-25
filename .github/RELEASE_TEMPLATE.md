# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Pause collection:** Turned off from Settings or the tray, shown clearly in the sidebar, summary card and status menu, and resumed with one click.
- **Close-to-tray and silent launch at login:** Closing the window now keeps the app running in the tray, and login launch starts hidden. Each is its own setting.
- **Diagnostics bundle:** Settings can save a redacted diagnostic file for support reports; credentials and Hub secrets are never included.

### Changed
- **Update channel follows what you installed:** A formal release only receives the next formal release; a prerelease receives the newest publish.
- **Tray menu:** Adds the pause switch, direct jumps to Overview / Limits / Settings, and a tooltip with live totals.
- **The service-status panel is retired:** It had no poller and no view, so its three settings and status controls are gone.

### Improved
- **Menus and tray are localized:** The native menu bar and tray use the window's language catalog and rebuild when you change it.
- **Appearance switches take effect:** Tool icons, the live indicator, the compact token total, the Windows title strip, quota source, used-vs-remaining bars and masked account e-mails now do what their labels say.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.9-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.9-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-Setup-0.47.0-rev.9.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.47.0-rev.9.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.AppImage)

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
- **暂停采集：** 可在设置或托盘中关闭；侧边栏、概览与状态菜单都会明确显示当前处于暂停状态，一键即可恢复。
- **关窗驻留托盘与开机静默启动：** 关闭窗口后应用在托盘继续运行，开机自启时默认不弹出窗口。两项均有独立开关。
- **诊断包：** 设置中可导出已脱敏的诊断文件用于反馈问题，其中不包含任何凭据或中枢密钥。

### 变更
- **更新通道跟随已安装版本：** 正式版只接收下一个正式版，内测版接收最新发布。
- **托盘菜单：** 新增暂停开关、概览/额度/设置的直达入口，并在提示气泡中显示实时用量。
- **下线服务状态面板：** 该面板既无轮询也无视图，其三项设置与状态控件一并移除。

### 改进
- **菜单与托盘跟随语言：** 原生菜单栏和托盘与窗口使用同一份语言文案，切换语言后立即重建。
- **外观开关真正生效：** 工具图标、实时指示、紧凑 Token 总数、Windows 标题栏、额度来源、已用/剩余比例条与账号邮箱掩码，现在都与标签描述一致。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.9-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.9-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-Setup-0.47.0-rev.9.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.47.0-rev.9.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.47.0-rev.8...v0.47.0-rev.9">v0.47.0-rev.8...v0.47.0-rev.9</a></summary>

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
- **暫停採集：** 可在設定或系統匣中關閉；側欄、概覽與狀態選單都會明確顯示暫停狀態，一鍵即可恢復。
- **關窗常駐系統匣與開機靜默啟動：** 關閉視窗後應用程式在系統匣繼續執行，登入自啟時預設不彈出視窗。兩項均有獨立開關。
- **診斷包：** 設定中可匯出已脫敏的診斷檔用於回報問題，內容不含任何憑據或 Hub 金鑰。

### 變更
- **更新通道跟隨已安裝版本：** 正式版只接收下一個正式版，測試版接收最新發佈。
- **系統匣選單：** 新增暫停開關、概覽/額度/設定的直達入口，並在提示氣泡中顯示即時用量。
- **下架服務狀態面板：** 該面板既無輪詢也無視圖，其三項設定與狀態控制項一併移除。

### 改進
- **選單與系統匣跟隨語言：** 原生選單列和系統匣與視窗使用同一份語言文案，切換語言後立即重建。
- **外觀開關真正生效：** 工具圖示、即時指示、精簡 Token 總數、Windows 標題列、額度來源、已用/剩餘比例條與帳號信箱遮罩，現在都與標籤描述一致。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.9-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.9-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-Setup-0.47.0-rev.9.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.47.0-rev.9.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가
- **수집 일시 중지:** 설정과 트레이에서 끄고 켤 수 있습니다. 사이드바·요약·상태 메뉴에 중지 상태가 명확히 표시되며 한 번의 클릭으로 재개합니다.
- **창을 닫아도 트레이 상주, 로그인 시 조용히 시작:** 창을 닫으면 트레이에서 계속 실행되고, 자동 시작 시 창을 띄우지 않습니다. 각각 설정할 수 있습니다.
- **진단 묶음:** 설정에서 마스킹된 진단 파일을 저장해 문제 신고에 활용할 수 있습니다. 자격 증명과 Hub 비밀 값은 포함되지 않습니다.

### 변경
- **갱신 채널이 설치본을 따릅니다:** 정식 릴리스는 다음 정식 릴리스만 받고, 프리릴리스는 가장 최근 게시물을 받습니다.
- **트레이 메뉴:** 일시 중지 전환, 개요·한도·설정 바로가기, 실시간 합계를 표시하는 툴팁이 추가되었습니다.
- **서비스 상태 패널 제거:** 폴러와 뷰가 없던 기능이라 관련 설정 3가지와 컨트롤이 함께 제거되었습니다.

### 개선
- **메뉴와 트레이도 다국어:** 네이티브 메뉴 바와 트레이가 창과 같은 언어 사전을 쓰며, 언어를 바꾸면 즉시 다시 구성됩니다.
- **외형 토글이 실제로 동작:** 도구 아이콘, 실시간 표시, 간결한 토큰 합계, Windows 타이틀 스트립, 한도 출처, 사용량/잔여 막대, 계정 이메일 마스킹이 라벨대로 동작합니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.9-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.9-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-Setup-0.47.0-rev.9.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.47.0-rev.9.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **収集の一時停止：** 設定とトレイから ON/OFF できます。サイドバー・サマリーカード・ステータスメニューに停止中であることが明確に表示され、ワンクリックで再開できます。
- **ウィンドウを閉じてもトレイに常駐、ログイン時は静音起動：** 既定では閉じてもアプリは終了せず、自動起動時にウィンドウを表示しません。それぞれ設定できます。
- **診断バンドル：** サポート報告用の、機微情報をマスキングした診断ファイルを保存できます。認証情報と Hub シークレットは含まれません。

### 変更
- **更新チャネルはインストール済み版に従う：** 正式版は次の正式版のみ受け取り、プレリリース版は最新の公開を受け取ります。
- **トレイメニュー：** 一時停止の切り替え、概要/制限/設定へのショートカット、合計値を表示するツールチップを追加しました。
- **サービス状況パネルを廃止：** ポーラーもビューもないため、関連する 3 つの設定とコントロールも削除しました。

### 改善
- **メニューとトレイも多言語対応：** ネイティブメニューバーとトレイがウィンドウと同じ言語カタログを使用し、言語変更後に再構築されます。
- **外観トグルが実際に動作：** ツールアイコン、ライブ表示、簡潔なトークン合計、Windows タイトルストリップ、制限の供給元、使用/残りバー、アカウントメールのマスクがラベルどおりになります。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.9-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.9-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-Setup-0.47.0-rev.9.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.47.0-rev.9.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.47.0-rev.9.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.9/Token-Monitor-0.47.0-rev.9.AppImage)

</details>

</details>
