(() => {
  function createModalFormController({ modalElements, confirmContainer, showToast, messages = {}, onSubmit }) {
    if (!modalElements || typeof onSubmit !== 'function' || typeof showToast !== 'function') {
      throw new Error('Invalid modal controller configuration');
    }

    const state = {
      isSaving: false,
      editingKey: null,
      mode: 'single',
      allowBulk: true,
      escCleanup: null,
      isBound: false
    };

    const getMessage = (key, fallback) => messages[key] || fallback;

    function valueToStorageString(value) {
      if (value === undefined) return '';
      if (value === null) return 'null';
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    }

    function shouldHandlePrimaryEnter(e) {
      return !e.isComposing && e.key === 'Enter' && !e.shiftKey;
    }

    function setMode(mode) {
      if (mode !== 'single' && mode !== 'bulk') return;
      if (mode === 'bulk' && !state.allowBulk) return;

      state.mode = mode;
      modalElements.modeSingleBtn.classList.toggle('active', mode === 'single');
      modalElements.modeBulkBtn.classList.toggle('active', mode === 'bulk');
      modalElements.singleEditor.classList.toggle('hidden', mode !== 'single');
      modalElements.bulkEditor.classList.toggle('hidden', mode !== 'bulk');
      modalElements.saveBtn.textContent = state.isSaving
        ? (mode === 'bulk' ? 'Importing...' : 'Saving...')
        : (mode === 'bulk' ? 'Import' : 'Save');

      if (mode === 'bulk') {
        modalElements.bulkJsonInput.focus();
      } else if (state.editingKey) {
        modalElements.valueInput.focus();
      } else {
        modalElements.jsonObjectInput.focus();
      }
    }

    function setSaving(isSaving) {
      state.isSaving = isSaving;
      modalElements.saveBtn.disabled = isSaving;
      if (isSaving) {
        modalElements.saveBtn.textContent = state.mode === 'bulk' ? 'Importing...' : 'Saving...';
      } else {
        modalElements.saveBtn.textContent = state.mode === 'bulk' ? 'Import' : 'Save';
      }
    }

    function applyJsonObjectToKeyValue() {
      if (state.mode !== 'single') return;
      const raw = modalElements.jsonObjectInput.value.trim();
      if (!raw) return;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        showToast(getMessage('INVALID_JSON', 'Invalid JSON'), 'error');
        return;
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        showToast(getMessage('JSON_OBJECT_REQUIRED', 'Use a JSON object, e.g. {"key":"value"}'), 'error');
        return;
      }

      const keys = Object.keys(parsed);
      if (keys.length === 0) {
        showToast(getMessage('JSON_OBJECT_EMPTY', 'Object has no keys'), 'error');
        return;
      }

      const key = keys[0];
      modalElements.keyInput.value = key;
      modalElements.valueInput.value = valueToStorageString(parsed[key]);

      if (keys.length > 1) {
        const messageFactory = messages.JSON_OBJECT_MULTI_KEYS;
        const message = typeof messageFactory === 'function'
          ? messageFactory(keys.length)
          : `Using first of ${keys.length} keys`;
        showToast(message, 'info');
      }
    }

    function validateModalFields() {
      if (state.mode === 'bulk') {
        const raw = modalElements.bulkJsonInput.value.trim();
        if (!raw) {
          return {
            ok: false,
            message: getMessage('BULK_JSON_REQUIRED', 'Bulk JSON cannot be empty'),
            focusTarget: modalElements.bulkJsonInput
          };
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return {
            ok: false,
            message: getMessage('INVALID_JSON', 'Invalid JSON'),
            focusTarget: modalElements.bulkJsonInput
          };
        }

        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return {
            ok: false,
            message: getMessage('JSON_OBJECT_REQUIRED', 'Use a JSON object, e.g. {"key":"value"}'),
            focusTarget: modalElements.bulkJsonInput
          };
        }

        const keys = Object.keys(parsed);
        if (keys.length === 0) {
          return {
            ok: false,
            message: getMessage('JSON_OBJECT_EMPTY', 'Object has no keys'),
            focusTarget: modalElements.bulkJsonInput
          };
        }

        const items = keys.map((key) => [key, valueToStorageString(parsed[key])]);
        return {
          ok: true,
          mode: 'bulk',
          items,
          conflictStrategy: modalElements.bulkConflictSelect.value || 'overwrite'
        };
      }

      const key = modalElements.keyInput.value.trim();
      const rawValue = modalElements.valueInput.value;
      const value = rawValue.trim();

      if (!key) {
        return {
          ok: false,
          message: getMessage('KEY_REQUIRED', 'Key cannot be empty'),
          focusTarget: modalElements.keyInput
        };
      }

      if (!value) {
        return {
          ok: false,
          message: getMessage('VALUE_REQUIRED', 'Value cannot be empty'),
          focusTarget: modalElements.valueInput
        };
      }

      return {
        ok: true,
        mode: 'single',
        key,
        value: rawValue
      };
    }

    async function attemptSave() {
      if (state.isSaving) return;

      const validation = validateModalFields();
      if (!validation.ok) {
        showToast(validation.message, 'error');
        validation.focusTarget.focus();
        return;
      }

      setSaving(true);
      try {
        const saved = await onSubmit({
          mode: validation.mode,
          newKey: validation.key,
          value: validation.value,
          oldKey: state.editingKey,
          items: validation.items,
          conflictStrategy: validation.conflictStrategy
        });
        if (saved !== false) {
          close();
        }
      } finally {
        setSaving(false);
      }
    }

    function open(key = '', value = '') {
      const isEdit = !!key;
      state.editingKey = isEdit ? key : null;
      state.allowBulk = !isEdit;

      modalElements.title.textContent = isEdit ? 'Edit Item' : 'Add New Item';
      modalElements.jsonObjectInput.value = '';
      modalElements.keyInput.value = key;
      modalElements.valueInput.value = value;
      modalElements.bulkJsonInput.value = '';
      modalElements.bulkConflictSelect.value = 'overwrite';
      modalElements.keyInput.disabled = false;
      modalElements.modeBulkBtn.disabled = isEdit;
      modalElements.modeBulkBtn.title = isEdit ? 'Bulk mode disabled while editing one key' : '';
      setSaving(false);
      modalElements.container.classList.remove('hidden');
      setMode(isEdit ? 'single' : 'single');

      if (state.escCleanup) {
        state.escCleanup();
        state.escCleanup = null;
      }

      const onEsc = (e) => {
        if (e.key !== 'Escape') return;
        if (confirmContainer && !confirmContainer.classList.contains('hidden')) return;
        e.stopPropagation();
        e.preventDefault();
        close();
      };

      document.addEventListener('keydown', onEsc);
      state.escCleanup = () => document.removeEventListener('keydown', onEsc);
    }

    function close() {
      if (state.escCleanup) {
        state.escCleanup();
        state.escCleanup = null;
      }

      modalElements.jsonObjectInput.value = '';
      modalElements.bulkJsonInput.value = '';
      modalElements.container.classList.add('hidden');
      setSaving(false);
      state.editingKey = null;
    }

    function bindEvents() {
      if (state.isBound) return;
      state.isBound = true;

      modalElements.cancelBtn.addEventListener('click', close);
      modalElements.saveBtn.addEventListener('click', attemptSave);
      modalElements.modeSingleBtn.addEventListener('click', () => setMode('single'));
      modalElements.modeBulkBtn.addEventListener('click', () => setMode('bulk'));
      modalElements.jsonObjectInput.addEventListener('blur', applyJsonObjectToKeyValue);
      modalElements.jsonObjectInput.addEventListener('paste', () => {
        window.setTimeout(applyJsonObjectToKeyValue, 0);
      });

      modalElements.keyInput.addEventListener('keydown', (e) => {
        if (state.mode !== 'single') return;
        if (!shouldHandlePrimaryEnter(e) || state.isSaving) return;
        e.preventDefault();
        if (!modalElements.keyInput.value.trim()) return;
        modalElements.valueInput.focus();
      });

      modalElements.valueInput.addEventListener('keydown', (e) => {
        if (state.mode !== 'single') return;
        if (!shouldHandlePrimaryEnter(e) || state.isSaving) return;
        e.preventDefault();
        attemptSave();
      });

      modalElements.jsonObjectInput.addEventListener('keydown', (e) => {
        if (state.mode !== 'single') return;
        if (!shouldHandlePrimaryEnter(e) || state.isSaving) return;
        e.preventDefault();
        attemptSave();
      });

      modalElements.container.addEventListener('click', (e) => {
        if (e.target === modalElements.container) {
          close();
        }
      });
    }

    return {
      bindEvents,
      open,
      close
    };
  }

  window.createModalFormController = createModalFormController;
})();
