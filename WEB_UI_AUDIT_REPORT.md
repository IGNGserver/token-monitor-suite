# Web UI 重构与发布审查报告 (Audit Report)

## 概述与审查结论
本项目进行了中枢网页端（Hub Web UI）信息架构与页面功能的深度重构，将分散的 12 个平级导航收敛对齐为与桌面端更匹配的 8 个核心一级页面（Overview, Usage, Devices, Limits, Trends, Accounts, Management, Settings）。
经全面代码审查，整体重构架构清晰、数据流防御完备、旧路由兼容完好、所有既有业务功能均得到保留。但在细节实现与交互体验上，发现 **4 项需修复的 Bug** 与 **4 项不符合交互/设计规范的缺陷**，整理如下。

---

## 缺陷与 Bug 详细清单

### 1. [Bug - 高危] `renderHome()` 首页跳转模型详情缺失 `data-jump-usage-tab`
- **问题文件**：`src/hub/web/js/app.js` (约第 1003 行)
- **现象描述**：
  在总览页（Home/Overview）中，“Models”卡片行的跳转属性为 `<button class="home-interactive-row" data-jump-view="model">`。而在事件委托处理逻辑中（`app.js:3249`），调用了 `switchView(view, { tab: jumpView.dataset.jumpUsageTab || '' })`。
  由于该按钮没有设置 `data-jump-usage-tab="models"`，点击后进入 Usage 页时回退默认显示 `tools` 标签页，用户无法直接看到所点击的模型详情。
- **修复要求**：
  在 `renderHome()` 中，将模型行的按钮标签补齐 `data-jump-usage-tab="models"`：
  ```html
  <button type="button" class="home-interactive-row" data-jump-view="model" data-jump-usage-tab="models">
  ```
  同理检查该区域是否有跳转 project/session 的类似场景，确保均显式声明对应的 `data-jump-usage-tab`。

---

### 2. [Bug - 中危] Limits 页面在 `limitTab === 'health'` 时的 URL 参数同步缺失
- **问题文件**：`src/hub/web/js/app.js` (约第 183-187 行 `syncUrlForView`)
- **现象描述**：
  路由定义 `LEGACY_ROUTE_ALIASES['/status']` 映射为 `{ view: 'limits', limitTab: 'health' }`，且在直接访问 `/limits?tab=health` 时能正常渲染状态面板。
  但是在用户手动切换或更新视图时，`syncUrlForView` 函数仅处理了 `usage` 和 `management` 的 `tab` 参数：
  ```javascript
  const nextTab = tab || (viewId === 'usage' ? state?.prefs?.usageTab : viewId === 'management' ? state?.prefs?.managementTab : '');
  if (nextTab && ((viewId === 'usage' && ['tools', 'models', 'projects', 'sessions'].includes(nextTab))
    || (viewId === 'management' && ['subscriptions', 'pricing'].includes(nextTab)))) {
    params.set('tab', nextTab);
  }
  ```
  这导致访问或更新 `/limits` 下的 `health` 状态时，URL 地址栏不会同步更新为 `?tab=health`，刷新后丢失当前子状态。
- **修复要求**：
  在 `syncUrlForView` 中加入对 `limits` 页面 `limitTab === 'health'` 的参数同步处理。

---

### 3. [交互缺陷 / UX Bug] 侧边栏及顶栏的“设置”按钮与一级“Settings”页面逻辑割裂
- **问题文件**：`src/hub/web/index.html` 与 `src/hub/web/js/app.js` (约第 3684-3696 行)
- **现象描述**：
  本次重构已将“设置 (Settings)”实现为一个完整的一级页面（`renderSettingsPage()`，包含语言、主题、货币、Home 账号数、密钥、连接信息、PWA 与桌面端功能边界说明）。
  但是，侧边栏底部的快捷按钮 `#settingsOpen`（Quick settings）和手机端顶栏按钮 `#settingsOpenTop` 仍直接绑定到旧版的抽屉浮层 `openSettings(true)`，而不是使用 `switchView('settings')` 导航到新的设置页面。用户在快捷入口和页面之间感知混乱。
- **修复要求**：
  统一交互策略：
  - 侧边栏/顶栏的设置按钮应作为路由跳转触发 `switchView('settings')`，或者在已有的独立页面与侧滑面板之间做清晰的职责收敛（优先推荐主按钮导航至 `/settings` 页面）。

---

### 4. [显示缺陷 - 桌面端对齐] 页面顶栏副标题 (Page Meta) 在无用量作用域的页面展示遗漏
- **问题文件**：`src/hub/web/js/app.js` (约第 591-614 行)
- **现象描述**：
  `viewUsesUsageScope` 仅包含 `['overview', 'usage', 'devices', 'trends']`。在切换到 `limits`、`accounts`、`management`、`settings` 时，`scoped` 为 false，此时 `els.pageMeta.textContent` 仅包含 `viewDescription()`，但缺失页面的导语小标题（kicker），导致标题区视觉节奏在切换页面时发生塌陷。
- **修复要求**：
  优化顶栏 `pageMeta` 与页面内 `page-intro` 的配合，确保所有 8 个页面在进入时其顶部标题、副标题描述均有稳定、统一的层级展示。

---

### 5. [功能保留检查] Trends 页面缺乏自定义日期的热力图联动
- **问题文件**：`src/hub/web/js/app.js` (约第 2043 行)
- **现象描述**：
  在 `renderTrends()` 中，热力图硬编码为 90 天：
  ```javascript
  ${panel(tr('home.heatmap'), renderHeatmap(historyDaily(historySource(), 90), heatMetric))}
  ```
  当用户在 Trends 页面选择 `365d` 或 `all` 范围时，堆叠条形图切换为了整年或全量，但下方的热力图仍然只渲染 90 天，与用户选中的跨度不匹配。
- **修复要求**：
  使热力图的展示天数跟随选中的 `trendsRange`（例如 365 档展示 365 天热力图），或者与桌面端趋势面板保持一致。

---

### 6. [Release 流水线修复] `.github/workflows/release.yml` 中的临时文件与 Headless 校验
- **问题文件**：`.github/workflows/release.yml` (约第 68-75 行)
- **审查情况**：
  上一个 AI 对 `release.yml` 的修改（将 `tar -tzf | grep -q` 改为写入 `$RUNNER_TEMP/headless-file-list.txt` 再 grep）逻辑正确，已验证可以彻底解决 `pipefail` 下管道提前断开报错退出的问题。
- **要求**：
  保持当前工作区对版本递增至 `0.45.0-rev.32` 以及对 `release.yml` 的修改，待上述前端缺陷修复后一并提交。

---

## 修复验证基准
- `npm run verify:product-scope`：保证遵循 Electron local/client 与 Docker Compose Hub 唯一边界。
- `npm run lint`：保证 ESLint 0 警告 0 报错。
- `node --test "tests/hub/**/*.test.js"` 与 `npm test`：保证所有单元测试通过。
- `npm run verify:release-version`：保证版本号一致。
