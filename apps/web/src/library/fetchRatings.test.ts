import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHouseholdRating, fetchRatings, setRating } from './fetchRatings';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const SERIES_ID = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

const refused = { ok: false, status: 401, json: () => Promise.resolve({}) };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRatings', () => {
  it('answers with what this viewer has rated', async () => {
    fetchMock.mockResolvedValue(
      ok({
        ratings: [
          {
            mediaId: MEDIA_ID,
            seriesId: null,
            stars: 4,
            ratedAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      }),
    );

    await expect(fetchRatings()).resolves.toEqual([
      { mediaId: MEDIA_ID, seriesId: null, stars: 4, ratedAt: '2026-08-10T00:00:00.000Z' },
    ]);
  });

  it('answers with none where the request was refused', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(fetchRatings()).resolves.toEqual([]);
  });

  it('answers with none where the request threw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchRatings()).resolves.toEqual([]);
  });

  it('answers with none where the server sent something unreadable', async () => {
    fetchMock.mockResolvedValue(ok({ ratings: [{ stars: 'four' }] }));

    await expect(fetchRatings()).resolves.toEqual([]);
  });
});

describe('setRating', () => {
  it('puts a rating against an item', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await expect(setRating({ mediaId: MEDIA_ID }, 4)).resolves.toBe(true);

    const [address, init] = fetchMock.mock.calls[0] ?? [];

    expect(address).toBe(`/api/media/${MEDIA_ID}/rating`);
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(JSON.stringify({ stars: 4 }));
  });

  it('puts a rating against a programme at its own address', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await setRating({ seriesId: SERIES_ID }, 5);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/series/${SERIES_ID}/rating`);
  });

  it('takes a rating back by deleting it, with no body', async () => {
    fetchMock.mockResolvedValue(ok({}));

    await setRating({ mediaId: MEDIA_ID }, null);

    const [, init] = fetchMock.mock.calls[0] ?? [];

    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('says it did not work where the server refused', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(setRating({ mediaId: MEDIA_ID }, 4)).resolves.toBe(false);
  });

  it('says it did not work where the request threw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(setRating({ mediaId: MEDIA_ID }, 4)).resolves.toBe(false);
  });
});

describe('fetchHouseholdRating', () => {
  it('reads what the household gave an item', async () => {
    fetchMock.mockResolvedValue(ok({ average: 4.5, count: 2 }));

    await expect(fetchHouseholdRating({ mediaId: MEDIA_ID })).resolves.toEqual({
      average: 4.5,
      count: 2,
    });
  });

  it('reads what the household gave a programme', async () => {
    fetchMock.mockResolvedValue(ok({ average: 3, count: 1 }));

    await fetchHouseholdRating({ seriesId: SERIES_ID });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/series/${SERIES_ID}/rating/household`);
  });

  it('answers with nothing rather than zero where the request was refused', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(fetchHouseholdRating({ mediaId: MEDIA_ID })).resolves.toEqual({
      average: null,
      count: 0,
    });
  });

  it('answers with nothing where the request threw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchHouseholdRating({ mediaId: MEDIA_ID })).resolves.toEqual({
      average: null,
      count: 0,
    });
  });
});
