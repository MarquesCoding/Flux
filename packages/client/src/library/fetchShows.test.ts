import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchShows, fetchShow } from './fetchShows';

const fetchMock = vi.fn();

const said = (body: object, ok = true) => ({ ok, json: () => Promise.resolve(body) });

const LIBRARY = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const A_SHOW = {
  id: 'ted',
  libraryId: LIBRARY,
  title: 'Ted Lasso',
  seasonCount: 3,
  episodeCount: 34,
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchShows', () => {
  it('reads the programmes in a library, grouped by the server', async () => {
    fetchMock.mockResolvedValue(said({ shows: [A_SHOW] }));

    await expect(fetchShows(LIBRARY)).resolves.toEqual([{ ...A_SHOW, seriesId: null }]);

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${LIBRARY}/shows`, {
      headers: { accept: 'application/json' },
    });
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchShows(LIBRARY)).rejects.toThrow();

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchShows(LIBRARY)).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({ shows: 'lots' }));

    await expect(fetchShows(LIBRARY)).rejects.toThrow();
  });
});

describe('fetchShow', () => {
  it('reads one programme and its seasons', async () => {
    fetchMock.mockResolvedValue(said({ ...A_SHOW, seasons: [] }));

    await expect(fetchShow(LIBRARY, 'ted')).resolves.toMatchObject({ id: 'ted', seasons: [] });

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${LIBRARY}/shows/ted`, {
      headers: { accept: 'application/json' },
    });
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchShow(LIBRARY, 'ted')).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({ id: 'ted' }));

    await expect(fetchShow(LIBRARY, 'ted')).rejects.toThrow();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchShow(LIBRARY, 'ted')).rejects.toThrow();
  });
});
