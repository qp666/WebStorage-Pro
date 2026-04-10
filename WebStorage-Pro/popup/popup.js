document.addEventListener('DOMContentLoaded', () => {
  const LOCKED_POPUP_KEY = 'popup_locked_mode';
  const SIDEPANEL_VIEW = 'sidepanel';

  // State
  const state = {
    currentType: 'local', // 'local' or 'session'
    storageData: {
      local: {},
      session: {}
    },
    searchQuery: '',
    editingKey: null, // Track original key for renaming
    isLocked: false
  };

  // DOM Elements
  const elements = {
    tabs: {
      local: document.getElementById('tab-local'),
      session: document.getElementById('tab-session'),
      badgeLocal: document.getElementById('badge-local'),
      badgeSession: document.getElementById('badge-session')
    },
    list: document.getElementById('storage-list'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    badgeCount: document.getElementById('item-count'), // Keep reference but unused in new design
    clearAllBtn: document.getElementById('clear-all-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    exportBtn: document.getElementById('export-btn'),
    pinBtn: document.getElementById('pin-btn'),
    themeBtn: document.getElementById('theme-btn'),
    iconSun: document.getElementById('icon-sun'),
    iconMoon: document.getElementById('icon-moon'),
    addBtn: document.getElementById('add-btn'),
    modal: {
      container: document.getElementById('modal'),
      title: document.getElementById('modal-title'),
      keyInput: document.getElementById('item-key'),
      valueInput: document.getElementById('item-value'),
      cancelBtn: document.getElementById('modal-cancel'),
      saveBtn: document.getElementById('modal-save')
    },
    confirm: {
      container: document.getElementById('confirm-modal'),
      title: document.getElementById('confirm-title'),
      message: document.getElementById('confirm-message'),
      cancelBtn: document.getElementById('confirm-cancel'),
      okBtn: document.getElementById('confirm-ok')
    }
  };

  // Initialize
  init();

  async function init() {
    await initLayoutMode();
    await initLockMode();
    initTheme();
    bindEvents();
    loadData();
  }

  async function initLayoutMode() {
    if (isSidePanelMode()) {
      document.body.classList.add('sidepanel-mode');
    }
  }

  function isSidePanelMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === SIDEPANEL_VIEW;
  }

  async function initLockMode() {
    const stored = await chrome.storage.local.get(LOCKED_POPUP_KEY);
    if (typeof stored[LOCKED_POPUP_KEY] === 'boolean') {
      state.isLocked = stored[LOCKED_POPUP_KEY];
    } else {
      // Backward compatibility for old localStorage setting.
      state.isLocked = localStorage.getItem(LOCKED_POPUP_KEY) === '1';
    }
    updateLockButton();

    // In lock mode, intercept ESC at page level when no modal is open.
    document.addEventListener('keydown', (e) => {
      const modalVisible = !elements.modal.container.classList.contains('hidden');
      const confirmVisible = !elements.confirm.container.classList.contains('hidden');

      if (state.isLocked && e.key === 'Escape' && !modalVisible && !confirmVisible) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function updateLockButton() {
    elements.pinBtn.classList.toggle('active', state.isLocked);
    elements.pinBtn.title = state.isLocked ? 'Unlock popup' : 'Lock popup';
  }

  async function toggleLockMode() {
    state.isLocked = !state.isLocked;
    localStorage.setItem(LOCKED_POPUP_KEY, state.isLocked ? '1' : '0');
    await chrome.storage.local.set({ [LOCKED_POPUP_KEY]: state.isLocked });
    updateLockButton();

    if (state.isLocked) {
      await openSidePanel();
      showToast('Lock enabled (Side Panel)');
      closePopupIfNeeded();
    } else {
      await closeSidePanelIfNeeded();
      showToast('Lock disabled');
    }
  }

  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || typeof tab.id !== 'number') return;
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: `popup/popup.html?view=${SIDEPANEL_VIEW}`,
        enabled: true
      });
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  }

  function closePopupIfNeeded() {
    if (isSidePanelMode()) return;
    // In action popup context, close after handing off to side panel.
    window.close();
  }

  async function closeSidePanelIfNeeded() {
    if (!isSidePanelMode()) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || typeof tab.id !== 'number') return;

      // Disable side panel on current tab to force close.
      await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false });
    } catch (error) {
      console.error('Failed to close side panel:', error);
    } finally {
      window.close();
    }
  }

  function initTheme() {
    // Check local storage for theme preference
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      // Default to system preference
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemDark ? 'dark' : 'light');
    }

    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // Only update if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      elements.iconSun.classList.remove('hidden');
      elements.iconMoon.classList.add('hidden');
    } else {
      document.body.removeAttribute('data-theme');
      elements.iconSun.classList.add('hidden');
      elements.iconMoon.classList.remove('hidden');
    }
  }

  function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }

  function bindEvents() {
    // Lock Toggle
    elements.pinBtn.addEventListener('click', toggleLockMode);

    // Theme Toggle
    elements.themeBtn.addEventListener('click', toggleTheme);

    // Tab Switching
    elements.tabs.local.addEventListener('click', () => switchTab('local'));
    elements.tabs.session.addEventListener('click', () => switchTab('session'));

    // Search
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      toggleClearBtn();
      renderList();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      toggleClearBtn();
      renderList();
    });

    // Refresh
    elements.refreshBtn.addEventListener('click', () => loadData(true));

    // Export
    elements.exportBtn.addEventListener('click', exportData);

    // Clear All
    elements.clearAllBtn.addEventListener('click', clearAllStorage);

    // Add Item
    elements.addBtn.addEventListener('click', () => openModal());

    // Modal Actions
    elements.modal.cancelBtn.addEventListener('click', closeModal);
    elements.modal.saveBtn.addEventListener('click', saveItem);
    
    // Close modal on outside click
    elements.modal.container.addEventListener('click', (e) => {
      if (e.target === elements.modal.container) closeModal();
    });
  }

  function toggleClearBtn() {
    if (state.searchQuery) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
    }
  }

  function switchTab(type) {
    state.currentType = type;
    
    // Update Tab UI
    if (type === 'local') {
      elements.tabs.local.classList.add('active');
      elements.tabs.session.classList.remove('active');
    } else {
      elements.tabs.local.classList.remove('active');
      elements.tabs.session.classList.add('active');
    }

    renderList();
  }

  async function loadData(showToastOnSuccess = false) {
    // Only set loading if it's an initial load or manual refresh
    // Skipping setLoading(true) for auto-reload after save keeps UI stable
    if (showToastOnSuccess || !state.storageData.local) {
      setLoading(true);
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showError('No active tab found.');
        return;
      }

      // Check if we can script this tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showError('Cannot access storage on system pages.');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            local: { ...localStorage },
            session: { ...sessionStorage }
          };
        }
      });

      if (results && results[0] && results[0].result) {
        state.storageData = results[0].result;
        updateTabBadges();
        renderList();
        if (showToastOnSuccess) {
          showToast('Refreshed successfully');
        }
      } else {
        state.storageData = { local: {}, session: {} };
        updateTabBadges();
        renderList();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Failed to load storage data. Page might be restricted.');
    } finally {
      setLoading(false);
    }
  }

  function scrollToItem(key) {
    // Need to wait for DOM update after renderList
    setTimeout(() => {
      // Iterate over storage-item and check the key inside
      const items = document.querySelectorAll('.storage-item');
      for (const row of items) {
        const keyEl = row.querySelector('.item-key');
        if (keyEl && keyEl.textContent === key) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          row.classList.add('highlight-item');
          
          // Remove class after animation ends to clean up
          setTimeout(() => {
            row.classList.remove('highlight-item');
          }, 2000);
          break;
        }
      }
    }, 150); // Increased timeout slightly to ensure render is complete
  }

  function setLoading(isLoading) {
    if (isLoading) {
      elements.list.innerHTML = '<div class="empty-state">Loading...</div>';
    }
  }

  function showError(msg) {
    elements.list.innerHTML = `<div class="empty-state" style="color: var(--danger-color)">${msg}</div>`;
    
    // Disable all interactive elements
    elements.addBtn.disabled = true;
    elements.clearAllBtn.disabled = true;
    elements.exportBtn.disabled = true;
    elements.searchInput.disabled = true;
    elements.clearSearchBtn.disabled = true;
    
    // Disable tabs logic
    elements.tabs.local.style.pointerEvents = 'none';
    elements.tabs.session.style.pointerEvents = 'none';
    elements.tabs.local.style.opacity = '0.5';
    elements.tabs.session.style.opacity = '0.5';
  }

  function updateTabBadges() {
    const localCount = Object.keys(state.storageData.local || {}).length;
    const sessionCount = Object.keys(state.storageData.session || {}).length;

    elements.tabs.badgeLocal.textContent = `${localCount} items`;
    elements.tabs.badgeSession.textContent = `${sessionCount} items`;
  }

  function renderList() {
    const data = state.storageData[state.currentType] || {};
    const container = elements.list;
    container.innerHTML = '';

    const entries = Object.entries(data);
    const filteredEntries = entries.filter(([key]) => 
      key.toLowerCase().includes(state.searchQuery)
    );

    // badgeCount is removed from UI, no need to update it
    
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">No items found</div>';
      return;
    }

    if (filteredEntries.length === 0) {
      container.innerHTML = '<div class="empty-state">No matches found</div>';
      return;
    }



    filteredEntries.forEach(([key, value]) => {
      const itemEl = createItemElement(key, value);
      container.appendChild(itemEl);
    });
  }

  function createItemElement(key, value) {
    const div = document.createElement('div');
    div.className = 'storage-item';
    
    // Copy Logic
    const copyValue = () => {
      navigator.clipboard.writeText(value).then(() => {
        showToast('Value copied!');
      });
    };

    const copyKey = () => {
      navigator.clipboard.writeText(key).then(() => {
        showToast('Key copied!');
      });
    };

    const copyItem = () => {
      const itemString = JSON.stringify({ [key]: value }, null, 2);
      navigator.clipboard.writeText(itemString).then(() => {
        showToast('Item copied!');
      });
    };

    // Icons (Edit, Delete, Copy)
    const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    div.innerHTML = `
      <div class="item-content">
        <div class="item-key" title="Click to copy key">${escapeHtml(key)}</div>
        <div class="item-value" title="Click to copy">${escapeHtml(value)}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn btn-copy" title="Copy">${copyIcon}</button>
        <button class="icon-btn btn-edit" title="Edit">${editIcon}</button>
        <button class="icon-btn btn-delete" title="Delete">${deleteIcon}</button>
      </div>
    `;

    // Bind events
    div.querySelector('.item-key').addEventListener('click', copyKey);
    div.querySelector('.item-value').addEventListener('click', copyValue);
    div.querySelector('.btn-copy').addEventListener('click', copyItem);
    
    div.querySelector('.btn-edit').addEventListener('click', () => openModal(key, value));
    div.querySelector('.btn-delete').addEventListener('click', () => deleteItem(key));

    return div;
  }

  // Modal & CRUD
  function openModal(key = '', value = '') {
    const isEdit = !!key;
    state.editingKey = isEdit ? key : null;
    
    elements.modal.title.textContent = isEdit ? 'Edit Item' : 'Add New Item';
    elements.modal.keyInput.value = key;
    elements.modal.valueInput.value = value;
    
    // Allow editing key even in edit mode
    elements.modal.keyInput.disabled = false;

    elements.modal.container.classList.remove('hidden');
    
    if (isEdit) {
      elements.modal.valueInput.focus();
    } else {
      elements.modal.keyInput.focus();
    }

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        // Only close if confirm modal is NOT open
        if (!elements.confirm.container.classList.contains('hidden')) return;

        e.stopPropagation();
        e.preventDefault();
        closeModal();
      }
    };
    
    // Clean up previous listener if any
    if (elements.modal.container._cleanupEsc) {
      elements.modal.container._cleanupEsc();
    }
    
    document.addEventListener('keydown', onEsc);
    elements.modal.container._cleanupEsc = () => document.removeEventListener('keydown', onEsc);
  }

  function closeModal() {
    if (elements.modal.container._cleanupEsc) {
      elements.modal.container._cleanupEsc();
      delete elements.modal.container._cleanupEsc;
    }
    elements.modal.container.classList.add('hidden');
  }

  async function saveItem() {
    const newKey = elements.modal.keyInput.value.trim();
    const value = elements.modal.valueInput.value;
    const oldKey = state.editingKey;

    if (!newKey) {
      showToast('Key cannot be empty');
      return;
    }

    // Check for duplicate key
    const currentData = state.storageData[state.currentType];
    if (Object.prototype.hasOwnProperty.call(currentData, newKey) && newKey !== oldKey) {
      const confirmed = await showConfirm(
        'Duplicate Key', 
        `Key "${newKey}" already exists. Do you want to overwrite it?`,
        'Overwrite',
        true
      );
      if (!confirmed) return;
    }

    const type = state.currentType; // 'local' or 'session'
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageType, k, v, oldK) => {
          const storage = storageType === 'local' ? localStorage : sessionStorage;
          
          // If renaming (oldK exists and is different), remove old key first
          if (oldK && oldK !== k) {
            storage.removeItem(oldK);
          }
          
          storage.setItem(k, v);
        },
        args: [type, newKey, value, oldKey]
      });

      closeModal();
      showToast('Saved successfully');
      await loadData(); // Refresh list

      // If it's a new item (not editing), scroll to it
      if (!oldKey) {
        scrollToItem(newKey);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      showToast('Failed to save');
    }
  }

  async function deleteItem(key) {
    const confirmed = await showConfirm(
      'Delete Item', 
      `Are you sure you want to delete "${key}"?`,
      'Delete',
      true
    );
    if (!confirmed) return;

    const type = state.currentType;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageType, k) => {
          if (storageType === 'local') {
            localStorage.removeItem(k);
          } else {
            sessionStorage.removeItem(k);
          }
        },
        args: [type, key]
      });

      showToast('Item deleted');
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('Failed to delete');
    }
  }

  async function clearAllStorage() {
    const type = state.currentType;
    const typeName = type === 'local' ? 'LocalStorage' : 'SessionStorage';
    
    const confirmed = await showConfirm(
      'Clear Storage', 
      `Are you sure you want to clear ALL items from ${typeName}? This action cannot be undone.`,
      'Clear All',
      true
    );
    if (!confirmed) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageType) => {
          if (storageType === 'local') {
            localStorage.clear();
          } else {
            sessionStorage.clear();
          }
        },
        args: [type]
      });

      showToast(`All ${typeName} items cleared`);
      loadData();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      showToast('Failed to clear storage');
    }
  }

  async function exportData() {
    const data = {
      timestamp: new Date().toISOString(),
      url: await getCurrentTabUrl(),
      storage: state.storageData
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `webstorage-pro-export-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Exported successfully');
  }

  async function getCurrentTabUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ? tab.url : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  // Utilities
  function showConfirm(title, message, okText = 'OK', isDanger = false) {
    return new Promise((resolve) => {
      elements.confirm.title.textContent = title;
      elements.confirm.message.textContent = message;
      elements.confirm.okBtn.textContent = okText;
      
      if (isDanger) {
        elements.confirm.okBtn.className = 'danger-btn';
      } else {
        elements.confirm.okBtn.className = 'primary-btn';
      }

      const close = () => {
        elements.confirm.container.classList.add('hidden');
        elements.confirm.cancelBtn.removeEventListener('click', onCancel);
        elements.confirm.okBtn.removeEventListener('click', onOk);
        elements.confirm.container.removeEventListener('click', onOutside);
        document.removeEventListener('keydown', onEsc);
      };

      const onCancel = () => {
        close();
        resolve(false);
      };

      const onOk = () => {
        close();
        resolve(true);
      };

      const onOutside = (e) => {
        if (e.target === elements.confirm.container) {
          close();
          resolve(false);
        }
      };

      const onEsc = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation(); // Stop event bubbling to prevent popup close
          e.preventDefault();
          close();
          resolve(false);
        }
      };

      elements.confirm.cancelBtn.addEventListener('click', onCancel);
      elements.confirm.okBtn.addEventListener('click', onOk);
      elements.confirm.container.addEventListener('click', onOutside);
      document.addEventListener('keydown', onEsc);

      elements.confirm.container.classList.remove('hidden');
    });
  }

  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return String(unsafe);
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      document.body.removeChild(existingToast);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow
    void toast.offsetHeight;
    
    toast.classList.add('show');

    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }
    }, 2000);
  }
});