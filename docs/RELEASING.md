# 发布说明

`.github/workflows/release.yml` 使用 `v<版本号>` tag 构建并创建 GitHub Release。项目版本格式为：

```text
<上游 SemVer>-rev.<本项目修订号>
```

例如 `0.37.23-rev.1` 表示功能与上游 `0.37.23` 对齐，是本项目针对该上游版本的第一个修订版。上游版本不变时递增 `rev.N`；上游版本变化时重新从 `rev.1` 开始。版本号必须通过 `npm run verify:release-version` 校验。

发布类型和版本字符串是两个独立概念：版本号始终保留 `-rev.N`，GitHub Release 是否标记为 prerelease 由发布流程决定。普通的“发布 release”按 prerelease 处理；只有明确要求“发布正式版 release”时，才选择正式版。

## 首次配置 Android 签名

Android 正式包必须使用长期保存的签名密钥。不要把 keystore 文件或密码提交到仓库。

在安全环境生成 keystore 后，将 keystore 转成 base64，并在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置以下 Repository secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

签名密钥一旦用于公开发布，就必须永久保留。后续版本必须使用同一密钥，否则 Android 无法覆盖更新旧版本。

## 发布新版本

1. 在根项目和锁文件中同步版本号，例如 `0.37.23-rev.1`，然后运行：

   ```bash
   npm run verify:release-version
   ```

2. 提交并推送代码。
3. 创建并推送同名版本 tag。tag 不包含 `fork`，例如：

   ```bash
   git tag v0.37.23-rev.1
   git push origin v0.37.23-rev.1
   ```

   推送 tag 会自动创建 prerelease。
4. 如果要创建正式版，进入 GitHub Actions 手动运行 `Release`，填写同一个版本号，并将 `release_type` 选择为 `release`。只有这个明确操作会创建正式版 Release。
5. GitHub Actions 会构建 Windows 安装包、Linux AppImage、Debian `.deb` 包、Android release APK 和 Hub 镜像。Release 资产文件名中的 `<version>` 会保留完整版本号，例如：

   - `Token-Monitor-Setup-0.37.23-rev.1.exe`
   - `Token-Monitor-0.37.23-rev.1.AppImage`
   - `Token-Monitor-0.37.23-rev.1.deb`
   - `Token-Monitor-Android-0.37.23-rev.1.apk`

Android 的 `versionName` 与桌面版本一致，`versionCode` 会同时编码上游三段版本和 `rev.N`，因此同一上游版本的 Android 更新也能保持递增。

已安装的 Debian 版本通过应用内更新使用系统 `dpkg`/`apt` 完成升级，首次安装新版本时会按系统策略请求管理员权限；也可以手动执行 `sudo apt install ./Token-Monitor-<version>.deb`。

## Windows 签名

当前 Windows 安装包可以正常构建。未配置 `SIGNPATH_API_TOKEN` 时，Release workflow 会自动跳过 SignPath，发布**未签名**的 Windows 包（用户首次运行可能看到 SmartScreen 警告）。配置 SignPath 的 `SIGNPATH_API_TOKEN` secret 后，同一 workflow 会走 SignPath 双阶段签名（应用本体 + 安装包/便携版）。

## Hub Docker 镜像（GHCR）

推送 `v*` tag 后，Release workflow 会额外：

1. 多架构构建并推送 `ghcr.io/<owner>/token-monitor-hub`（`linux/amd64` + `linux/arm64`）。
2. 始终打标签：`<version>`、`v<version>`；只有正式版 Release 额外更新 `latest`。
3. 打包 `Token-Monitor-Hub-Compose-<version>.zip`（最小 compose 部署包）并挂到 Release Assets。

镜像名固定为 **`token-monitor-hub`**。Compose 通过环境变量 `TOKEN_MONITOR_VERSION` 选择标签，默认 `latest`。

首次在组织/账号下推送 GHCR 包后，如需匿名拉取，请到 GitHub → Packages → `token-monitor-hub` → Package settings 将可见性设为 **Public**。

本地验证 compose 包（不推镜像）：

```bash
node scripts/package-hub-compose.js 0.37.23-rev.1
```

本地从源码构建（不经过 GHCR）：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build hub
```
