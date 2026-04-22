
# 🚀 WebStorage Pro（网页存储专业版）浏览器扩展

**WebStorage Pro** 面向前端与全栈开发者，在**当前激活标签页**上可视化查看、编辑 **`localStorage`** 与 **`sessionStorage`**，比反复打开 DevTools「Application」面板更轻量。

<img width="1847" height="758" alt="image" src="https://github.com/user-attachments/assets/366a575e-8d03-468f-af62-e5ca1df2da87" />

## 🆕 最近更新（Highlights）

- 新增 **Single / Bulk** 双模式新增入口，支持批量 JSON 导入与冲突策略（覆盖 / 跳过）。
- 新增 **Select** 多选工作流：批量复制、批量导出、批量删除，支持快速全选当前筛选结果。
- 新增页面内 Storage 变化自动监听，并对 **新增 / 更新 / 删除** 做即时高亮反馈（2 秒自动恢复）。
- 新增高风险操作 **Undo (10s)**：删除、清空、覆盖写入支持 10 秒内一键撤销（单槽位，保留最后一次）。

---

## 📖 使用说明

### 方式一：从 Chrome 商店安装（推荐）
1. 访问 [Chrome Web Store](https://chromewebstore.google.com/)。
2. 搜索 **“WebStorage Pro”** 并点击 **“添加至 Chrome”** 即可自动安装。

### 方式二：从 GitHub 离线安装
1. 在 GitHub 项目页右侧 **Releases** 下载最新压缩包并解压。
2. 打开 Chrome，访问 `chrome://extensions/`，开启右上角 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择**含有 `manifest.json` 的目录**（一般为发布包内的 **`WebStorage-Pro`** 文件夹）。
4. 安装成功后，可将扩展固定到工具栏；点击图标打开弹窗界面。

> 🔄 更新版本时（针对离线安装），用新包覆盖或重新选择解压目录，并在 `chrome://extensions/` 中对该扩展点击 **重新加载**。

---

## ✨ 功能概览

### 存储查看与编辑

- **LocalStorage / SessionStorage** 分栏切换，标签上显示**当前类型的条目数量**。
- **搜索** Key（实时过滤）、一键清空搜索词；**刷新**按钮从页面重新读取数据。
- **增删改**：新增、编辑（支持 **修改 Key** 实现重命名）、单条删除；对当前类型 **清空全部**（高风险二次确认）。
- **重名处理**：保存时若 Key 已存在且与编辑场景冲突，会提示是否**覆盖**。
- **实时监听页面变更**：扩展会自动检测页面内 Storage 变化，并在列表中高亮**新增 / 更新 / 删除**（2 秒后恢复）。
- **受限页面**（`chrome://`、`edge://`、`about:` 等）：提示无法访问并禁用操作。

### 复制与导出

- 点击 **Value** 复制值；点击 **Key** 复制键名。
- 行内 **复制** 按钮：复制完整 JSON 对象 `{"key":"value"}`，便于粘贴到文档或其它工具。
- **导出**：下载 JSON 文件，包含时间戳与页面 URL。

### 新增 / 编辑弹窗

- 常规 **Key**、**Value** 输入框。
- 上方可选 **JSON object**：粘贴如 `{"myKey":"myValue"}`，失焦或粘贴后会解析；合法对象会**自动回填**到 Key / Value（多个键时取第一个；非字符串值会用 `JSON.stringify` 再填入 Value）。
- 支持 **Single / Bulk** 模式：
  - **Single**：单条新增/编辑；
  - **Bulk**：批量导入 JSON 对象，支持冲突策略（覆盖或跳过）。

### 多选与批量操作

- 可进入 **Select** 模式，对当前列表进行多选。
- 支持批量 **复制 / 导出 / 删除** 已选条目。
- 支持一键全选（基于当前筛选结果）与清空选择。

### 撤销（Undo）

- 对高风险操作提供 **10 秒撤销窗口**（单槽位，仅保留最后一次）：
  - 单条删除、批量删除、清空当前类型；
  - 覆盖写入（含编辑覆盖、Bulk 覆盖）。
- 操作成功后 Toast 提供 **Undo (10s)** 入口，超时后自动失效。

### 📌 弹窗与侧边栏（固定）

- 点击 **图钉** 可为**当前标签**开启「固定」：在 **Chrome 侧边栏**中打开本扩展，并记录该标签。
- 支持**多个标签分别固定**；侧边栏会**跟随当前激活标签**切换，并同步刷新列表与固定状态显示。
- 取消固定时从当前标签的固定列表中移除；若当前标签未固定，工具栏图标恢复为**普通弹窗**模式。
- 当前标签处于固定且未打开模态框时，会拦截 **Esc** 以免误关侧边栏（有弹窗时仍优先用 Esc 关闭弹窗）。

### 🌓 外观与反馈

- **深色 / 浅色** 主题：默认跟随系统，手动切换会记住。
- 复制、保存、删除、导出及 JSON 校验等操作均有 **Toast** 提示。

---

## 🛠️ 实现要点

### 权限（Manifest V3）

- `activeTab`、`scripting`、`storage`、`sidePanel`
- `host_permissions`: `<all_urls>`，便于对普通网页注入脚本读写 Storage
- `background.service_worker`: `scripts/background.js`（侧栏选项、多标签固定状态等）

### 数据读写

使用 `chrome.scripting.executeScript` 在**页面环境**中读取 / 写入 `localStorage`、`sessionStorage`，避免扩展弹窗环境与页面存储隔离的问题。

### 其它

- 主题通过 CSS 变量切换；用户主题偏好保存在扩展的 `localStorage` 中。
- 删除、覆盖、清空等危险操作使用**自定义确认框**，避免原生 `confirm` 体验不一致。

---

## 👨‍💻 本地开发

1. 获取源码后，在 Chrome 打开 `chrome://extensions/`，开启 **开发者模式**。
2. **加载已解压的扩展程序**，选择项目中的 **`WebStorage-Pro`** 目录（与 `manifest.json` 同级）。
3. 修改代码后，在扩展卡片上点击 **重新加载**。

`icons` 下已包含 `icon16.png` / `icon48.png` / `icon128.png`；`icon.svg` 可作为矢量源用于再导出。

---

## ✅ 功能清单

- [x] Manifest V3 + Service Worker 后台脚本  
- [x] Local / Session 切换、数量角标、搜索、手动刷新  
- [x] 完整 CRUD、Key 重命名、重名覆盖确认、清空当前类型  
- [x] 智能复制（值 / 键 / JSON 对象）  
- [x] 导出 JSON  
- [x] 弹窗内 JSON 对象粘贴回填 Key / Value  
- [x] Single / Bulk 新增模式、Bulk 冲突策略（覆盖/跳过）  
- [x] 多选 + 批量复制/导出/删除 + 全选控制  
- [x] 页面 Storage 变化自动监听与新增/更新/删除高亮反馈  
- [x] 删除/清空/覆盖操作 10 秒可撤销（单槽位 Undo）  
- [x] 📌 固定 + 侧边栏、按标签维度的固定状态  
- [x] 🌓 深色 / 浅色主题、Toast、自定义确认框