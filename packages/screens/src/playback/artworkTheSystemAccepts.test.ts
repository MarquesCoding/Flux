import { afterEach, describe, expect, it, vi } from 'vitest';
import { artworkFetchedForTheSystem, artworkTheSystemAccepts } from './artworkTheSystemAccepts';

describe('artworkTheSystemAccepts', () => {
  it('hands over a relative address as it stands, since a browser serves this over http', () => {
    expect(artworkTheSystemAccepts('/api/media/an-id/image/poster')).toBe(
      '/api/media/an-id/image/poster',
    );
  });

  it('takes an absolute http address', () => {
    expect(artworkTheSystemAccepts('https://example.test/a.png')).toBe(
      'https://example.test/a.png',
    );
  });

  it('refuses an address the system would refuse, rather than letting it draw nothing', () => {
    expect(artworkTheSystemAccepts('valence://app/api/media/an-id/image/poster')).toBeNull();
  });
});

describe('artworkFetchedForTheSystem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers the fetched picture as a blob, which the system will take', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['a picture'])) }),
    );
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:a-poster' });

    expect(await artworkFetchedForTheSystem('/a/poster')).toBe('blob:a-poster');
  });

  it('offers nothing where the picture could not be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('refused')));

    expect(await artworkFetchedForTheSystem('/a/poster')).toBeNull();
  });

  it('offers nothing where the server had no picture to give', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    expect(await artworkFetchedForTheSystem('/a/poster')).toBeNull();
  });
});
