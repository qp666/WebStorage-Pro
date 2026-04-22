(() => {
  function createLockSyncController({
    lockButton,
    modalContainer,
    confirmContainer,
    showToast,
    storageService,
    isSidePanelMode,
    sidePanelView,
    minSyncIntervalMs = 200,
    getCurrentTabContext,
    onActiveTabChanged,
    getErrorMessage,
    messages = {}
  }) {
    if (
      !lockButton ||
      !modalContainer ||
      !confirmContainer ||
      typeof showToast !== 'function' ||
      !storageService ||
      typeof isSidePanelMode !== 'function' ||
      typeof getCurrentTabContext !== 'function' ||
      typeof onActiveTabChanged !== 'function'
    ) {
      throw new Error('Invalid lock sync controller configuration');
    }
    const getMessage = (key, fallback) => messages[key] || fallback;


    const LOCKED_POPUP_KEY = 'popup_locked_mode';
    const LOCKED_TAB_IDS_KEY = 'popup_locked_tab_ids';
    const LEGACY_LOCKED_TAB_ID_KEY = 'popup_locked_tab_id';

    const state = {
      isLocked: false,
      lockedTabIds: [],
      syncCleanup: null
    };

    function normalizeLockedTabIds(data) {
      const rawList = Array.isArray(data[LOCKED_TAB_IDS_KEY]) ? data[LOCKED_TAB_IDS_KEY] : [];
      const validList = rawList.filter((id) => typeof id === 'number');
      if (validList.length > 0) {
        return [...new Set(validList)];
      }

      const legacyId = data[LEGACY_LOCKED_TAB_ID_KEY];
      if (typeof legacyId === 'number') {
        return [legacyId];
      }
      return [];
    }

    function updateLockButton() {
      lockButton.classList.toggle('active', state.isLocked);
      lockButton.title = state.isLocked ? 'Unlock popup' : 'Lock popup';
    }

    async function refreshLockStateFromStorage() {
      const [stored, activeTab] = await Promise.all([
        chrome.storage.local.get([LOCKED_POPUP_KEY, LOCKED_TAB_IDS_KEY, LEGACY_LOCKED_TAB_ID_KEY]),
        storageService.getActiveTab()
      ]);
      const currentTabId = activeTab && typeof activeTab.id === 'number' ? activeTab.id : null;

      const lockedTabIds = normalizeLockedTabIds(stored);
      state.lockedTabIds = lockedTabIds;
      const globalLocked = typeof stored[LOCKED_POPUP_KEY] === 'boolean'
        ? stored[LOCKED_POPUP_KEY]
        : localStorage.getItem(LOCKED_POPUP_KEY) === '1';

      state.isLocked = globalLocked && currentTabId !== null && lockedTabIds.includes(currentTabId);
      updateLockButton();
    }

    async function openSidePanel(targetTabId = null) {
      try {
        const tab = await storageService.getActiveTab();
        const resolvedTabId = typeof targetTabId === 'number'
          ? targetTabId
          : (tab && typeof tab.id === 'number' ? tab.id : null);
        if (resolvedTabId === null) return false;

        await storageService.enableSidePanel(resolvedTabId, `popup/popup.html?view=${sidePanelView}`);
        await storageService.openSidePanel(resolvedTabId);
        return true;
      } catch (error) {
        console.error('Failed to open side panel:', error);
        if (typeof getErrorMessage === 'function') {
          showToast(getErrorMessage(error, getMessage('SIDEPANEL_OPEN_FAILED', 'Failed to open Side Panel')), 'error');
        }
        return false;
      }
    }

    async function closeSidePanelIfNeeded() {
      if (!isSidePanelMode()) return;
      try {
        const tab = await storageService.getActiveTab();
        if (!tab || typeof tab.id !== 'number') return;
        await storageService.disableSidePanel(tab.id);
      } catch (error) {
        console.error('Failed to close side panel:', error);
      } finally {
        window.close();
      }
    }

    function closePopupIfNeeded() {
      if (isSidePanelMode()) return;
      window.close();
    }

    async function toggleLockMode() {
      const tab = await storageService.getActiveTab();
      const activeTabId = tab && typeof tab.id === 'number' ? tab.id : null;
      if (activeTabId === null) {
        showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
        return;
      }

      const shouldLock = !state.isLocked;
      if (shouldLock) {
        const opened = await openSidePanel(activeTabId);
        if (!opened) {
          return;
        }

        const nextLockedTabIds = [...new Set([...state.lockedTabIds, activeTabId])];
        state.isLocked = true;
        state.lockedTabIds = nextLockedTabIds;
        localStorage.setItem(LOCKED_POPUP_KEY, '1');
        await chrome.storage.local.set({
          [LOCKED_POPUP_KEY]: true,
          [LOCKED_TAB_IDS_KEY]: nextLockedTabIds,
          [LEGACY_LOCKED_TAB_ID_KEY]: null
        });
        updateLockButton();
        showToast(getMessage('LOCK_ENABLED', 'Lock enabled (Side Panel)'), 'success');
        closePopupIfNeeded();
        return;
      }

      const nextLockedTabIds = state.lockedTabIds.filter((id) => id !== activeTabId);
      state.isLocked = false;
      state.lockedTabIds = nextLockedTabIds;
      const hasAnyLockedTab = nextLockedTabIds.length > 0;
      localStorage.setItem(LOCKED_POPUP_KEY, hasAnyLockedTab ? '1' : '0');
      await chrome.storage.local.set({
        [LOCKED_POPUP_KEY]: hasAnyLockedTab,
        [LOCKED_TAB_IDS_KEY]: nextLockedTabIds,
        [LEGACY_LOCKED_TAB_ID_KEY]: null
      });
      updateLockButton();
      await closeSidePanelIfNeeded();
      showToast(getMessage('LOCK_DISABLED', 'Lock disabled'), 'info');
    }

    function initSidePanelAutoSync() {
      if (!isSidePanelMode()) return;

      let syncScheduled = false;
      let syncInFlight = false;
      let syncQueued = false;
      let delayedSyncTimer = null;
      let lastSyncStartedAt = 0;
      let lastContext = getCurrentTabContext();

      const syncTabChange = async () => {
        try {
          const tab = await storageService.getActiveTab();
          if (!tab) return;

          const nextContext = {
            tabId: typeof tab.id === 'number' ? tab.id : null,
            url: typeof tab.url === 'string' ? tab.url : null
          };
          const changed = nextContext.tabId !== lastContext.tabId || nextContext.url !== lastContext.url;
          if (!changed) return;

          await refreshLockStateFromStorage();
          await onActiveTabChanged(nextContext);
          lastContext = nextContext;
        } catch (error) {
          console.error('Failed to sync active tab in side panel:', error);
        }
      };

      const runSyncLoop = async () => {
        if (syncInFlight) {
          syncQueued = true;
          return;
        }

        syncInFlight = true;
        do {
          syncQueued = false;
          await syncTabChange();
        } while (syncQueued);
        syncInFlight = false;
      };

      const scheduleSync = () => {
        if (syncScheduled) return;
        syncScheduled = true;

        const now = Date.now();
        const waitMs = Math.max(0, minSyncIntervalMs - (now - lastSyncStartedAt));
        const run = () => {
          queueMicrotask(async () => {
            syncScheduled = false;
            lastSyncStartedAt = Date.now();
            await runSyncLoop();
          });
        };

        if (waitMs === 0) {
          run();
          return;
        }

        delayedSyncTimer = window.setTimeout(() => {
          delayedSyncTimer = null;
          run();
        }, waitMs);
      };

      const onVisibilityChange = () => {
        if (!document.hidden) scheduleSync();
      };
      const onWindowFocus = () => scheduleSync();
      const onTabActivated = () => scheduleSync();
      const onTabUpdated = (_tabId, changeInfo) => {
        if (changeInfo.status === 'loading' || changeInfo.status === 'complete' || typeof changeInfo.url === 'string') {
          scheduleSync();
        }
      };
      const onWindowChanged = () => scheduleSync();

      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('focus', onWindowFocus);
      chrome.tabs.onActivated.addListener(onTabActivated);
      chrome.tabs.onUpdated.addListener(onTabUpdated);
      chrome.windows.onFocusChanged.addListener(onWindowChanged);

      state.syncCleanup = () => {
        if (delayedSyncTimer !== null) {
          clearTimeout(delayedSyncTimer);
          delayedSyncTimer = null;
        }
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', onWindowFocus);
        if (chrome.tabs.onActivated.hasListener(onTabActivated)) {
          chrome.tabs.onActivated.removeListener(onTabActivated);
        }
        if (chrome.tabs.onUpdated.hasListener(onTabUpdated)) {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
        }
        if (chrome.windows.onFocusChanged.hasListener(onWindowChanged)) {
          chrome.windows.onFocusChanged.removeListener(onWindowChanged);
        }
      };

      window.addEventListener('beforeunload', () => {
        if (state.syncCleanup) {
          state.syncCleanup();
          state.syncCleanup = null;
        }
      });

      scheduleSync();
    }

    async function initLockMode() {
      await refreshLockStateFromStorage();
      document.addEventListener('keydown', (e) => {
        const modalVisible = !modalContainer.classList.contains('hidden');
        const confirmVisible = !confirmContainer.classList.contains('hidden');

        if (state.isLocked && e.key === 'Escape' && !modalVisible && !confirmVisible) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }

    function bindEvents() {
      lockButton.addEventListener('click', toggleLockMode);
    }

    return {
      initLockMode,
      initSidePanelAutoSync,
      bindEvents,
      isSidePanelMode
    };
  }

  window.createLockSyncController = createLockSyncController;
})();
