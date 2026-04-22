(() => {
  function createStorageService() {
    const { ERROR_CODES = {} } = window.POPUP_CONFIG || {};

    function createStorageError(code, cause) {
      const err = new Error(code);
      err.code = code;
      if (cause) err.cause = cause;
      return err;
    }

    function isRestrictedUrl(url) {
      if (typeof url !== 'string') return true;
      return url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:');
    }

    async function getActiveTab() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
      } catch (error) {
        throw createStorageError(ERROR_CODES.TAB_QUERY_FAILED || 'TAB_QUERY_FAILED', error);
      }
    }

    async function readStorageData(tabId) {
      let results;
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({
            local: { ...localStorage },
            session: { ...sessionStorage }
          })
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      return { local: {}, session: {} };
    }

    async function upsertItem(tabId, storageType, key, value, oldKey) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (type, k, v, previousKey) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            if (previousKey && previousKey !== k) {
              storage.removeItem(previousKey);
            }
            storage.setItem(k, v);
          },
          args: [storageType, key, value, oldKey]
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function upsertItems(tabId, storageType, items, conflictStrategy = 'overwrite') {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (type, entries, strategy) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            let appliedCount = 0;
            let skippedCount = 0;
            let firstAppliedKey = null;
            const appliedKeys = [];

            entries.forEach(([key, value]) => {
              const exists = storage.getItem(key) !== null;
              if (strategy === 'skip' && exists) {
                skippedCount += 1;
                return;
              }
              storage.setItem(key, value);
              if (firstAppliedKey === null) {
                firstAppliedKey = key;
              }
              appliedKeys.push(key);
              appliedCount += 1;
            });

            return { appliedCount, skippedCount, firstAppliedKey, appliedKeys };
          },
          args: [storageType, items, conflictStrategy]
        });
        return results?.[0]?.result || { appliedCount: 0, skippedCount: 0, firstAppliedKey: null, appliedKeys: [] };
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function removeItem(tabId, storageType, key) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (type, targetKey) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            storage.removeItem(targetKey);
          },
          args: [storageType, key]
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function removeItems(tabId, storageType, keys) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (type, targetKeys) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            targetKeys.forEach((key) => storage.removeItem(key));
          },
          args: [storageType, keys]
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function clearStorage(tabId, storageType) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (type) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            storage.clear();
          },
          args: [storageType]
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function replaceStorageData(tabId, storageType, data) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (type, nextData) => {
            const storage = type === 'local' ? localStorage : sessionStorage;
            storage.clear();
            Object.entries(nextData || {}).forEach(([key, value]) => {
              storage.setItem(key, String(value));
            });
          },
          args: [storageType, data]
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SCRIPT_EXECUTION_FAILED || 'SCRIPT_EXECUTION_FAILED', error);
      }
    }

    async function enableSidePanel(tabId, path) {
      try {
        await chrome.sidePanel.setOptions({
          tabId,
          path,
          enabled: true
        });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SIDEPANEL_CONFIG_FAILED || 'SIDEPANEL_CONFIG_FAILED', error);
      }
    }

    async function openSidePanel(tabId) {
      try {
        await chrome.sidePanel.open({ tabId });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SIDEPANEL_OPEN_FAILED || 'SIDEPANEL_OPEN_FAILED', error);
      }
    }

    async function disableSidePanel(tabId) {
      try {
        await chrome.sidePanel.setOptions({ tabId, enabled: false });
      } catch (error) {
        throw createStorageError(ERROR_CODES.SIDEPANEL_CONFIG_FAILED || 'SIDEPANEL_CONFIG_FAILED', error);
      }
    }

    return {
      isRestrictedUrl,
      getActiveTab,
      readStorageData,
      upsertItem,
      upsertItems,
      removeItem,
      removeItems,
      clearStorage,
      replaceStorageData,
      enableSidePanel,
      openSidePanel,
      disableSidePanel
    };
  }

  window.createStorageService = createStorageService;
})();
