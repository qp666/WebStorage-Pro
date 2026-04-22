(() => {
  function createUndoController({
    windowMs = 10000,
    showToast,
    storageService,
    getMessage,
    loadData,
    getCurrentType,
    getCurrentDataByType,
    detectStorageChanges,
    applyTransientChanges,
    onUndoShown,
    onUndoTriggered,
    onUndoSucceeded,
    onUndoExpired,
    onUndoFailed
  }) {
    if (
      typeof showToast !== 'function'
      || !storageService
      || typeof getMessage !== 'function'
      || typeof loadData !== 'function'
      || typeof getCurrentType !== 'function'
      || typeof getCurrentDataByType !== 'function'
      || typeof detectStorageChanges !== 'function'
      || typeof applyTransientChanges !== 'function'
    ) {
      throw new Error('Invalid undo controller configuration');
    }

    const state = {
      entry: null,
      timer: null
    };

    function clearEntry() {
      state.entry = null;
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }

    function registerUndo({ storageType, plan, successMessage }) {
      if (!plan || !storageType) return;
      const undoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      state.entry = {
        id: undoId,
        storageType,
        plan,
        expiresAt: Date.now() + windowMs
      };

      if (state.timer) {
        clearTimeout(state.timer);
      }
      state.timer = window.setTimeout(() => {
        if (state.entry && state.entry.id === undoId) {
          state.entry = null;
          state.timer = null;
        }
      }, windowMs);

      showToast(successMessage, 'success', {
        actionText: `Undo (${Math.ceil(windowMs / 1000)}s)`,
        actionCountdownMs: windowMs,
        actionCountdownFormatter: (seconds) => `Undo (${seconds}s)`,
        duration: windowMs,
        onAction: async () => {
          if (typeof onUndoTriggered === 'function') {
            onUndoTriggered({ storageType, mode: plan.mode || 'delta' });
          }
          await applyUndo(undoId);
        }
      });
      if (typeof onUndoShown === 'function') {
        onUndoShown({ storageType, mode: plan.mode || 'delta' });
      }
    }

    async function applyUndo(undoId) {
      if (!state.entry || state.entry.id !== undoId) {
        showToast(getMessage('UNDO_EXPIRED', 'Undo window expired'), 'info');
        if (typeof onUndoExpired === 'function') onUndoExpired();
        return;
      }
      if (Date.now() > state.entry.expiresAt) {
        clearEntry();
        showToast(getMessage('UNDO_EXPIRED', 'Undo window expired'), 'info');
        if (typeof onUndoExpired === 'function') onUndoExpired();
        return;
      }

      const { storageType, plan } = state.entry;
      const beforeUndoData = { ...getCurrentDataByType(storageType) };
      clearEntry();
      try {
        const tab = await storageService.getActiveTab();
        if (!tab || typeof tab.id !== 'number') {
          showToast(getMessage('NO_ACTIVE_TAB', 'No active tab found'), 'error');
          return;
        }
        await storageService.applyStorageUndoPlan(tab.id, storageType, plan);
        await loadData();
        if (getCurrentType() === storageType) {
          const afterUndoData = { ...getCurrentDataByType(storageType) };
          const changeSet = detectStorageChanges(beforeUndoData, afterUndoData);
          applyTransientChanges(changeSet);
        }
        showToast(getMessage('UNDO_SUCCESS', 'Undo completed'), 'success');
        if (typeof onUndoSucceeded === 'function') {
          onUndoSucceeded({ storageType, mode: plan.mode || 'delta' });
        }
      } catch (error) {
        console.error('Failed to undo:', error);
        showToast(getMessage('UNDO_FAILED', 'Failed to undo'), 'error');
        if (typeof onUndoFailed === 'function') onUndoFailed(error);
      }
    }

    return {
      registerUndo,
      clearEntry
    };
  }

  window.createUndoController = createUndoController;
})();
