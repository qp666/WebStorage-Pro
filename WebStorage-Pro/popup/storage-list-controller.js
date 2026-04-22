(() => {
  function createStorageListController({
    listElement,
    showToast,
    escapeHtml,
    messages = {},
    onEdit,
    onDelete,
    onSelectionChange
  }) {
    if (!listElement || typeof showToast !== 'function' || typeof escapeHtml !== 'function') {
      throw new Error('Invalid storage list controller configuration');
    }

    const state = {
      isSelectionMode: false,
      selectedKeys: new Set(),
      latestData: {},
      filteredKeys: []
    };

    const getMessage = (key, fallback) => messages[key] || fallback;

    function notifySelectionChange() {
      if (typeof onSelectionChange !== 'function') return;
      const selectableCount = state.filteredKeys.length;
      const selectedVisibleCount = state.filteredKeys.reduce((count, key) => (
        state.selectedKeys.has(key) ? count + 1 : count
      ), 0);
      onSelectionChange({
        isSelectionMode: state.isSelectionMode,
        selectedCount: state.selectedKeys.size,
        selectedKeys: Array.from(state.selectedKeys),
        selectableCount,
        selectedVisibleCount,
        allVisibleSelected: selectableCount > 0 && selectedVisibleCount === selectableCount
      });
    }

    function fallbackCopyText(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        document.body.removeChild(textarea);
      }
      if (!copied) {
        throw new Error('execCommand copy failed');
      }
    }

    async function copyText(text, successMessage) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopyText(text);
        }
        showToast(successMessage, 'success');
      } catch (error) {
        try {
          fallbackCopyText(text);
          showToast(successMessage, 'success');
        } catch (fallbackError) {
          console.error('Copy failed:', error, fallbackError);
          showToast(getMessage('COPY_FAILED', 'Copy failed'), 'error');
        }
      }
    }

    function isChecked(key) {
      return state.selectedKeys.has(key);
    }

    function toggleKeySelection(key, selected) {
      if (selected) {
        state.selectedKeys.add(key);
      } else {
        state.selectedKeys.delete(key);
      }
      notifySelectionChange();
    }

    function createItemElement(key, value, changeType = '') {
      const div = document.createElement('div');
      div.className = state.isSelectionMode ? 'storage-item selection-mode' : 'storage-item';
      if (changeType === 'added') {
        div.classList.add('item-change-added');
      } else if (changeType === 'updated') {
        div.classList.add('item-change-updated');
      }

      const copyValue = () => {
        copyText(value, getMessage('COPY_SUCCESS_VALUE', 'Value copied!'));
      };

      const copyKey = () => {
        copyText(key, getMessage('COPY_SUCCESS_KEY', 'Key copied!'));
      };

      const copyItem = () => {
        const itemString = JSON.stringify({ [key]: value }, null, 2);
        copyText(itemString, getMessage('COPY_SUCCESS_ITEM', 'Item copied!'));
      };

      const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
      const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

      div.innerHTML = `
        ${state.isSelectionMode ? `<input class="item-select" type="checkbox" ${isChecked(key) ? 'checked' : ''} aria-label="Select ${escapeHtml(key)}">` : ''}
        <div class="item-content">
          <div class="item-key" title="Click to copy key">${escapeHtml(key)}</div>
          <div class="item-value" title="Click to copy">${escapeHtml(value)}</div>
        </div>
        <div class="item-actions ${state.isSelectionMode ? 'hidden' : ''}">
          <button class="icon-btn btn-copy" title="Copy">${copyIcon}</button>
          <button class="icon-btn btn-edit" title="Edit">${editIcon}</button>
          <button class="icon-btn btn-delete" title="Delete">${deleteIcon}</button>
        </div>
      `;

      if (state.isSelectionMode) {
        const checkbox = div.querySelector('.item-select');
        checkbox.addEventListener('change', (e) => {
          toggleKeySelection(key, e.target.checked);
        });
        div.querySelector('.item-content').addEventListener('click', () => {
          const next = !checkbox.checked;
          checkbox.checked = next;
          toggleKeySelection(key, next);
        });
      } else {
        div.querySelector('.item-key').addEventListener('click', copyKey);
        div.querySelector('.item-value').addEventListener('click', copyValue);
        div.querySelector('.btn-copy').addEventListener('click', copyItem);
        div.querySelector('.btn-edit').addEventListener('click', () => onEdit(key, value));
        div.querySelector('.btn-delete').addEventListener('click', () => onDelete(key));
      }

      return div;
    }

    function render(data, searchQuery, options = {}) {
      state.latestData = data || {};
      const addedKeys = new Set(options.addedKeys || []);
      const updatedKeys = new Set(options.updatedKeys || []);
      const deletedKeys = Array.isArray(options.deletedKeys) ? options.deletedKeys : [];
      const dataKeys = new Set(Object.keys(state.latestData));
      state.selectedKeys.forEach((key) => {
        if (!dataKeys.has(key)) {
          state.selectedKeys.delete(key);
        }
      });

      listElement.innerHTML = '';

      const entries = Object.entries(state.latestData);
      const filteredEntries = entries.filter(([key]) =>
        key.toLowerCase().includes(searchQuery)
      );
      state.filteredKeys = filteredEntries.map(([key]) => key);

      if (deletedKeys.length > 0) {
        const deletedNotice = document.createElement('div');
        deletedNotice.className = 'change-summary change-summary-deleted';
        const preview = deletedKeys.slice(0, 3).join(', ');
        const suffix = deletedKeys.length > 3 ? ` +${deletedKeys.length - 3}` : '';
        deletedNotice.textContent = `Deleted: ${preview}${suffix}`;
        listElement.appendChild(deletedNotice);
      }

      if (entries.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No items found</div>';
        notifySelectionChange();
        return;
      }

      if (filteredEntries.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No matches found</div>';
        notifySelectionChange();
        return;
      }

      filteredEntries.forEach(([key, value]) => {
        const changeType = addedKeys.has(key)
          ? 'added'
          : (updatedKeys.has(key) ? 'updated' : '');
        listElement.appendChild(createItemElement(key, value, changeType));
      });

      notifySelectionChange();
    }

    function setSelectionMode(enabled) {
      state.isSelectionMode = !!enabled;
      if (!state.isSelectionMode) {
        state.selectedKeys.clear();
      }
      notifySelectionChange();
    }

    function clearSelection() {
      state.selectedKeys.clear();
      notifySelectionChange();
    }

    function selectAllFiltered() {
      state.filteredKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(state.latestData, key)) {
          state.selectedKeys.add(key);
        }
      });
      notifySelectionChange();
    }

    function getSelectedEntries() {
      return Array.from(state.selectedKeys)
        .filter((key) => Object.prototype.hasOwnProperty.call(state.latestData, key))
        .map((key) => [key, state.latestData[key]]);
    }

    function scrollToItem(key) {
      setTimeout(() => {
        const items = document.querySelectorAll('.storage-item');
        for (const row of items) {
          const keyEl = row.querySelector('.item-key');
          if (!keyEl || keyEl.textContent !== key) continue;

          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }, 150);
    }

    return {
      render,
      scrollToItem,
      setSelectionMode,
      clearSelection,
      selectAllFiltered,
      getSelectedEntries
    };
  }

  window.createStorageListController = createStorageListController;
})();
