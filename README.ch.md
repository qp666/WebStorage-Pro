# 📝 WebStorage Pro (网页存储专业版) 浏览器扩展

**WebStorage Pro** 是一款专为开发者设计的浏览器扩展，旨在提供比 Chrome DevTools 更直观、更快捷的 `localStorage` 与 `sessionStorage` 管理体验。


<img width="1847" height="758" alt="image" src="https://github.com/user-attachments/assets/6d62da28-1aaa-4942-91cc-f13317b7c55a" />
---

## 使用说明
- 在 GitHub 项目页面右侧找到 Releases 区域，点击最新版本进行下载
- 下载后解压到本地任意目录
- 打开 Chrome，访问 chrome://extensions/ 并开启右上角“开发者模式”
- 点击“加载已解压的扩展程序”，选择解压后的扩展目录（包含 manifest.json 的根目录）
- 安装成功后，点击浏览器工具栏中的扩展图标即可使用 WebStorage Pro
- 更新到新版本时，重复以上步骤加载最新的 Releases 包即可

## 🚀 核心功能 (Core Features)

*   **可视化列表**：
    *   自动读取当前激活标签页的 `localStorage` 和 `sessionStorage`。
    *   以卡片形式展示 Key-Value 列表。
    *   **实时计数**：Tab 标签页上直接显示当前存储类型的条目数量。

*   **高效交互**：
    *   **快速搜索**：支持通过 Key 关键词实时过滤数据，带有一键清空按钮。
    *   **智能复制**：
        *   点击 **Value**：仅复制 Value 文本。
        *   点击 **复制图标**：复制完整的 JSON 对象（`{"key": "value"}`）。
    *   **数据导出**：支持一键导出当前页面的所有存储数据为 JSON 文件（包含时间戳和来源 URL）。

*   **数据管理**：
    *   **新增/编辑**：支持添加新条目或修改现有条目。
    *   **智能重命名**：编辑时允许修改 Key（自动处理旧 Key 删除与新 Key 创建）。
    *   **安全删除**：
        *   删除单项时弹出二次确认框。
        *   **清空所有**：支持一键清空当前类型的全部数据（带高风险二次确认）。
    *   **冲突检测**：新增或重命名 Key 时，如果 Key 已存在，会弹出覆盖确认提示。

*   **用户体验优化**：
    *   **深色模式**：完美适配深色/浅色主题，默认跟随系统偏好，支持一键手动切换并自动记忆。
    *   **自动定位**：新增条目后自动滚动至该位置并高亮闪烁，方便快速确认。
    *   **Toast 提示**：所有操作（复制、保存、删除、导出）均有清晰的 Toast 反馈。
    *   **ESC 快捷键**：支持按 `Esc` 键关闭弹窗（优先关闭最上层弹窗，避免误关扩展）。
    *   **自适应 UI**：美观的卡片式布局，Tab 切换动画，自适应角标宽度。


---

## ⚙️ 关键逻辑实现

### 1. 权限配置 (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "WebStorage Pro",
  "permissions": ["activeTab", "scripting", "storage"],
  "action": {
    "default_popup": "popup/popup.html"
  }
}
```

### 2. 数据读写机制

利用 `chrome.scripting.executeScript` 在当前页面上下文中执行代码，突破 Popup 的沙箱限制：

*   **读取**：一次性获取 `localStorage` 和 `sessionStorage` 的快照。
*   **写入/删除**：通过注入函数直接操作目标页面的 `window.localStorage` 或 `window.sessionStorage`。

### 3. 安全与体验细节

*   **主题管理**：利用 CSS 变量 (`--bg-color`, `--text-primary` 等) 实现全站深色模式适配，通过 `localStorage` 存储用户偏好，并监听 `prefers-color-scheme` 实现系统级跟随。
*   **防误触**：所有破坏性操作（删除、覆盖、清空）均通过自定义模态框（非原生 `confirm`）进行二次确认。
*   **键盘无障碍**：全局监听 `keydown` 事件，智能处理 `Esc` 键的层级关闭逻辑。
*   **数据导出**：生成 Blob 对象并创建临时下载链接，实现纯前端的数据导出。

---

## 🛠 开发指南

### 安装与调试

1.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
2.  开启右上角的 **"开发者模式" (Developer mode)**。
3.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
4.  选择本项目根目录：`d:\code\WebStorage Pro`。

### 图标生成

项目包含 `icons/icon.svg` 矢量源文件。发布前建议使用工具将其转换为标准的 PNG 格式（16x16, 48x48, 128x128）以确保最佳显示效果。

---

## ✅ 已完成功能 (Completed)

*   [x] Manifest V3 基础架构
*   [x] Local/Session Storage 切换与列表展示
*   [x] Tab 栏实时数量角标
*   [x] 搜索与清空功能
*   [x] 数据增删改查 (CRUD)
*   [x] Key 重命名与冲突检测
*   [x] 智能复制 (Value vs JSON)
*   [x] 数据导出 (JSON)
*   [x] 自定义确认弹窗与 Toast 提示
*   [x] UI 美化 (卡片风格、动画、SVG 图标)
*   [x] 深色/浅色模式支持 (Dark/Light Theme)
