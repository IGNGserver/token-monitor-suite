# English

## What's changed

<!-- app-update-notes:en:start -->
### Changed
- **Sync modes:** Reduced the Electron widget to local-only and Connect to Hub; legacy Host settings migrate to local and obsolete embedded Hub credentials are removed safely.
- **Hub deployment:** Docker Compose is now the only supported Hub deployment; standalone Hub, embedded Hub, and Cloudflare Worker distribution paths were removed.
- **Upstream protection:** Added a product-scope contract and CI/release guard so removed modes and deployment paths cannot silently return.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.23-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.23-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-Setup-0.45.0-rev.23.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.45.0-rev.23.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.AppImage)

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
- **同步模式：** Electron 小部件收缩为仅限本机和连接中枢两种模式；旧 Host 配置会迁移为本机模式，废弃的内嵌中枢凭证会安全清理。
- **中枢部署：** Docker Compose 成为唯一支持的中枢部署方式；已移除独立中枢、内嵌中枢和 Cloudflare Worker 发布路径。
- **上游同步防护：** 新增产品范围契约以及 CI/发布检查，防止已移除的模式和部署路径被上游同步悄悄带回。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.23-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.23-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-Setup-0.45.0-rev.23.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.45.0-rev.23.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.45.0-rev.22...v0.45.0-rev.23">v0.45.0-rev.22...v0.45.0-rev.23</a></summary>

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
- **同步模式：** Electron 小工具收斂為僅限本機與連接中樞兩種模式；舊 Host 設定會遷移為本機模式，廢棄的內嵌中樞憑證會安全清理。
- **中樞部署：** Docker Compose 成為唯一支援的中樞部署方式；已移除獨立中樞、內嵌中樞與 Cloudflare Worker 發布路徑。
- **上游同步防護：** 新增產品範圍契約以及 CI/發布檢查，防止已移除的模式與部署路徑被上游同步悄悄帶回。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.23-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.23-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-Setup-0.45.0-rev.23.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.45.0-rev.23.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 변경
- **동기화 모드:** Electron 위젯을 로컬 전용과 허브 연결의 두 모드로 축소했습니다. 기존 Host 설정은 로컬 모드로 마이그레이션되며, 사용하지 않는 임베디드 허브 자격 증명은 안전하게 정리됩니다.
- **허브 배포:** Docker Compose만 지원되는 허브 배포 방식으로 남겼습니다. 독립 허브, 임베디드 허브 및 Cloudflare Worker 배포 경로를 제거했습니다.
- **업스트림 보호:** 제거된 모드와 배포 경로가 업스트림 동기화로 다시 들어오지 않도록 제품 범위 계약과 CI/릴리스 검사를 추가했습니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.23-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.23-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-Setup-0.45.0-rev.23.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.45.0-rev.23.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 変更
- **同期モード:** Electron ウィジェットをローカルのみとハブ接続の2モードに縮小しました。旧 Host 設定はローカルモードへ移行され、不要な組み込みハブ資格情報は安全に削除されます。
- **ハブのデプロイ:** サポートするハブのデプロイ方式を Docker Compose のみにしました。単独ハブ、組み込みハブ、Cloudflare Worker の配布経路を削除しました。
- **アップストリーム保護:** 削除したモードとデプロイ経路がアップストリーム同期で戻らないよう、製品範囲契約と CI/リリース検査を追加しました。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.23-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.23-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-Setup-0.45.0-rev.23.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.45.0-rev.23.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.45.0-rev.23.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.23/Token-Monitor-0.45.0-rev.23.AppImage)

</details>

</details>
