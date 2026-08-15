import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGenres } from './fetchGenres';

const answering = (body: object, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchGenres', () => {
  it('reads the genres the server reports', async () => {
    vi.stubGlobal('fetch', answering({ genres: ['Drama', 'Sci-Fi'] }));

    expect(await fetchGenres()).toStrictEqual(['Drama', 'Sci-Fi']);
  });

  it('asks once rather than once per library', async () => {
    const fetchImpl = answering({ genres: [] });

    vi.stubGlobal('fetch', fetchImpl);

    await fetchGenres();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/genres', expect.anything());
  });

  it('offers no headings rather than failing when the server refuses', async () => {
    vi.stubGlobal('fetch', answering({ error: 'Nobody is signed in.' }, 401));

    expect(await fetchGenres()).toStrictEqual([]);
  });

  it('offers no headings when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await fetchGenres()).toStrictEqual([]);
  });

  it('offers no headings when the answer is not one it understands', async () => {
    vi.stubGlobal('fetch', answering({ unexpected: true }));

    expect(await fetchGenres()).toStrictEqual([]);
  });
});
