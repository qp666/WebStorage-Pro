import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadUiServices() {
  const script = readFileSync(
    resolve(process.cwd(), 'WebStorage-Pro/popup/ui-services.js'),
    'utf8'
  );
  vm.runInThisContext(script, { filename: 'ui-services.js' });
  return window.createUiServices;
}

function createConfirmElements() {
  const container = document.createElement('div');
  const title = document.createElement('h3');
  const message = document.createElement('p');
  const cancelBtn = document.createElement('button');
  const okBtn = document.createElement('button');
  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(cancelBtn);
  container.appendChild(okBtn);
  document.body.appendChild(container);
  return { container, title, message, cancelBtn, okBtn };
}

describe('ui-services showToast action/countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    delete window.createUiServices;
  });

  it('倒计时文案会变化，并最终自动清理 toast', () => {
    const createUiServices = loadUiServices();
    const uiServices = createUiServices({ confirmElements: createConfirmElements() });

    uiServices.showToast('Deleted "k1"', 'success', {
      actionText: 'Undo (10s)',
      onAction: vi.fn(),
      duration: 10000,
      actionCountdownMs: 10000,
      actionCountdownFormatter: (seconds) => `Undo (${seconds}s)`
    });

    const actionBtn = document.querySelector('.toast-action-btn');
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.textContent).toBe('Undo (10s)');

    vi.advanceTimersByTime(1200);
    expect(actionBtn.textContent).toMatch(/Undo \((9|8)s\)/);

    vi.advanceTimersByTime(8400);
    expect(document.querySelector('.toast')).not.toBeNull();

    vi.advanceTimersByTime(700);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('点击 action 后执行回调并提前关闭 toast', async () => {
    const createUiServices = loadUiServices();
    const uiServices = createUiServices({ confirmElements: createConfirmElements() });
    const onAction = vi.fn().mockResolvedValue(undefined);

    uiServices.showToast('Deleted "k2"', 'success', {
      actionText: 'Undo (10s)',
      onAction,
      duration: 10000
    });

    const actionBtn = document.querySelector('.toast-action-btn');
    await actionBtn.click();
    expect(onAction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(350);
    expect(document.querySelector('.toast')).toBeNull();
  });
});
