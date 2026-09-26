# English

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Qoder tracked alongside Qoder CN:** The international edition is now collected as its own client, so a machine running both installers reports them separately, each with its own profile root, watch paths and source diagnostics. Both stay opt-in under Settings → Collection → Tracked tools.
- **Qoder credits:** Qoder bills in credits rather than tokens, and its transcripts carry an exact per-request credit amount. Credits are now reported and shown per tool beside the token and cost figures, which remain estimates and are now marked with `~` so the difference is visible rather than implied.

### Fixed
- **Qoder token totals grew with session length:** Every request was billed for the whole conversation preceding it, so a long session's total rose roughly with the square of its request count. One real machine reported 2.97 billion tokens for a day of 8,593 requests whose conversation held about 5.6 million tokens of content. Each message is now counted once per session.
- **The Qoder evidence probe could read the developer's own profile:** It merged a fixture environment over the ambient one, so a "no data on this machine" check still reported PASS against a real install.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.11-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.11-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-Setup-0.47.0-rev.11.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.47.0-rev.11.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.AppImage)

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
- **国际版 Qoder 纳入跟踪，与中国版并列：** 国际版现在作为独立客户端采集，因此同时安装两者的机器会将二者分开上报，各自拥有独立的配置目录、监听路径与来源诊断。两者仍需在 设置 → 采集 → 跟踪的工具 中启用（默认关闭）。
- **Qoder Credits：** Qoder 按 Credits 而不是 Token 计费，其 transcript 中每个请求都带有精确的 Credits 数量。现在会按工具上报并展示 Credits，与仍属估算的 Token、成本并列展示，并用 `~` 标注，让这一区别直接可见而不需读者推断。

### 修复
- **Qoder 的 Token 总量随会话长度增长：** 此前每个请求都按其之前的整段对话计费，因此长会话的总量约随请求数的平方增长。在一台真实机器上，一天 8593 个请求报告了 29.7 亿 Token，而对话实际内容约 560 万。现在每条消息在一个 session 内只计一次。
- **Qoder 取证探针会读到开发者自己的 profile：** 该诊断探针把测试用环境叠加到进程环境之上，导致「本机无数据」的检查仍可能对真实安装报出 PASS。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.11-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.11-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-Setup-0.47.0-rev.11.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.47.0-rev.11.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.AppImage)

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
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.47.0-rev.9...v0.47.0-rev.11">v0.47.0-rev.9...v0.47.0-rev.11</a></summary>

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
- **國際版 Qoder 納入追蹤，與中國版並列：** 國際版現在作為獨立客戶端蒐集，因此同時安裝兩者的機器會將二者分開上報，各自擁有獨立的設定目錄、監看路徑與來源診斷。兩者仍需在 設定 → 收集 → 追蹤的工具 中啟用（預設關閉）。
- **Qoder Credits：** Qoder 按 Credits 而不是 Token 計費，其 transcript 中每個請求都帶有精確的 Credits 數量。現在會按工具上報並顯示 Credits，與仍屬估算的 Token、成本並列，並以 `~` 標註，讓這個區別直接可見而不需讀者推斷。

### 修复
- **Qoder 的 Token 總量隨會話長度增長：** 先前每個請求都按其之前的整段對話計費，因此長會話的總量約隨請求數的平方增長。在一台真實機器上，一天 8593 個請求回報了 29.7 億 Token，而對話實際內容約 560 萬。現在每則訊息在一個 session 內只計一次。
- **Qoder 取證探針會讀到開發者自己的 profile：** 該診斷探針把測試用環境疊加到行程環境之上，導致「本機無資料」的檢查仍可能對真實安裝回報 PASS。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.11-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.11-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-Setup-0.47.0-rev.11.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.47.0-rev.11.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 추가됨
- **Qoder 국제판 추적, Qoder CN과 분리:** 국제판이 독립 클라이언트로 수집되어, 두 설치본을 모두 사용하는 기기는 각각 따로 보고됩니다. 프로필 루트, 감시 경로, 출처 진단도 각각 독립입니다. 둘 다 설정 → 수집 → 추적 도구에서 활성화합니다(기본 꺼짐).
- **Qoder 크레딧:** Qoder는 토큰이 아니라 크레딧으로 과금하며, transcript의 각 요청에는 정확한 크레딧 값이 들어 있습니다. 이제 도구를 기준으로 크레딧을 보고하고 표시하며, 계속 추정치인 토큰·비용 옆에 `~` 표기를 붙여 그 차이를 눈으로 확인할 수 있습니다.

### 수정됨
- **Qoder 토큰 합계가 세션 길이에 따라 커지던 문제:** 모든 요청이 그 앞의 대화 전체에 대해 과금되어, 긴 세션의 합계가 요청 수의 제곱에 가까웠습니다. 실제 기기에서 하루 8,593개 요청이 29.7억 토큰으로 보고됐지만 실제 대화 내용은 약 560만 토큰이었습니다. 이제 한 메시지는 세션당 정확히 한 번만 계산됩니다.
- **Qoder 증거 프로브가 개발자 자신의 profile을 읽을 수 있던 문제:** 진단 프로브가 픽처 환경을 실제 환경 위에 덮어써 합쳤기 때문에,「이 기기에는 데이터 없음」검사가 실제 설치본에 대해 PASS를 보고할 수 있었습니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.11-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.11-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-Setup-0.47.0-rev.11.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.47.0-rev.11.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 追加
- **Qoder 国際版を Qoder CN と並べて追跡：** 国際版を独立したクライアントとして収集するようにしました。両方のインストーラーが入っているマシンでは別々に報告され、プロファイルルート・監視パス・ソース診断も各自のものです。どちらも 設定 → 収集 → 追跡するツール で有効化するオプトイン（デフォルト無効）です。
- **Qoder のクレジット：** Qoder はトークンではなくクレジットで課金され、transcript の各リクエストに正確なクレジット値が含まれています。ツール単位で報告・表示するようになり、推定のままのトークンとコストの旁边に `~` を付けたので、その違いを読者が推測せずに済みます。

### 修正
- **Qoder のトークン合計がセッション長に応じて膨らむ問題：** 各リクエストがそれ以前の会話全体に対して課金されていたため、長いセッションでは合計がリクエスト数の二乗に近づいていました。実機あるマシンでは 1 日 8,593 リクエストが 29.7 億トークンと報告されていましたが、会話の実内容は約 560 万トークンです。これからは 1 つのメッセージはセッションにつき 1 度だけ計上されます。
- **Qoder 検証プローブが開発者自身の profile を読み得た問題：** 診断プローブがフィクスチャ環境を既存環境に上書き合成していたため、「このマシンにデータなし」の確認が実際のインストールに対して PASS を返すことがありました。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.47.0-rev.11-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.47.0-rev.11-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-Setup-0.47.0-rev.11.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.47.0-rev.11.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.47.0-rev.11.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.47.0-rev.11/Token-Monitor-0.47.0-rev.11.AppImage)

</details>

</details>
