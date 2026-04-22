(() => {
  function createUiServices({ confirmElements }) {
    if (!confirmElements) {
      throw new Error('Missing confirm elements');
    }

    function showConfirm(title, message, okText = 'OK', isDanger = false) {
      return new Promise((resolve) => {
        confirmElements.title.textContent = title;
        confirmElements.message.textContent = message;
        confirmElements.okBtn.textContent = okText;

        if (isDanger) {
          confirmElements.okBtn.className = 'danger-btn';
        } else {
          confirmElements.okBtn.className = 'primary-btn';
        }

        const close = () => {
          confirmElements.container.classList.add('hidden');
          confirmElements.cancelBtn.removeEventListener('click', onCancel);
          confirmElements.okBtn.removeEventListener('click', onOk);
          confirmElements.container.removeEventListener('click', onOutside);
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
          if (e.target === confirmElements.container) {
            close();
            resolve(false);
          }
        };

        const onEsc = (e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          e.preventDefault();
          close();
          resolve(false);
        };

        confirmElements.cancelBtn.addEventListener('click', onCancel);
        confirmElements.okBtn.addEventListener('click', onOk);
        confirmElements.container.addEventListener('click', onOutside);
        document.addEventListener('keydown', onEsc);

        confirmElements.container.classList.remove('hidden');
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

    function showToast(message, type = 'info', options = {}) {
      const { actionText = '', onAction = null, duration: customDuration } = options;
      const existingToast = document.querySelector('.toast');
      if (existingToast) {
        document.body.removeChild(existingToast);
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      if (actionText && typeof onAction === 'function') {
        toast.classList.add('toast-actionable');
      }
      const messageEl = document.createElement('span');
      messageEl.className = 'toast-message';
      messageEl.textContent = message;
      toast.appendChild(messageEl);

      if (actionText && typeof onAction === 'function') {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'toast-action-btn';
        actionBtn.type = 'button';
        actionBtn.textContent = actionText;
        actionBtn.addEventListener('click', async () => {
          try {
            await onAction();
          } finally {
            if (!document.body.contains(toast)) return;
            toast.classList.remove('show');
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 300);
          }
        });
        toast.appendChild(actionBtn);
      }
      document.body.appendChild(toast);

      void toast.offsetHeight;
      toast.classList.add('show');

      const duration = typeof customDuration === 'number'
        ? customDuration
        : (type === 'error' ? 2800 : 1800);
      setTimeout(() => {
        if (!document.body.contains(toast)) return;
        toast.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, duration);
    }

    return {
      showConfirm,
      escapeHtml,
      showToast
    };
  }

  window.createUiServices = createUiServices;
})();
