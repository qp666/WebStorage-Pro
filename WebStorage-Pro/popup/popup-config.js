(() => {
  const ERROR_CODES = {
    TAB_QUERY_FAILED: 'TAB_QUERY_FAILED',
    SCRIPT_EXECUTION_FAILED: 'SCRIPT_EXECUTION_FAILED',
    SIDEPANEL_CONFIG_FAILED: 'SIDEPANEL_CONFIG_FAILED',
    SIDEPANEL_OPEN_FAILED: 'SIDEPANEL_OPEN_FAILED'
  };

  const CONSTANTS = {
    SEARCH_DEBOUNCE_MS: 150,
    SIDEPANEL_MIN_SYNC_INTERVAL_MS: 200,
    STORAGE_WATCH_INTERVAL_MS: 1200,
    UNDO_WINDOW_MS: 10000
  };

  const TOAST_MESSAGES = {
    NO_ACTIVE_TAB: 'No active tab found',
    LOCK_ENABLED: 'Lock enabled (Side Panel)',
    LOCK_DISABLED: 'Lock disabled',
    SIDEPANEL_OPEN_FAILED: 'Failed to open Side Panel',
    REFRESHED_SUCCESS: 'Refreshed successfully',
    SAVE_SUCCESS: 'Saved successfully',
    DELETE_SUCCESS: 'Item deleted',
    CLEAR_SUCCESS_LOCAL: 'All LocalStorage items cleared',
    CLEAR_SUCCESS_SESSION: 'All SessionStorage items cleared',
    EXPORT_SUCCESS: 'Exported successfully',
    COPY_SUCCESS_VALUE: 'Value copied!',
    COPY_SUCCESS_KEY: 'Key copied!',
    COPY_SUCCESS_ITEM: 'Item copied!',
    COPY_SUCCESS_SELECTED: 'Selected items copied!',
    COPY_FAILED: 'Copy failed',
    STORAGE_LOAD_FAILED: 'Failed to load storage data. Page might be restricted.',
    RESTRICTED_PAGE: 'Cannot access storage on system pages.',
    STORAGE_WRITE_FAILED: 'Failed to save',
    STORAGE_DELETE_FAILED: 'Failed to delete',
    STORAGE_CLEAR_FAILED: 'Failed to clear storage',
    INVALID_JSON: 'Invalid JSON',
    JSON_OBJECT_REQUIRED: 'Use a JSON object, e.g. {"key":"value"}',
    JSON_OBJECT_EMPTY: 'Object has no keys',
    JSON_OBJECT_MULTI_KEYS: (count) => `Using first of ${count} keys`,
    KEY_REQUIRED: 'Key cannot be empty',
    VALUE_REQUIRED: 'Value cannot be empty',
    BULK_JSON_REQUIRED: 'Bulk JSON cannot be empty',
    BULK_IMPORT_RESULT: (applied, skipped) => `Imported ${applied} keys, skipped ${skipped}`,
    SELECT_MODE: 'Select',
    SELECT_MODE_ACTIVE: 'Selecting...',
    SELECTED_SUFFIX: 'selected',
    UNDO_ACTION: 'Undo (10s)',
    UNDO_SUCCESS: 'Undo completed',
    UNDO_EXPIRED: 'Undo window expired',
    UNDO_FAILED: 'Failed to undo',
    DELETE_SELECTED_TITLE: 'Delete Selected',
    DELETE_SELECTED_CONFIRM: (count) => `Delete ${count} selected items?`,
    DELETE_ACTION: 'Delete',
    DELETE_SELECTED_SUCCESS: (count) => `Deleted ${count} items`
  };

  const ERROR_MESSAGES = {
    [ERROR_CODES.TAB_QUERY_FAILED]: TOAST_MESSAGES.NO_ACTIVE_TAB,
    [ERROR_CODES.SCRIPT_EXECUTION_FAILED]: TOAST_MESSAGES.STORAGE_LOAD_FAILED,
    [ERROR_CODES.SIDEPANEL_CONFIG_FAILED]: TOAST_MESSAGES.SIDEPANEL_OPEN_FAILED,
    [ERROR_CODES.SIDEPANEL_OPEN_FAILED]: TOAST_MESSAGES.SIDEPANEL_OPEN_FAILED
  };

  window.POPUP_CONFIG = {
    ERROR_CODES,
    CONSTANTS,
    TOAST_MESSAGES,
    ERROR_MESSAGES
  };
})();
