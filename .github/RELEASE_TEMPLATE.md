# English

## What's changed

<!-- app-update-notes:en:start -->
### Changed
- **Desktop shell:** The Electron widget and dashboard are restored to the `0.37.23-rev.3` desktop tree. Hub, agent, Worker, and shared collection stay on the 0.45 line.
- **Windows 10 glass:** Native backdrop still requires Windows 11 22H2 or newer. Older Windows keeps the CSS-blur window instead of an opaque white slab.
- **Hub-managed accounts:** Device-side automatic account discovery and reporting are removed. Add accounts manually in the hub; credentials stay in the hub and existing local credentials must be added again after upgrading.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.22-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.22-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-Setup-0.45.0-rev.22.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.45.0-rev.22.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.AppImage)

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
### 变更
- **桌面端：** Electron 小部件和仪表盘已完整回退到 `0.37.23-rev.3` 桌面树。中枢、采集端、Worker 和共享采集仍走 0.45。
- **Windows 10 玻璃：** 原生材质仍需要 Windows 11 22H2 或更新。更旧的 Windows 继续使用 CSS blur，而不是不透明白板。
- **中枢账号：** 设备端不再自动探测或上报本地开发软件账号。账号必须手动添加到中枢，凭证由中枢保存并统一获取额度；升级后原本机凭证失效，需要重新登录添加。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.22-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.22-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-Setup-0.45.0-rev.22.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.45.0-rev.22.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.45.0-rev.21...v0.45.0-rev.22">v0.45.0-rev.21...v0.45.0-rev.22</a></summary>

<!-- github-generated-release-notes -->

</details>

<details>
<summary>繁體中文 · 한국어 · 日本語</summary>

<details>
<summary><strong>繁體中文</strong></summary>

## 繁體中文

## 更新內容

<!-- app-update-notes:zh-TW:start -->
### 變更
- **桌面端：** Electron 小工具與儀表板已完整回退到 `0.37.23-rev.3` 桌面樹。中樞、採集端、Worker 與共享採集仍走 0.45。
- **Windows 10 玻璃：** 原生材質仍需要 Windows 11 22H2 或更新。更舊的 Windows 繼續使用 CSS blur，而不是不透明白板。
- **中樞帳號：** 裝置端不再自動探測或上報本機開發軟體帳號。帳號必須手動加入中樞，由中樞保存憑證並統一取得額度；升級後原本機憑證失效，需要重新登入加入。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.22-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.22-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-Setup-0.45.0-rev.22.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.45.0-rev.22.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 변경
- **데스크톱:** Electron 위젯과 대시보드를 `0.37.23-rev.3` 데스크톱 트리로 되돌렸습니다. 허브, 에이전트, Worker, 공유 수집은 0.45를 유지합니다.
- **Windows 10 유리 효과:** 네이티브 배경은 여전히 Windows 11 22H2 이상이 필요합니다. 더 오래된 Windows는 불투명한 흰 창 대신 CSS blur를 사용합니다.
- **허브 계정:** 장치가 로컬 개발 도구 계정을 자동 검색하거나 보고하지 않습니다. 허브에서 계정을 수동으로 추가해야 하며, 자격 증명은 허브에 저장됩니다. 업그레이드 후 기존 로컬 자격 증명은 무효화되므로 다시 로그인해야 합니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.22-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.22-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-Setup-0.45.0-rev.22.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.45.0-rev.22.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 変更
- **デスクトップ:** Electron ウィジェットとダッシュボードを `0.37.23-rev.3` のデスクトップツリーに戻しました。ハブ、エージェント、Worker、共有収集は 0.45 のままです。
- **Windows 10 のガラス:** ネイティブ背景は引き続き Windows 11 22H2 以降が必要です。それより前の Windows では不透明な白い窓ではなく CSS blur を使います。
- **ハブアカウント:** デバイスはローカル開発ツールのアカウントを自動検出・報告しません。ハブで手動追加し、資格情報はハブに保存します。アップグレード後は既存のローカル資格情報が無効になるため、再ログインが必要です。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.22-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.22-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-Setup-0.45.0-rev.22.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.45.0-rev.22.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.45.0-rev.22.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.22/Token-Monitor-0.45.0-rev.22.AppImage)

</details>

</details>
