# WebStorage Pro — Browser Extension

WebStorage Pro is a developer-focused browser extension that provides a faster, more visual way to manage `localStorage` and `sessionStorage` than Chrome DevTools.
<img width="622" height="771" alt="image" src="https://github.com/user-attachments/assets/dbfc229d-78fc-4755-8704-349ba7944a04" />
<img width="1847" height="758" alt="image" src="https://github.com/user-attachments/assets/6d62da28-1aaa-4942-91cc-f13317b7c55a" />
---

## Usage

- Open the project page on GitHub and click the Releases section on the right to download the latest package
- Extract the downloaded archive to any local directory
- Open Chrome and visit `chrome://extensions/`, enable "Developer mode" in the top-right corner
- Click "Load unpacked" and select the extracted extension directory (the one that contains `manifest.json`)
- After installation, click the toolbar icon to open WebStorage Pro
- To update, repeat the steps above with the latest release

---

## Features

- Visual list
  - Reads the current tab’s `localStorage` and `sessionStorage`
  - Displays key–value entries in clean, card-style rows
  - Shows per-type item counts directly on the tabs

- Efficient interactions
  - Fast search with a clear button
  - Smart copy
    - Click the value pill to copy only the value
    - Click the copy icon to copy a JSON object: `{"key":"value"}`
  - Export data to JSON with timestamp and source URL

- Data management
  - Add and edit entries (supports renaming keys)
  - Safe delete with confirmation
  - Clear all for the active storage type with high-risk confirmation
  - Duplicate key detection with overwrite confirmation

- UX details
  - Dark/Light theme with system preference by default; manual toggle available and remembered
  - Auto-scroll and highlight after adding a new item (edits do not change scroll position)
  - Clear toast feedback for actions (copy, save, delete, export)
  - ESC closes modals (respects stacking and won’t accidentally close the popup)

---

## Project Structure

```text
WebStorage Pro/
├── manifest.json          # Extension config (Manifest V3)
├── popup/
│   ├── popup.html         # UI (HTML)
│   ├── popup.css          # Styles (CSS; dark/light theme variables)
│   └── popup.js           # Logic (CRUD, export, theme toggle, confirm/toast)
├── scripts/
│   └── content.js         # Content script (reserved for future features)
└── icons/                 # Icon assets
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Implementation Notes

- Permissions (Manifest V3)
  - `"activeTab"`, `"scripting"`, `"storage"`
  - Default popup: `popup/popup.html`

- Data access
  - Uses `chrome.scripting.executeScript` to read and modify storage in the page context
  - Restricted pages (e.g., `chrome://`, `edge://`, `about:`) are detected; all controls are disabled with an error message

- Theme system
  - CSS variables drive both light and dark themes
  - Follows `prefers-color-scheme` by default; user’s manual choice is stored in `localStorage`

---

## Completed

- Manifest V3 setup
- Local/Session toggle and list view
- Tab item counts
- Search and clear functions
- CRUD with key rename and duplicate detection
- Smart copy (value vs JSON object)
- Export to JSON
- Custom confirm modal and toast notifications
- Dark/Light theme support

