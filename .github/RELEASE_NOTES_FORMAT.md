# 发布正文格式

`.github/RELEASE_TEMPLATE.md` 是每次 GitHub Release 正文的**唯一**起点：
`.github/workflows/release.yml` 的 release job 调用 `scripts/generate-release-notes.js`
渲染它，产出 `release-body.md` 后交给 `softprops/action-gh-release` 的 `body_path`。

正文只有中文。这是明确的产品决定，不是遗漏：英文段与繁體中文／한국어／日本語段此前由模板手写、
脚本只替换 `en`／`zh` 两处，于是那几个语言每次发出去的都是**上一个版本**的内容；GitHub 自动生成的
changelog 是英文 PR 列表，且没有任何 workflow 步骤去填充它，那块 `Full Changelog` 折叠区一直发的是空块。
两类失效都由"同一段内容存在多个副本、其中一个没人维护"造成，所以不再保留第二语言。

## 结构（自上而下）

```markdown
# Token Monitor {{tag}}

## 本次更新

<!-- app-update-notes:zh:start -->
（发版前手写：这一版改了什么）
<!-- app-update-notes:zh:end -->

## 快捷下载

<!-- release-downloads -->

<details>
<summary><strong>首次启动与其他说明</strong></summary>

（各平台首次启动、签名、AppImage 执行权限、`.deb` / APT、Android 覆盖安装、tokscale 依赖）

</details>

<!-- release-hub-image -->
```

- **本次更新**：由人在打 tag 之前写进标记区，脚本不再从 commit 标题生成条目。标记对
  `app-update-notes:zh:start` / `:end` 必须各出现一次，且区内不能只剩标题——只剩 `###` 时渲染直接失败，
  避免发出一份没写内容的说明。写成 `### 小节` + `- 条目` 才会同时进入应用内更新读取的结构化说明
  （`extractReleaseNotes`）；写成自然段落只在 release 页面显示，两种都可以。
- **快捷下载**：整段由 `RELEASE_ARTIFACTS` 表生成，模板里**不要**手写任何
  `releases/download/` 链接。产物名的单一来源就是这张表，
  `tests/shared/releaseArtifactNames.test.js` 把它与 `package.json` 里的
  `build.mac/linux/nsis/portable.artifactName`、Android job 的 APK 文件名以及 release job 的上传
  glob 逐条对齐；`tests/shared/releaseNotesGenerator.test.js` 再断言安卓 APK 与 `.deb` 必须在列表里。
- **Hub 镜像与 Compose**：由 `hubDeploymentSection()` 生成，按 `release_type` 决定是否提到 `latest`
  （prerelease 不移动 `latest`，见 AGENTS.md 的版本与发布策略）。
- **占位符**：`{{version}}`、`{{tag}}`、`{{repository}}`、`{{repositoryUrl}}`。未知占位符，或渲染结果里
  仍残留 `{{`，都会让渲染失败。标记区内不要放占位符以外的版本字符串：替换发生在标记校验之前，
  脚本会再读一次标记区，确保没有 `{{token}}` 漏进应用内说明。

`package.json` 的 `build.releaseInfo.releaseNotesFile` 指向同一个模板文件，electron-builder 会把它的
原文塞进 `latest*.yml` 的 `releaseNotes`。因此模板在 tag 上必须是**本版**的说明，应用内更新读到的
才是本版内容；模板里的 `{{...}}` 只有标记区会被解析，不会显示给用户。

## 发版前要做的只有一件事

把本次更新写进标记区，其余（链接、版本号、镜像标签）都由流程注入。详见 `docs/RELEASING.md`。
