# 测试说明

本目录包含 WebStorage Pro 的自动化测试：**单元测试（Vitest）**与 **端到端测试（Playwright）**。下文按文件说明职责，便于后续补充或排查失败用例。

---

## 单元测试（Vitest）

运行：`npm run test`（或 `npm run test:watch` 监听模式）。

### `storage-service.test.js`

- **作用**：验证 `popup/storage-service.js` 中与 Chrome 扩展 API 交互的行为。
- **当前覆盖**：`applyStorageUndoPlan` 会把撤销计划正确传入 `chrome.scripting.executeScript`，确保页面内 undo 脚本拿到预期的 `plan`。

### `undo-controller.test.js`

- **作用**：验证 `popup/undo-controller.js` 的撤销注册与执行流程。
- **当前覆盖**：注册撤销时传给 `showToast` 的倒计时相关选项；用户点击 Undo 后是否调用 `applyStorageUndoPlan`、`loadData`、变更检测与高亮回调。

### `ui-services.test.js`

- **作用**：验证 `popup/ui-services.js` 里 **Toast + 可操作按钮（Undo）** 的行为。
- **当前覆盖**：带倒计时的 action 按钮文案随时间更新；超时后 toast 从 DOM 移除；点击 action 后执行回调并关闭 toast。

### `watch-utils.test.js`

- **作用**：验证 `popup/watch-utils.js` 中提取的纯函数逻辑（与 `popup.js` 内存储监听、请求序号防竞态对应）。
- **当前覆盖**：根据「最近交互时间」选择活跃/空闲轮询间隔；请求序列递增与「落后请求不应用」的判断。

---

## 端到端测试（Playwright）

运行：先在本机安装浏览器依赖（仅需一次或升级 Playwright 后）

```bash
npm run pw:install
```

再执行：

```bash
npm run test:e2e
```

或一键：`npm run test:e2e:setup`（安装 Chromium 后跑 E2E）。

### `e2e/popup.e2e.spec.js`

- **作用**：在真实 Chromium 中打开扩展的 `popup/popup.html`（通过 `file://`），并用 **初始化脚本** 注入最小的 `chrome.*` mock（标签页、脚本注入、侧边栏等），模拟可在弹窗内完成的用户路径。
- **当前覆盖**：
  - **Bulk 导入**：批量 JSON 写入后列表出现对应 key。
  - **多选批量删除 + Undo**：进入 Select 模式勾选两项、确认删除；出现带倒计时文案的 Undo toast；点击 Undo 后项恢复。

> E2E 不测真实网页 `localStorage`，只验证弹窗 UI 与编排逻辑；与页面 storage 的真实联动仍依赖扩展在浏览器中的手动或集成验证。
