import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadStorageService() {
  const script = readFileSync(
    resolve(process.cwd(), 'WebStorage-Pro/popup/storage-service.js'),
    'utf8'
  );
  vm.runInThisContext(script, { filename: 'storage-service.js' });
  return window.createStorageService;
}

describe('storage-service', () => {
  beforeEach(() => {
    delete window.createStorageService;
    window.POPUP_CONFIG = {
      ERROR_CODES: {
        SCRIPT_EXECUTION_FAILED: 'SCRIPT_EXECUTION_FAILED'
      }
    };
    global.chrome = {
      scripting: {
        executeScript: vi.fn().mockResolvedValue([])
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1 }])
      },
      sidePanel: {
        setOptions: vi.fn().mockResolvedValue(undefined),
        open: vi.fn().mockResolvedValue(undefined)
      }
    };
  });

  it('applyStorageUndoPlan 会把 plan 传递给执行上下文', async () => {
    const createStorageService = loadStorageService();
    const service = createStorageService();
    const plan = { mode: 'delta', setEntries: { a: '1' }, removeKeys: ['b'] };

    await service.applyStorageUndoPlan(123, 'local', plan);

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    const call = chrome.scripting.executeScript.mock.calls[0][0];
    expect(call.target).toEqual({ tabId: 123 });
    expect(call.args).toEqual(['local', plan]);
    expect(typeof call.func).toBe('function');
  });
});
