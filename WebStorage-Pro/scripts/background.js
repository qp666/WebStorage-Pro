const LOCKED_POPUP_KEY = 'popup_locked_mode';
const LOCKED_TAB_IDS_KEY = 'popup_locked_tab_ids';
const LEGACY_LOCKED_TAB_ID_KEY = 'popup_locked_tab_id';
const SIDEPANEL_PATH = 'popup/popup.html?view=sidepanel';
const lockedSidePanelTabs = new Set();

async function applyLockState(isLocked) {
  // Popup is updated dynamically per active tab.
  // Let browser handle panel opening on action click to preserve user gesture.
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: isLocked });
}

function normalizeLockedTabIds(data) {
  const rawList = Array.isArray(data[LOCKED_TAB_IDS_KEY]) ? data[LOCKED_TAB_IDS_KEY] : [];
  const validList = rawList.filter((id) => typeof id === 'number');
  if (validList.length > 0) return [...new Set(validList)];

  const legacyId = data[LEGACY_LOCKED_TAB_ID_KEY];
  return typeof legacyId === 'number' ? [legacyId] : [];
}

async function applyPerTabSidePanelOptions(lockedTabIds) {
  lockedSidePanelTabs.clear();
  lockedTabIds.forEach((id) => lockedSidePanelTabs.add(id));

  const lockedSet = new Set(lockedTabIds);
  const tabs = await chrome.tabs.query({});
  const updates = tabs
    .filter((tab) => typeof tab.id === 'number')
    .map((tab) => {
      const enabled = lockedSet.has(tab.id);
      return chrome.sidePanel.setOptions({
        tabId: tab.id,
        enabled,
        path: SIDEPANEL_PATH
      });
    });
  await Promise.allSettled(updates);
}

async function applySidePanelForTab(tabId) {
  const data = await chrome.storage.local.get([LOCKED_POPUP_KEY, LOCKED_TAB_IDS_KEY, LEGACY_LOCKED_TAB_ID_KEY]);
  const isLocked = data[LOCKED_POPUP_KEY] === true;
  const lockedTabIds = normalizeLockedTabIds(data);
  const enabled = isLocked && lockedTabIds.includes(tabId);
  await chrome.sidePanel.setOptions({
    tabId,
    enabled,
    path: SIDEPANEL_PATH
  });
}

async function syncLockStateFromStorage() {
  const data = await chrome.storage.local.get([LOCKED_POPUP_KEY, LOCKED_TAB_IDS_KEY, LEGACY_LOCKED_TAB_ID_KEY]);
  const isLocked = data[LOCKED_POPUP_KEY] === true;
  const lockedTabIds = normalizeLockedTabIds(data);
  await applyLockState(isLocked);
  await applyPerTabSidePanelOptions(isLocked ? lockedTabIds : []);
  await updateActionPopupForActiveTab();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function updateActionPopupForActiveTab() {
  const [activeTab, data] = await Promise.all([
    getActiveTab(),
    chrome.storage.local.get([LOCKED_POPUP_KEY, LOCKED_TAB_IDS_KEY, LEGACY_LOCKED_TAB_ID_KEY])
  ]);
  const lockedTabIds = normalizeLockedTabIds(data);
  const activeTabId = activeTab && typeof activeTab.id === 'number' ? activeTab.id : null;
  const isActiveTabLocked = activeTabId !== null && lockedTabIds.includes(activeTabId);
  await chrome.action.setPopup({ popup: isActiveTabLocked ? '' : 'popup/popup.html' });
}

chrome.runtime.onInstalled.addListener(() => {
  syncLockStateFromStorage().catch((error) => {
    console.error('Failed to sync lock state on install:', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncLockStateFromStorage().catch((error) => {
    console.error('Failed to sync lock state on startup:', error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (!changes[LOCKED_POPUP_KEY] && !changes[LOCKED_TAB_IDS_KEY] && !changes[LEGACY_LOCKED_TAB_ID_KEY]) return;

  chrome.storage.local.get([LOCKED_POPUP_KEY, LOCKED_TAB_IDS_KEY, LEGACY_LOCKED_TAB_ID_KEY]).then((data) => {
    const isLocked = data[LOCKED_POPUP_KEY] === true;
    const lockedTabIds = normalizeLockedTabIds(data);
    return applyLockState(isLocked)
      .then(() => applyPerTabSidePanelOptions(isLocked ? lockedTabIds : []))
      .then(() => updateActionPopupForActiveTab());
  }).catch((error) => {
    console.error('Failed to apply lock state on storage change:', error);
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  applySidePanelForTab(activeInfo.tabId)
    .then(() => updateActionPopupForActiveTab())
    .catch((error) => {
    console.error('Failed to update side panel on tab activate:', error);
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  if (typeof tab.id !== 'number') return;
  applySidePanelForTab(tab.id).catch((error) => {
    console.error('Failed to update side panel on tab create:', error);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  applySidePanelForTab(tabId)
    .then(() => updateActionPopupForActiveTab())
    .catch((error) => {
    console.error('Failed to update side panel on tab update:', error);
  });
});

