import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFavourites, setFavourite } from './fetchFavourites';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

const kept = {
  favourites: [
    { mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9', keptAt: '2026-08-10T00:00:00.000Z' },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFavourites', () => {
  it('answers with what this viewer has kept', async () => {
    fetchMock.mockResolvedValue(ok(kept));

    await expect(fetchFavourites()).resolves.toEqual(['9c858901-8a57-4791-81fe-4c455b099bc9']);
  });

  it('answers with nothing rather than throwing when the server refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve(null) });

    await expect(fetchFavourites()).resolves.toEqual([]);
  });

  it('answers with nothing rather than throwing when the answer is not one', async () => {
    fetchMock.mockResolvedValue(ok({ favourites: [{ mediaId: 'not an identifier' }] }));

    await expect(fetchFavourites()).resolves.toEqual([]);
  });

  it('answers with nothing rather than throwing when the request fails outright', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchFavourites()).resolves.toEqual([]);
  });
});

describe('setFavourite', () => {
  it('keeps something by putting it', async () => {
    fetchMock.mockResolvedValue(ok(null));

    await expect(setFavourite('media-1', true)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/media-1/favourite',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('stops keeping something by deleting it', async () => {
    fetchMock.mockResolvedValue(ok(null));

    await setFavourite('media-1', false);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/media-1/favourite',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('says so when the server did not agree', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(setFavourite('media-1', true)).resolves.toBe(false);
  });

  it('says so when the request never arrived', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(setFavourite('media-1', true)).resolves.toBe(false);
  });
});
