import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { thisTabsId } from './thisTabsId';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('thisTabsId', () => {
  it('makes an id for a tab that has none yet', () => {
    expect(thisTabsId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the same id across calls in the same tab', () => {
    expect(thisTabsId()).toBe(thisTabsId());
  });

  it('still answers when storage is refused, just without remembering it', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(() => thisTabsId()).not.toThrow();
  });
});
