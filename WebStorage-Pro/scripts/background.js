const LOCKED_POPUP_KEY = 'popup_locked_mode';

async function applyLockState(isLocked) {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: isLocked });
  await chrome.action.setPopup({ popup: isLocked ? '' : 'popup/popup.html' });
}

async function syncLockStateFromStorage() {
  const data = await chrome.storage.local.get(LOCKED_POPUP_KEY);
  const isLocked = data[LOCKED_POPUP_KEY] === true;
  await applyLockState(isLocked);
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
  if (areaName !== 'local' || !changes[LOCKED_POPUP_KEY]) return;
  const isLocked = changes[LOCKED_POPUP_KEY].newValue === true;
  applyLockState(isLocked).catch((error) => {
    console.error('Failed to apply lock state on storage change:', error);
  });
});
