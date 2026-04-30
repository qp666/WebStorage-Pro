const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const popupUrl = pathToFileURL(
  path.resolve(__dirname, '../../WebStorage-Pro/popup/popup.html')
).href;

function createChromeEvents() {
  const listeners = new Set();
  return {
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    hasListener: (fn) => listeners.has(fn),
    emit: (...args) => listeners.forEach((fn) => fn(...args))
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const store = {};
    const tabsOnActivated = {
      listeners: [],
      addListener(fn) { this.listeners.push(fn); },
      removeListener(fn) { this.listeners = this.listeners.filter((x) => x !== fn); },
      hasListener(fn) { return this.listeners.includes(fn); }
    };
    const tabsOnUpdated = {
      listeners: [],
      addListener(fn) { this.listeners.push(fn); },
      removeListener(fn) { this.listeners = this.listeners.filter((x) => x !== fn); },
      hasListener(fn) { return this.listeners.includes(fn); }
    };
    const windowsOnFocusChanged = {
      listeners: [],
      addListener(fn) { this.listeners.push(fn); },
      removeListener(fn) { this.listeners = this.listeners.filter((x) => x !== fn); },
      hasListener(fn) { return this.listeners.includes(fn); }
    };

    window.chrome = {
      storage: {
        local: {
          async get(keys) {
            if (Array.isArray(keys)) {
              return keys.reduce((acc, key) => {
                acc[key] = store[key];
                return acc;
              }, {});
            }
            if (typeof keys === 'string') {
              return { [keys]: store[keys] };
            }
            return { ...store };
          },
          async set(data) {
            Object.assign(store, data || {});
          }
        }
      },
      tabs: {
        async query() {
          return [{ id: 1, url: 'https://example.com' }];
        },
        onActivated: tabsOnActivated,
        onUpdated: tabsOnUpdated
      },
      windows: {
        onFocusChanged: windowsOnFocusChanged
      },
      sidePanel: {
        async setOptions() {},
        async open() {}
      },
      scripting: {
        async executeScript({ func, args = [] }) {
          const result = await func(...args);
          return [{ result }];
        }
      }
    };
  });

  await page.goto(popupUrl);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.click('#refresh-btn');
});

async function importBulk(page, payload) {
  await page.click('#add-btn');
  await page.click('#modal-mode-bulk');
  await page.fill('#item-bulk-json', JSON.stringify(payload));
  await page.click('#modal-save');
}

test('bulk 导入后列表展示新增 key', async ({ page }) => {
  await importBulk(page, { e2e_k1: 'v1', e2e_k2: 'v2' });
  await expect(page.locator('.item-key', { hasText: 'e2e_k1' })).toBeVisible();
  await expect(page.locator('.item-key', { hasText: 'e2e_k2' })).toBeVisible();
});

test('single JSON object 多 key 时自动切换到 bulk', async ({ page }) => {
  const payload = JSON.stringify({ e2e_auto_bulk_1: 'v1', e2e_auto_bulk_2: 'v2' }, null, 2);

  await page.click('#add-btn');
  await page.fill('#item-json-object', payload);

  await expect(page.locator('#modal-mode-bulk')).toHaveClass(/active/);
  await expect(page.locator('#bulk-editor')).not.toHaveClass(/hidden/);
  await expect(page.locator('#item-bulk-json')).toHaveValue(payload);

  await page.click('#modal-save');
  await expect(page.locator('.item-key', { hasText: 'e2e_auto_bulk_1' })).toBeVisible();
  await expect(page.locator('.item-key', { hasText: 'e2e_auto_bulk_2' })).toBeVisible();
});

test('select 批量删除 + undo 倒计时恢复', async ({ page }) => {
  await importBulk(page, { e2e_del_1: 'v1', e2e_del_2: 'v2', e2e_keep: 'v3' });

  await page.click('#select-mode-btn');
  const rows = page.locator('.storage-item');
  await rows.filter({ has: page.locator('.item-key', { hasText: 'e2e_del_1' }) }).locator('.item-select').click();
  await rows.filter({ has: page.locator('.item-key', { hasText: 'e2e_del_2' }) }).locator('.item-select').click();
  await page.click('#bulk-delete-btn');
  await page.click('#confirm-ok');

  await expect(page.locator('.item-key', { hasText: 'e2e_del_1' })).toHaveCount(0);
  await expect(page.locator('.item-key', { hasText: 'e2e_del_2' })).toHaveCount(0);

  const undoBtn = page.locator('.toast-action-btn');
  await expect(undoBtn).toBeVisible();
  await expect(undoBtn).toHaveText(/Undo \(\d+s\)/);
  const firstText = await undoBtn.textContent();
  await page.waitForTimeout(1300);
  const secondText = await undoBtn.textContent();
  expect(secondText).not.toBe(firstText);

  await undoBtn.click();
  await expect(page.locator('.item-key', { hasText: 'e2e_del_1' })).toBeVisible();
  await expect(page.locator('.item-key', { hasText: 'e2e_del_2' })).toBeVisible();
});
