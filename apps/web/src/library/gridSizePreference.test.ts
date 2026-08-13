import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GRID_SIZE, STORAGE_KEY, readGridSize, saveGridSize } from './gridSizePreference';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('readGridSize', () => {
  it('starts at the middle size, which suits a page nobody has an opinion about yet', () => {
    expect(readGridSize()).toBe(DEFAULT_GRID_SIZE);
  });

  it('remembers what was chosen last', () => {
    saveGridSize('large');

    expect(readGridSize()).toBe('large');
  });

  it('ignores a size that means nothing rather than laying the page out with it', () => {
    window.localStorage.setItem(STORAGE_KEY, 'enormous');

    expect(readGridSize()).toBe(DEFAULT_GRID_SIZE);
  });

  it('still draws the page when the browser refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is disabled.');
    });

    expect(readGridSize()).toBe(DEFAULT_GRID_SIZE);
  });
});

describe('saveGridSize', () => {
  it('writes the choice where the next visit will find it', () => {
    saveGridSize('small');

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('small');
  });

  it('says nothing when the browser refuses to be written to', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is full.');
    });

    expect(() => {
      saveGridSize('large');
    }).not.toThrow();
  });
});
