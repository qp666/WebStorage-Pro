import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadUndoController() {
  const script = readFileSync(
    resolve(process.cwd(), 'WebStorage-Pro/popup/undo-controller.js'),
    'utf8'
  );
  vm.runInThisContext(script, { filename: 'undo-controller.js' });
  return window.createUndoController;
}

describe('undo-controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.createUndoController;
  });

  it('registerUndo 暴露倒计时 action 文案配置', () => {
    const createUndoController = loadUndoController();
    const showToast = vi.fn();
    const controller = createUndoController({
      windowMs: 10000,
      showToast,
      storageService: { getActiveTab: vi.fn(), applyStorageUndoPlan: vi.fn() },
      getMessage: (key, fallback) => (key === 'UNDO_ACTION' ? 'Undo (10s)' : fallback),
      loadData: vi.fn(),
      getCurrentType: () => 'local',
      getCurrentDataByType: () => ({}),
      detectStorageChanges: () => ({ addedKeys: [], updatedKeys: [], deletedKeys: [] }),
      applyTransientChanges: vi.fn()
    });

    controller.registerUndo({
      storageType: 'local',
      plan: { mode: 'delta', setEntries: {}, removeKeys: ['k1'] },
      successMessage: 'Deleted "k1". Click Undo to restore.'
    });

    expect(showToast).toHaveBeenCalledTimes(1);
    const [, , options] = showToast.mock.calls[0];
    expect(options.actionText).toBe('Undo (10s)');
    expect(options.actionCountdownMs).toBe(10000);
    expect(options.actionCountdownFormatter(7)).toBe('Undo (7s)');
    expect(typeof options.onAction).toBe('function');
  });

  it('点击 undo 后会执行 undo plan 并刷新', async () => {
    const createUndoController = loadUndoController();
    const applyStorageUndoPlan = vi.fn().mockResolvedValue(undefined);
    const loadData = vi.fn().mockResolvedValue(undefined);
    const applyTransientChanges = vi.fn();
    const detectStorageChanges = vi.fn(() => ({
      addedKeys: ['a'],
      updatedKeys: [],
      deletedKeys: []
    }));
    const showToast = vi.fn();
    const controller = createUndoController({
      windowMs: 10000,
      showToast,
      storageService: {
        getActiveTab: vi.fn().mockResolvedValue({ id: 101 }),
        applyStorageUndoPlan
      },
      getMessage: (_, fallback) => fallback,
      loadData,
      getCurrentType: () => 'local',
      getCurrentDataByType: vi
        .fn()
        .mockReturnValueOnce({ k1: 'new' })
        .mockReturnValueOnce({ k1: 'old' }),
      detectStorageChanges,
      applyTransientChanges
    });

    const plan = { mode: 'delta', setEntries: { k1: 'old' }, removeKeys: [] };
    controller.registerUndo({
      storageType: 'local',
      plan,
      successMessage: 'Overwrote "k1". Click Undo to restore.'
    });

    const [, , options] = showToast.mock.calls[0];
    await options.onAction();

    expect(applyStorageUndoPlan).toHaveBeenCalledWith(101, 'local', plan);
    expect(loadData).toHaveBeenCalledTimes(1);
    expect(detectStorageChanges).toHaveBeenCalledTimes(1);
    expect(applyTransientChanges).toHaveBeenCalledTimes(1);
  });
});
