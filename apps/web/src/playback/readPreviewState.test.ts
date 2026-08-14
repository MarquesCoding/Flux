import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPreviewState } from './readPreviewState';

const respondWith = (status: number) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(null, { status }))),
  );
};

describe('readPreviewState', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a served clip as ready', async () => {
    respondWith(206);

    await expect(readPreviewState('/api/media/1/preview')).resolves.toBe('ready');
  });

  it('reads a whole clip as ready', async () => {
    respondWith(200);

    await expect(readPreviewState('/api/media/1/preview')).resolves.toBe('ready');
  });

  it('keeps a clip being made apart from one that is not coming', async () => {
    respondWith(202);

    await expect(readPreviewState('/api/media/1/preview')).resolves.toBe('pending');
  });

  it('reads a missing clip as absent', async () => {
    respondWith(404);

    await expect(readPreviewState('/api/media/1/preview')).resolves.toBe('absent');
  });

  it('treats a server that cannot be reached as absent rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    await expect(readPreviewState('/api/media/1/preview')).resolves.toBe('absent');
  });

  it('asks for one byte rather than the whole clip', async () => {
    const call = vi.fn(() => Promise.resolve(new Response(null, { status: 206 })));

    vi.stubGlobal('fetch', call);

    await readPreviewState('/api/media/1/preview');

    expect(call).toHaveBeenCalledWith('/api/media/1/preview', {
      headers: { Range: 'bytes=0-0' },
    });
  });
});
