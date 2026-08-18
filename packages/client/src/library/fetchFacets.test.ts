import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFacets } from './fetchFacets';

const answering = (body: object, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const NOTHING = {
  genres: [],
  decades: [],
  maxRating: 0,
};

const facets = {
  genres: ['Drama', 'Sci-Fi'],
  decades: [2010, 1990],
  maxRating: 8.4,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFacets', () => {
  it('reads what the server says there is to filter by', async () => {
    vi.stubGlobal('fetch', answering(facets));

    expect(await fetchFacets()).toStrictEqual(facets);
  });

  it('asks once rather than once per library', async () => {
    const fetchImpl = answering(NOTHING);

    vi.stubGlobal('fetch', fetchImpl);

    await fetchFacets();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/library-facets', expect.anything());
  });

  it('says so when the server refuses, rather than answering with nothing', async () => {
    vi.stubGlobal('fetch', answering({ error: 'Nobody is signed in.' }, 401));

    await expect(fetchFacets()).rejects.toThrow();
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchFacets()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    vi.stubGlobal('fetch', answering({ unexpected: true }));

    await expect(fetchFacets()).rejects.toThrow();
  });
});
