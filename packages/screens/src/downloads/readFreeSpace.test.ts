import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFreeSpace } from './readFreeSpace';

/**
 * A browser that answers about storage however the caller says.
 *
 * @param estimate - What `navigator.storage.estimate` should do.
 */
const browserSaying = (estimate: () => Promise<StorageEstimate>) => {
  vi.stubGlobal('navigator', { storage: { estimate } });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readFreeSpace', () => {
  it('reports what is left of the quota', async () => {
    browserSaying(() => Promise.resolve({ quota: 100_000_000_000, usage: 40_000_000_000 }));

    expect(await readFreeSpace()).toBe(60_000_000_000);
  });

  it('treats a quota with nothing used as entirely free', async () => {
    browserSaying(() => Promise.resolve({ quota: 100_000_000_000 }));

    expect(await readFreeSpace()).toBe(100_000_000_000);
  });

  it('never reports less than nothing, however the figures land', async () => {
    browserSaying(() => Promise.resolve({ quota: 10, usage: 400 }));

    expect(await readFreeSpace()).toBe(0);
  });

  it('claims nothing where the browser would not say', async () => {
    browserSaying(() => Promise.resolve({}));

    expect(await readFreeSpace()).toBeNull();
  });

  it('claims nothing rather than throwing where asking fails', async () => {
    browserSaying(() => Promise.reject(new Error('no')));

    expect(await readFreeSpace()).toBeNull();
  });

  it('claims nothing where the whole interface is missing, as outside a secure context', async () => {
    vi.stubGlobal('navigator', {});

    expect(await readFreeSpace()).toBeNull();
  });
});
