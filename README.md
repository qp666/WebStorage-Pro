# WebStorage Pro — Browser Extension

WebStorage Pro is a developer-focused browser extension for managing **`localStorage`** and **`sessionStorage`** on the active tab with a compact UI—faster to scan than digging through Chrome DevTools Application panels.

<img width="1847" height="758" alt="WebStorage Pro UI" src="https://github.com/user-attachments/assets/6d62da28-1aaa-4942-91cc-f13317b7c55a" />

---

## Usage

1. Download the latest release from GitHub **Releases** and extract the archive.
2. Open Chrome and go to `chrome://extensions/`, enable **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json` (the `WebStorage-Pro` directory inside the package).
4. Pin the extension if you like, then click the toolbar icon to open the popup.

To update, load the new unpacked folder again (or replace files and use **Reload** on the extension card).

---

## Features

### Storage inspection & editing

- **LocalStorage / SessionStorage** tabs with live **item counts** on each tab.
- **Search** keys with a one-click clear control; **Refresh** button to reload from the page.
- **CRUD**: add, edit (including **rename key**), delete single items; **clear all** for the current storage type (with confirmation).
- **Duplicate key** handling: overwrite confirmation when saving would collide with an existing key.
- **Restricted pages** (`chrome://`, `edge://`, `about:`, etc.): shows an error state and disables actions.

### Copy & export

- Click **value** to copy the stored string; click **key** to copy the key.
- **Copy** toolbar on a row copies a JSON object: `{"key":"value"}` for easy pasting elsewhere.
- **Export** downloads JSON including timestamp and page URL.

### Add / edit dialog

- **Key** and **Value** fields as usual.
- Optional **JSON object** field: paste something like `{"myKey":"myValue"}`; on blur or after paste, valid objects fill key/value (first key if multiple; non-string values are serialized with `JSON.stringify`).

### Popup vs Side Panel (pin)

- Click the **pin** icon to **lock** the current tab: opens the extension in the **Chrome Side Panel** and remembers this tab.
- Multiple tabs can be pinned independently; the side panel **follows the active tab** and refreshes storage data when you switch tabs.
- Unlocking removes the current tab from the pinned set; the toolbar icon falls back to the normal popup when the active tab is not pinned.
- With **Lock** enabled on the current tab, **Escape** is intercepted so the side panel does not close accidentally (modals still close with Esc as expected).

### Appearance

- **Dark / Light** theme: defaults to system preference; manual toggle is remembered.
- Toasts for copy, save, delete, export, and validation feedback.

---

## Implementation notes

- **Manifest V3** with a **service worker** (`scripts/background.js`) for Side Panel options and lock state.
- **Permissions**: `activeTab`, `scripting`, `storage`, `sidePanel`; **`host_permissions`**: `<all_urls>` so `chrome.scripting` can run on normal web pages.
- **Data access**: `chrome.scripting.executeScript` runs in the page context to read/write `localStorage` / `sessionStorage`.
- **Theming**: CSS variables; user theme choice in extension `localStorage`.

---

## Development

1. Clone or copy this repo.
2. In Chrome: `chrome://extensions/` → Developer mode → **Load unpacked** → choose the **`WebStorage-Pro`** directory (must contain `manifest.json`).
3. After edits, click **Reload** on the extension card.

Icons ship as PNG (`icons/icon16.png`, etc.); `icons/icon.svg` is available as a source asset.

---

## Feature checklist

- [x] Manifest V3 + background service worker  
- [x] Local / Session toggle, counts, search, manual refresh  
- [x] CRUD, key rename, duplicate overwrite prompt, clear all  
- [x] Smart copy (value / key / JSON object)  
- [x] Export JSON  
- [x] JSON object paste → fill key/value in modal  
- [x] Pin + Side Panel, per-tab lock state  
- [x] Dark/Light theme, toasts, custom confirm dialogs  
