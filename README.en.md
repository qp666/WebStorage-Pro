# 🚀 WebStorage Pro — Browser Extension

**WebStorage Pro** helps front-end and full-stack developers inspect and edit **`localStorage`** and **`sessionStorage`** on the **active tab** with a compact UI—lighter than opening DevTools → Application over and over.

<img width="1847" height="758" alt="WebStorage Pro" src="https://github.com/user-attachments/assets/366a575e-8d03-468f-af62-e5ca1df2da87" />

---

## 📖 Usage

### Option 1: Install from the Chrome Web Store (recommended)

1. Open the [Chrome Web Store](https://chromewebstore.google.com/).
2. Search for **“WebStorage Pro”** and click **Add to Chrome** to install.

### Option 2: Install from GitHub (unpacked)

1. Download the latest archive from **Releases** on the GitHub project page and extract it.
2. Open Chrome and go to `chrome://extensions/`, enable **Developer mode** in the top-right.
3. Click **Load unpacked** and select the folder that contains **`manifest.json`** (usually the **`WebStorage-Pro`** folder inside the package).
4. Optionally pin the extension; click the toolbar icon to open the popup.

> 🔄 **Updating (unpacked installs):** replace files or pick the new folder again, then click **Reload** on the extension card at `chrome://extensions/`.

---

## ✨ Features

### Storage inspection & editing

- **LocalStorage / SessionStorage** tabs with **item counts** for the active type.
- **Search** keys with live filtering and a clear control; **Refresh** reloads data from the page.
- **CRUD**: add, edit (including **rename via key**), delete items; **clear all** for the current type (with confirmation).
- **Duplicate keys:** overwrite confirmation when saving would conflict with an existing key.
- **Restricted pages** (`chrome://`, `edge://`, `about:`, etc.): error state and disabled actions.

### Copy & export

- Click **Value** to copy the value; click **Key** to copy the key.
- Row **copy** button: copies a JSON object `{"key":"value"}` for pasting elsewhere.
- **Export:** downloads JSON with timestamp and page URL.

### Add / edit dialog

- Standard **Key** and **Value** fields.
- Optional **JSON object** field: paste e.g. `{"myKey":"myValue"}`; on blur or after paste, valid objects **fill Key / Value** (first key if several; non-string values use `JSON.stringify` for the value field).

### 📌 Popup vs Side Panel (pin)

- Click the **pin** to **pin** the **current tab**: opens the extension in the **Chrome Side Panel** and remembers this tab.
- **Multiple tabs** can be pinned; the side panel **follows the active tab** and refreshes the list and pin state.
- Unpin removes the current tab from the set; if the active tab is not pinned, the toolbar icon uses the **normal popup** again.
- When the tab is pinned and no modal is open, **Escape** is intercepted so the side panel does not close by mistake (modals still close with Esc first).

### 🌓 Appearance & feedback

- **Dark / Light** theme: follows the system by default; manual choice is remembered.
- **Toasts** for copy, save, delete, export, and JSON validation.

---

## 🛠️ Implementation notes

### Permissions (Manifest V3)

- `activeTab`, `scripting`, `storage`, `sidePanel`
- `host_permissions`: `<all_urls>` for injecting scripts on normal pages to read/write Storage
- `background.service_worker`: `scripts/background.js` (side panel options, multi-tab pin state, etc.)

### Data access

`chrome.scripting.executeScript` runs in the **page context** to read/write `localStorage` and `sessionStorage`, avoiding isolation between the extension UI and the page.

### Other

- Theming via CSS variables; user theme is stored in extension `localStorage`.
- Destructive actions use a **custom confirm dialog** instead of the native `confirm` for consistent UX.

---

## 👨‍💻 Local development

1. Clone or copy the repo. In Chrome, open `chrome://extensions/` and enable **Developer mode**.
2. **Load unpacked** and select the **`WebStorage-Pro`** directory (same level as `manifest.json`).
3. After code changes, click **Reload** on the extension card.

`icons` includes `icon16.png`, `icon48.png`, and `icon128.png`; `icon.svg` is available as a vector source.

---

## ✅ Feature checklist

- [x] Manifest V3 + Service Worker background script  
- [x] Local / Session toggle, counts, search, manual refresh  
- [x] Full CRUD, key rename, overwrite prompt, clear current type  
- [x] Smart copy (value / key / JSON object)  
- [x] Export JSON  
- [x] JSON object paste → fill Key / Value in the modal  
- [x] 📌 Pin + Side Panel, per-tab pin state  
- [x] 🌓 Dark / Light theme, toasts, custom confirm dialogs  
