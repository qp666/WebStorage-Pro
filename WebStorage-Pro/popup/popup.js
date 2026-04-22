document.addEventListener('DOMContentLoaded', () => {
  const popupConfig = window.POPUP_CONFIG || {};
  const TOAST_MESSAGES = popupConfig.TOAST_MESSAGES || {};
  const ERROR_MESSAGES = popupConfig.ERROR_MESSAGES || {};
  const SIDEPANEL_VIEW = 'sidepanel';
  const SEARCH_DEBOUNCE_MS = popupConfig.CONSTANTS?.SEARCH_DEBOUNCE_MS ?? 150;
  const SIDEPANEL_MIN_SYNC_INTERVAL_MS = popupConfig.CONSTANTS?.SIDEPANEL_MIN_SYNC_INTERVAL_MS ?? 200;
  const STORAGE_WATCH_INTERVAL_MS = popupConfig.CONSTANTS?.STORAGE_WATCH_INTERVAL_MS ?? 1200;
  const UNDO_WINDOW_MS = popupConfig.CONSTANTS?.UNDO_WINDOW_MS ?? 10000;

  function getMessage(key, fallback) {
    return TOAST_MESSAGES[key] || fallback;
  }

  function getErrorMessage(error, fallback) {
    if (error && typeof error === 'object' && typeof error.code === 'string') {
      return ERROR_MESSAGES[error.code] || fallback;
    }
    return fallback;
  }

  // State
  const state = {
    currentType: 'local', // 'local' or 'session'
    storageData: {
      local: {},
      session: {}
    },
    searchQuery: '',
    isSelectionMode: false,
    selectedKeys: [],
    selectableCount: 0,
    selectedVisibleCount: 0,
    allVisibleSelected: false,
    watchTimer: null,
    watchInFlight: false,
    activeChangeSet: null,
    changeResetTimer: null,
    undoEntry: null,
    undoTimer: null,
    currentTabId: null,
    currentTabUrl: null,
    searchDebounceTimer: null
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
    selectModeBtn: document.getElementById('select-mode-btn'),
    bulkActionsBar: document.getElementById('bulk-actions-bar'),
    bulkSelectAllToggle: document.getElementById('bulk-select-all-toggle'),
    bulkSelectedCount: document.getElementById('bulk-selected-count'),
    bulkCopyBtn: document.getElementById('bulk-copy-btn'),
    bulkExportBtn: document.getElementById('bulk-export-btn'),
    bulkDeleteBtn: document.getElementById('bulk-delete-btn'),
    bulkCancelBtn: document.getElementById('bulk-cancel-btn'),
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
      modeSingleBtn: document.getElementById('modal-mode-single'),
      modeBulkBtn: document.getElementById('modal-mode-bulk'),
      singleEditor: document.getElementById('single-editor'),
      bulkEditor: document.getElementById('bulk-editor'),
      jsonObjectInput: document.getElementById('item-json-object'),
      keyInput: document.getElementById('item-key'),
      valueInput: document.getElementById('item-value'),
      bulkJsonInput: document.getElementById('item-bulk-json'),
      bulkConflictSelect: document.getElementById('item-bulk-conflict'),
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

  const uiServices = createUiServices({
    confirmElements: elements.confirm
  });
  const { showToast, showConfirm } = uiServices;

  const listController = createStorageListController({
    listElement: elements.list,
    showToast,
    escapeHtml: uiServices.escapeHtml,
    messages: TOAST_MESSAGES,
    onEdit: (key, value) => modalController.open(key, value),
    onDelete: (key) => deleteItem(key),
    onSelectionChange: handleSelectionChange
  });

  const modalController = createModalFormController({
    modalElements: elements.modal,
    confirmContainer: elements.confirm.container,
    showToast,
    messages: TOAST_MESSAGES,
    onSubmit: handleModalSubmit
  });
  const storageService = createStorageService();
  const lockSyncController = createLockSyncController({
    lockButton: elements.pinBtn,
    modalContainer: elements.modal.container,
    confirmContainer: elements.confirm.container,
    showToast,
    storageService,
    isSidePanelMode,
    sidePanelView: SIDEPANEL_VIEW,
    minSyncIntervalMs: SIDEPANEL_MIN_SYNC_INTERVAL_MS,
    getErrorMessage,
    messages: TOAST_MESSAGES,
    getCurrentTabContext: () => ({
      tabId: state.currentTabId,
      url: state.currentTabUrl
    }),
    onActiveTabChanged: async () => {
      await loadData();
    }
  });

  // Initialize
  init();

  async function init() {
    await initLayoutMode();
    await lockSyncController.initLockMode();
    initTheme();
    bindEvents();

    await loadData();
    startStorageWatcher();
    lockSyncController.initSidePanelAutoSync();
  }

  function detectStorageChanges(prevData, nextData) {
    const prevEntries = prevData || {};
    const nextEntries = nextData || {};
    const addedKeys = [];
    const updatedKeys = [];
    const deletedKeys = [];

    const prevKeys = Object.keys(prevEntries);
    const nextKeys = Object.keys(nextEntries);
    const prevKeySet = new Set(prevKeys);
    const nextKeySet = new Set(nextKeys);

    nextKeys.forEach((key) => {
      if (!prevKeySet.has(key)) {
        addedKeys.push(key);
        return;
      }
      if (prevEntries[key] !== nextEntries[key]) {
        updatedKeys.push(key);
      }
    });

    prevKeys.forEach((key) => {
      if (!nextKeySet.has(key)) {
        deletedKeys.push(key);
      }
    });

    return { addedKeys, updatedKeys, deletedKeys };
  }

  function hasAnyChange(changeSet) {
    return (changeSet.addedKeys.length + changeSet.updatedKeys.length + changeSet.deletedKeys.length) > 0;
  }

  function getPreferredScrollKey(changeSet) {
    if (!changeSet) return null;
    if (Array.isArray(changeSet.addedKeys) && changeSet.addedKeys.length > 0) {
      return changeSet.addedKeys[0];
    }
    if (Array.isArray(changeSet.updatedKeys) && changeSet.updatedKeys.length > 0) {
      return changeSet.updatedKeys[0];
    }
    return null;
  }

  function applyTransientChanges(changeSet, options = {}) {
    if (!changeSet || !hasAnyChange(changeSet)) return;
    const { scrollKey = null } = options;
    state.activeChangeSet = {
      addedKeys: Array.isArray(changeSet.addedKeys) ? changeSet.addedKeys : [],
      updatedKeys: Array.isArray(changeSet.updatedKeys) ? changeSet.updatedKeys : [],
      deletedKeys: Array.isArray(changeSet.deletedKeys) ? changeSet.deletedKeys : []
    };
    renderCurrentList();
    const finalScrollKey = scrollKey || getPreferredScrollKey(state.activeChangeSet);
    if (finalScrollKey) {
      // Make sure the changed item is visible with its transient style.
      window.setTimeout(() => {
        listController.scrollToItem(finalScrollKey);
      }, 20);
    }
  }

  function clearUndoEntry() {
    state.undoEntry = null;
    if (state.undoTimer) {
      clearTimeout(state.undoTimer);
      state.undoTimer = null;
    }
  }

  function withUndoHint(message) {
    return `${message} Click Undo to restore.`;
  }

  function registerUndo({ storageType, beforeData, successMessage }) {
    const undoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = Date.now() + UNDO_WINDOW_MS;
    state.undoEntry = {
      id: undoId,
      storageType,
      beforeData: { ...(beforeData || {}) },
      expiresAt
    };
    if (state.undoTimer) {
      clearTimeout(state.undoTimer);
      state.undoTimer = null;
    }
    state.undoTimer = window.setTimeout(() => {
      if (state.undoEntry && state.undoEntry.id === undoId) {
        state.undoEntry = null;
        state.undoTimer = null;
      }
    }, UNDO_WINDOW_MS);

    showToast(successMessage, 'success', {
      actionText: getMessage('UNDO_ACTION', 'Undo'),
      duration: UNDO_WINDOW_MS,
      onAction: async () => {
        await applyUndo(undoId);
      }
    });
  }

  async function applyUndo(undoId) {
    if (!state.undoEntry || state.undoEntry.id !== undoId) {
      showToast(getMessage('UNDO_EXPIRED', 'Undo expired'), 'info');
      return;
    }
    if (Date.now() > state.undoEntry.expiresAt) {
      clearUndoEntry();
      showToast(getMessage('UNDO_EXPIRED', 'Undo expired'), 'info');
      return;
    }

    const { storageType, beforeData } = state.undoEntry;
    clearUndoEntry();
    const currentData = { ...(state.storageData[storageType] || {}) };
    try {
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return;
      }
      await storageService.replaceStorageData(tab.id, storageType, beforeData);
      await loadData();
      if (state.currentType === storageType) {
        const changeSet = detectStorageChanges(currentData, beforeData);
        applyTransientChanges(changeSet);
      }
      showToast(getMessage('UNDO_SUCCESS', 'Changes reverted'), 'success');
    } catch (error) {
      console.error('Failed to undo:', error);
      showToast(getMessage('UNDO_FAILED', 'Failed to undo'), 'error');
    }
  }

  function scheduleChangeReset() {
    if (state.changeResetTimer) {
      clearTimeout(state.changeResetTimer);
      state.changeResetTimer = null;
    }

    state.changeResetTimer = window.setTimeout(() => {
      state.activeChangeSet = null;
      state.changeResetTimer = null;
      renderCurrentList();
    }, 2000);
  }

  function startStorageWatcher() {
    if (state.watchTimer) {
      clearInterval(state.watchTimer);
      state.watchTimer = null;
    }

    state.watchTimer = window.setInterval(async () => {
      if (state.watchInFlight) return;
      if (document.hidden) return;
      if (!state.currentTabId || elements.modal.container.classList.contains('hidden') === false) return;

      state.watchInFlight = true;
      try {
        const tab = await storageService.getActiveTab();
        if (!tab || typeof tab.id !== 'number') return;
        if (storageService.isRestrictedUrl(tab.url)) return;
        if (state.currentTabId !== tab.id) return;

        const latestData = await storageService.readStorageData(tab.id);
        const localChanges = detectStorageChanges(state.storageData.local, latestData.local);
        const sessionChanges = detectStorageChanges(state.storageData.session, latestData.session);
        const hasChanges = hasAnyChange(localChanges) || hasAnyChange(sessionChanges);
        if (!hasChanges) return;

        state.storageData = latestData;
        const currentChangeSet = state.currentType === 'local' ? localChanges : sessionChanges;
        updateTabBadges();
        applyTransientChanges(currentChangeSet);
      } catch {
        // Silent fail for background watch to avoid noisy toasts.
      } finally {
        state.watchInFlight = false;
      }
    }, STORAGE_WATCH_INTERVAL_MS);
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
    lockSyncController.bindEvents();

    // Theme Toggle
    elements.themeBtn.addEventListener('click', toggleTheme);

    // Tab Switching
    elements.tabs.local.addEventListener('click', () => switchTab('local'));
    elements.tabs.session.addEventListener('click', () => switchTab('session'));

    // Search
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      toggleClearBtn();
      if (state.searchDebounceTimer) {
        clearTimeout(state.searchDebounceTimer);
      }
      state.searchDebounceTimer = window.setTimeout(() => {
        renderCurrentList();
        state.searchDebounceTimer = null;
      }, SEARCH_DEBOUNCE_MS);
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      if (state.searchDebounceTimer) {
        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = null;
      }
      elements.searchInput.value = '';
      state.searchQuery = '';
      toggleClearBtn();
      renderCurrentList();
    });

    // Refresh
    elements.refreshBtn.addEventListener('click', () => loadData(true));

    // Export
    elements.exportBtn.addEventListener('click', exportData);

    // Clear All
    elements.clearAllBtn.addEventListener('click', clearAllStorage);
    elements.selectModeBtn.addEventListener('click', () => {
      listController.setSelectionMode(!state.isSelectionMode);
      renderCurrentList();
    });
    elements.bulkCancelBtn.addEventListener('click', () => {
      listController.setSelectionMode(false);
      renderCurrentList();
    });
    elements.bulkSelectAllToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        listController.selectAllFiltered();
      } else {
        listController.clearSelection();
      }
      renderCurrentList();
    });
    elements.bulkCopyBtn.addEventListener('click', copySelectedItems);
    elements.bulkExportBtn.addEventListener('click', exportSelectedItems);
    elements.bulkDeleteBtn.addEventListener('click', deleteSelectedItems);

    // Add Item
    elements.addBtn.addEventListener('click', () => modalController.open());
    modalController.bindEvents();
  }

  function toggleClearBtn() {
    if (state.searchQuery) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
    }
  }

  function switchTab(type) {
    if (state.currentType !== type && state.isSelectionMode) {
      listController.setSelectionMode(false);
    }
    state.currentType = type;
    
    // Update Tab UI
    if (type === 'local') {
      elements.tabs.local.classList.add('active');
      elements.tabs.session.classList.remove('active');
    } else {
      elements.tabs.local.classList.remove('active');
      elements.tabs.session.classList.add('active');
    }

    renderCurrentList();
  }

  async function loadData(showToastOnSuccess = false) {
    // Only set loading if it's an initial load or manual refresh
    // Skipping setLoading(true) for auto-reload after save keeps UI stable
    if (showToastOnSuccess || !state.storageData.local) {
      setLoading(true);
    }
    
    try {
      const tab = await storageService.getActiveTab();
      if (!tab) {
        showError(getMessage('NO_ACTIVE_TAB', 'No active tab found'));
        return;
      }

      state.currentTabId = typeof tab.id === 'number' ? tab.id : null;
      state.currentTabUrl = typeof tab.url === 'string' ? tab.url : null;

      // Check if we can script this tab
      if (storageService.isRestrictedUrl(tab.url)) {
        showError(getMessage('RESTRICTED_PAGE', 'Cannot access storage on system pages.'));
        return;
      }

      state.storageData = await storageService.readStorageData(tab.id);
      setUiInteractive(true);
      updateTabBadges();
      renderCurrentList();
      if (showToastOnSuccess) {
        showToast(getMessage('REFRESHED_SUCCESS', 'Refreshed successfully'), 'success');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showError(getErrorMessage(error, getMessage('STORAGE_LOAD_FAILED', 'Failed to load storage data. Page might be restricted.')));
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (isLoading) {
      elements.list.innerHTML = '<div class="empty-state">Loading...</div>';
    }
  }

  function showError(msg) {
    elements.list.innerHTML = `<div class="empty-state" style="color: var(--danger-color)">${msg}</div>`;
    setUiInteractive(false);
  }

  function setUiInteractive(enabled) {
    elements.addBtn.disabled = !enabled;
    elements.clearAllBtn.disabled = !enabled;
    elements.exportBtn.disabled = !enabled;
    elements.selectModeBtn.disabled = !enabled;
    elements.searchInput.disabled = !enabled;
    elements.clearSearchBtn.disabled = !enabled;
    elements.bulkCopyBtn.disabled = !enabled || state.selectedKeys.length === 0;
    elements.bulkExportBtn.disabled = !enabled || state.selectedKeys.length === 0;
    elements.bulkDeleteBtn.disabled = !enabled || state.selectedKeys.length === 0;
    elements.bulkSelectAllToggle.disabled = !enabled || state.selectableCount === 0;
    elements.bulkSelectAllToggle.checked = enabled && state.selectableCount > 0 && state.allVisibleSelected;
    elements.bulkSelectAllToggle.indeterminate = enabled
      && state.selectedVisibleCount > 0
      && !state.allVisibleSelected;
    elements.bulkCancelBtn.disabled = !enabled;

    elements.tabs.local.style.pointerEvents = enabled ? 'auto' : 'none';
    elements.tabs.session.style.pointerEvents = enabled ? 'auto' : 'none';
    elements.tabs.local.style.opacity = enabled ? '1' : '0.5';
    elements.tabs.session.style.opacity = enabled ? '1' : '0.5';
  }

  function updateTabBadges() {
    const localCount = Object.keys(state.storageData.local || {}).length;
    const sessionCount = Object.keys(state.storageData.session || {}).length;

    elements.tabs.badgeLocal.textContent = `${localCount} items`;
    elements.tabs.badgeSession.textContent = `${sessionCount} items`;
  }

  function renderCurrentList() {
    const data = state.storageData[state.currentType] || {};
    const changeSet = state.activeChangeSet;
    listController.render(data, state.searchQuery, changeSet || undefined);
    if (changeSet && hasAnyChange(changeSet)) {
      scheduleChangeReset();
    }
    updateBulkActionsUi();
  }

  function handleSelectionChange({
    isSelectionMode,
    selectedCount,
    selectedKeys,
    selectableCount = 0,
    selectedVisibleCount = 0,
    allVisibleSelected = false
  }) {
    state.isSelectionMode = isSelectionMode;
    state.selectedKeys = selectedKeys;
    state.selectableCount = selectableCount;
    state.selectedVisibleCount = selectedVisibleCount;
    state.allVisibleSelected = allVisibleSelected;
    updateBulkActionsUi(selectedCount);
  }

  function updateBulkActionsUi(selectedCount = state.selectedKeys.length) {
    elements.selectModeBtn.textContent = state.isSelectionMode
      ? getMessage('SELECT_MODE_ACTIVE', 'Selecting...')
      : getMessage('SELECT_MODE', 'Select');
    elements.bulkActionsBar.classList.toggle('hidden', !state.isSelectionMode);
    elements.bulkSelectedCount.textContent = `${selectedCount} ${getMessage('SELECTED_SUFFIX', 'selected')}`;
    const disabled = selectedCount === 0;
    elements.bulkCopyBtn.disabled = disabled;
    elements.bulkExportBtn.disabled = disabled;
    elements.bulkDeleteBtn.disabled = disabled;
    elements.bulkSelectAllToggle.disabled = state.selectableCount === 0;
    elements.bulkSelectAllToggle.checked = state.selectableCount > 0 && state.allVisibleSelected;
    elements.bulkSelectAllToggle.indeterminate = state.selectedVisibleCount > 0 && !state.allVisibleSelected;
  }

  function tryCopyText(text, successMessage) {
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!copied) {
        throw new Error('execCommand copy failed');
      }
    };

    return Promise.resolve()
      .then(async () => {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopy();
        }
      })
      .catch(() => {
        fallbackCopy();
      })
      .then(() => showToast(successMessage, 'success'))
      .catch((error) => {
        console.error('Bulk copy failed:', error);
        showToast(getMessage('COPY_FAILED', 'Copy failed'), 'error');
      });
  }

  function getSelectedEntries() {
    return listController.getSelectedEntries();
  }

  function copySelectedItems() {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    const payload = Object.fromEntries(entries);
    const text = JSON.stringify(payload, null, 2);
    tryCopyText(text, getMessage('COPY_SUCCESS_SELECTED', 'Selected items copied!'));
  }

  function exportSelectedItems() {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    const data = {
      timestamp: new Date().toISOString(),
      type: state.currentType,
      url: state.currentTabUrl || 'unknown',
      items: Object.fromEntries(entries)
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webstorage-pro-selected-${state.currentType}-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(getMessage('EXPORT_SUCCESS', 'Exported successfully'), 'success');
  }

  async function deleteSelectedItems() {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    const keys = entries.map(([key]) => key);
    const confirmMessageFactory = TOAST_MESSAGES.DELETE_SELECTED_CONFIRM;
    const confirmMessage = typeof confirmMessageFactory === 'function'
      ? confirmMessageFactory(keys.length)
      : `Delete ${keys.length} selected items?`;
    const confirmed = await showConfirm(
      getMessage('DELETE_SELECTED_TITLE', 'Delete Selected'),
      confirmMessage,
      getMessage('DELETE_ACTION', 'Delete'),
      true
    );
    if (!confirmed) return;

    try {
      const type = state.currentType;
      const beforeData = { ...(state.storageData[type] || {}) };
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return;
      }
      await storageService.removeItems(tab.id, type, keys);
      listController.clearSelection();
      listController.setSelectionMode(false);
      const deleteSuccessFactory = TOAST_MESSAGES.DELETE_SELECTED_SUCCESS;
      const deleteSuccessMessage = typeof deleteSuccessFactory === 'function'
        ? deleteSuccessFactory(keys.length)
        : `Deleted ${keys.length} items`;
      await loadData();
      registerUndo({
        storageType: type,
        beforeData,
        successMessage: withUndoHint(deleteSuccessMessage)
      });
    } catch (error) {
      console.error('Failed to delete selected items:', error);
      showToast(getErrorMessage(error, getMessage('STORAGE_DELETE_FAILED', 'Failed to delete')), 'error');
    }
  }

  // Modal submit
  async function handleModalSubmit(payload) {
    if (payload.mode === 'bulk') {
      return handleBulkSubmit(payload);
    }

    const { newKey, value, oldKey } = payload;
    // Check for duplicate key
    const currentData = state.storageData[state.currentType];
    const type = state.currentType; // 'local' or 'session'
    if (Object.prototype.hasOwnProperty.call(currentData, newKey) && newKey !== oldKey) {
      const confirmed = await showConfirm(
        'Duplicate Key', 
        `Key "${newKey}" already exists. Do you want to overwrite it?`,
        'Overwrite',
        true
      );
      if (!confirmed) return false;
    }
    const beforeData = { ...(state.storageData[type] || {}) };
    const shouldRegisterUndo = !!oldKey || Object.prototype.hasOwnProperty.call(beforeData, newKey);
    
    try {
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return false;
      }

      await storageService.upsertItem(tab.id, type, newKey, value, oldKey);

      await loadData(); // Refresh list

      const singleChangeSet = {
        addedKeys: [],
        updatedKeys: [],
        deletedKeys: []
      };
      if (!oldKey) {
        singleChangeSet.addedKeys.push(newKey);
      } else if (oldKey === newKey) {
        singleChangeSet.updatedKeys.push(newKey);
      } else {
        singleChangeSet.deletedKeys.push(oldKey);
        singleChangeSet.addedKeys.push(newKey);
      }
      applyTransientChanges(singleChangeSet, { scrollKey: newKey });
      if (shouldRegisterUndo) {
        const hasExistingTarget = Object.prototype.hasOwnProperty.call(beforeData, newKey);
        let undoMessage;
        if (oldKey && oldKey !== newKey) {
          undoMessage = `Renamed "${oldKey}" to "${newKey}".`;
        } else if (oldKey) {
          undoMessage = `Updated "${newKey}".`;
        } else if (hasExistingTarget) {
          undoMessage = `Overwrote "${newKey}".`;
        } else {
          undoMessage = getMessage('SAVE_SUCCESS', 'Saved successfully');
        }
        registerUndo({
          storageType: type,
          beforeData,
          successMessage: withUndoHint(undoMessage)
        });
      } else {
        showToast(getMessage('SAVE_SUCCESS', 'Saved successfully'), 'success');
      }
      return true;
    } catch (error) {
      console.error('Failed to save:', error);
      showToast(getErrorMessage(error, getMessage('STORAGE_WRITE_FAILED', 'Failed to save')), 'error');
      return false;
    }
  }

  async function handleBulkSubmit({ items, conflictStrategy }) {
    const type = state.currentType;
    const currentData = state.storageData[type] || {};
    const beforeData = { ...currentData };
    try {
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return false;
      }

      const result = await storageService.upsertItems(tab.id, type, items, conflictStrategy);
      await loadData();
      const applied = result?.appliedCount ?? 0;
      const skipped = result?.skippedCount ?? 0;
      const appliedKeys = Array.isArray(result?.appliedKeys) ? result.appliedKeys : [];
      const firstAppliedKey = typeof result?.firstAppliedKey === 'string' ? result.firstAppliedKey : null;
      const bulkChangeSet = {
        addedKeys: [],
        updatedKeys: [],
        deletedKeys: []
      };
      appliedKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(currentData, key)) {
          bulkChangeSet.updatedKeys.push(key);
        } else {
          bulkChangeSet.addedKeys.push(key);
        }
      });
      if (applied > 0) {
        applyTransientChanges(bulkChangeSet, { scrollKey: firstAppliedKey });
      }
      const bulkResultMessage = typeof TOAST_MESSAGES.BULK_IMPORT_RESULT === 'function'
        ? TOAST_MESSAGES.BULK_IMPORT_RESULT(applied, skipped)
        : `Imported ${applied} keys, skipped ${skipped}`;
      const overwroteExisting = conflictStrategy === 'overwrite'
        && appliedKeys.some((key) => Object.prototype.hasOwnProperty.call(beforeData, key));
      if (overwroteExisting) {
        const overwriteCount = appliedKeys.filter((key) => Object.prototype.hasOwnProperty.call(beforeData, key)).length;
        const undoMessage = `Overwrote ${overwriteCount} keys (${applied} applied, ${skipped} skipped).`;
        registerUndo({ storageType: type, beforeData, successMessage: withUndoHint(undoMessage) });
      } else {
        showToast(bulkResultMessage, 'success');
      }
      return true;
    } catch (error) {
      console.error('Failed to bulk save:', error);
      showToast(getErrorMessage(error, getMessage('STORAGE_WRITE_FAILED', 'Failed to save')), 'error');
      return false;
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
      const beforeData = { ...(state.storageData[type] || {}) };
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return;
      }
      await storageService.removeItem(tab.id, type, key);

      await loadData();
      registerUndo({
        storageType: type,
        beforeData,
        successMessage: withUndoHint(`Deleted "${key}".`)
      });
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast(getErrorMessage(error, getMessage('STORAGE_DELETE_FAILED', 'Failed to delete')), 'error');
    }
  }

  async function clearAllStorage() {
    const type = state.currentType;
    const typeName = type === 'local' ? 'LocalStorage' : 'SessionStorage';
    const beforeData = { ...(state.storageData[type] || {}) };
    
    const confirmed = await showConfirm(
      'Clear Storage', 
      `Are you sure you want to clear ALL items from ${typeName}? This action cannot be undone.`,
      'Clear All',
      true
    );
    if (!confirmed) return;

    try {
      const tab = await storageService.getActiveTab();
      if (!tab || typeof tab.id !== 'number') {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return;
      }
      await storageService.clearStorage(tab.id, type);

      const clearMessage = type === 'local'
        ? getMessage('CLEAR_SUCCESS_LOCAL', `All ${typeName} items cleared`)
        : getMessage('CLEAR_SUCCESS_SESSION', `All ${typeName} items cleared`);
      await loadData();
      registerUndo({ storageType: type, beforeData, successMessage: withUndoHint(clearMessage) });
    } catch (error) {
      console.error('Failed to clear storage:', error);
      showToast(getErrorMessage(error, getMessage('STORAGE_CLEAR_FAILED', 'Failed to clear storage')), 'error');
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
    
    showToast(getMessage('EXPORT_SUCCESS', 'Exported successfully'), 'success');
  }

  async function getCurrentTabUrl() {
    try {
      const tab = await storageService.getActiveTab();
      return tab ? tab.url : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

});