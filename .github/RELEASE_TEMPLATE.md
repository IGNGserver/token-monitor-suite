# Token Monitor {{tag}}

## 本次更新

<!-- app-update-notes:zh:start -->
### 动效与交互
- **Fluent 2 动效体系：** 为按钮、数据卡片、交互行全面引入 Fluent 2 官方按压缩放（scale-press）与微交互动效；为侧边栏导航添加平滑的高度与透明度缓动展开。
- **数据与图表动态呈现：** 工具/模型用量占比条和额度监控进度条实现平滑的宽度与颜色注水动效；趋势柱状图与贡献热力图支持错落渐显级联出场，卡片与数值切换更自然流畅。
- **浮层与详情展开：** 优化操作弹窗、下拉菜单和用量明细 `<details>` 的平滑位移展开与箭头旋转过度；全面支持并适配低动效偏好（reduced motion）。

### 性能与体验
- **Android 启动与刷新：** Hub 能力协商不再阻塞首页数据；网络连接复用、加密设置读取移至后台线程，并避免重复刷新。首次加载和后台同步会显示进度提示与骨架。
- **桌面启动：** tokscale 更新器只在实际解包时加载归档模块；隐藏窗口不再持续接收大体积统计快照，恢复时补发最新状态。

### 数据与界面
- **时间范围：** 本周统一按 ISO 周一开始；日期范围结果只显示在发起请求的范围页签，跨日后会重新计算。
- **设备转移：** 转移确认页明确说明源设备会从 Hub 移除；成功转移后必须重新识别该设备才能继续上报。
- **共享界面：** 修正刷新、主题和设备管理交互，并统一不同语言环境下的统计范围。
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
