# Token Monitor {{tag}}

## 本次更新

<!-- app-update-notes:zh:start -->
### 采集与工具覆盖
- **全部工具恒定采集：** 桌面端与 headless agent 现在始终采集全部已接线工具；之前需要手动勾选的 MiMo Code、Qoder、Qoder CN 也会自动采集。工具选择配置（`TOKEN_MONITOR_CLIENTS`、agent 的 `--clients`）已移除，旧配置会被忽略。
- **MiMo Code 说明：** MiMo Code 的数据库会导入 Claude Code 会话，tokscale 暂不做去重，因此 Claude 总量可能重复计算；README 已如实标注这一限制。
- **WSL 去重方式调整：** 无法再通过缩小工具范围来区分 Windows 内建 WSL 扫描与 WSL agent，改为按机器二选一：由 agent 负责 WSL 用量时，在桌面端设置 `TOKEN_MONITOR_WSL_SCAN=0`。

### 设置与数据
- **遗留配置清理：** 移除已无界面的工具选择、隐藏/置顶/排序偏好、客户端用量归档与设备端目录通道；旧 `settings.json` 中对应的遗留键会在读取时清除。
- **界面文案：** 清理约 80 条随设置改版失效的翻译条目。

### 文档
- README（五种语言）与配置参考同步为「恒定全量采集」；修复 WSL SQLite 指南中文版被整篇重复粘贴的问题。
<!-- app-update-notes:zh:end -->

## 快捷下载

<!-- release-downloads -->

<details>
<summary><strong>首次启动与其他说明</strong></summary>

### 首次启动

**macOS：** 应用已使用 Developer ID 签名并通过 Apple 公证。打开 `.dmg`，然后把 Token Monitor 拖到 Applications。

**Windows：** 安装版和便携版均已签名（[查看验证方法]({{repositoryUrl}}/blob/main/docs/code-signing.md#verify-a-download)）。

**Linux AppImage：** 先给执行权限，然后运行：

```bash
chmod +x Token-Monitor-*.AppImage
./Token-Monitor-*.AppImage
```

**Linux Debian 包：** 双击交给 App Center 安装，或执行 `sudo apt install ./Token-Monitor-{{version}}.deb`。按 [docs/RELEASING.md]({{repositoryUrl}}/blob/main/docs/RELEASING.md) 配好本项目的 APT 源之后，App Center 会把新版本直接显示为可升级。

**Android：** APK 是 Hub 的只读客户端，本身不采集数据，所以需要先有一个 Docker Compose Hub。签名使用长期保存的密钥，安装新版可直接覆盖旧版。

### 其他说明

快捷下载没有列出的平台不提供预构建版本，请参考 [README]({{repositoryUrl}}#readme) 从源码运行。macOS 的 `.zip` 只是同一个 app 的重新打包，除非明确需要，否则可以忽略。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>

<!-- release-hub-image -->
