import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadWatchUtils() {
  const script = readFileSync(
    resolve(process.cwd(), 'WebStorage-Pro/popup/watch-utils.js'),
    'utf8'
  );
  vm.runInThisContext(script, { filename: 'watch-utils.js' });
  return window.createWatchUtils;
}

describe('watch-utils', () => {
  beforeEach(() => {
    delete window.createWatchUtils;
  });

  it('动态退避：活跃窗口内返回 active interval，空闲返回 idle interval', () => {
    const createWatchUtils = loadWatchUtils();
    const utils = createWatchUtils();
    const now = 10000;
    const active = utils.getWatchIntervalMs({
      now,
      lastInteractionAt: now - 5000,
      activeWindowMs: 12000,
      activeIntervalMs: 1000,
      idleIntervalMs: 4000,
      fallbackIntervalMs: 1200
    });
    const idle = utils.getWatchIntervalMs({
      now,
      lastInteractionAt: now - 15000,
      activeWindowMs: 12000,
      activeIntervalMs: 1000,
      idleIntervalMs: 4000,
      fallbackIntervalMs: 1200
    });
    expect(active).toBe(1000);
    expect(idle).toBe(4000);
  });

  it('请求序列号防竞态：只应用不落后的请求', () => {
    const createWatchUtils = loadWatchUtils();
    const utils = createWatchUtils();
    const seq1 = utils.nextRequestSeq(0);
    const seq2 = utils.nextRequestSeq(seq1);
    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(utils.shouldApplyRequest(seq1, seq2)).toBe(false);
    expect(utils.shouldApplyRequest(seq2, seq2)).toBe(true);
  });
});
