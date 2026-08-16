import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPerson, fetchPersonCredits } from './fetchPerson';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

const refused = { ok: false, status: 404, json: () => Promise.resolve({}) };

const SOMEBODY = {
  id: 1245,
  name: 'Amy Adams',
  portraitUrl: '/portrait.jpg',
  biography: 'An actor.',
  bornOn: '1974-08-20',
  bornIn: 'Vicenza, Italy',
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPerson', () => {
  it('reads who somebody is', async () => {
    fetchMock.mockResolvedValue(ok(SOMEBODY));

    await expect(fetchPerson(1245)).resolves.toEqual(SOMEBODY);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/people/1245');
  });

  it('answers with nobody where the catalogue said nothing', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(fetchPerson(1245)).resolves.toBeNull();
  });

  it('answers with nobody where the request threw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchPerson(1245)).resolves.toBeNull();
  });

  it('answers with nobody where the server sent something unreadable', async () => {
    fetchMock.mockResolvedValue(ok({ name: 'Amy Adams' }));

    await expect(fetchPerson(1245)).resolves.toBeNull();
  });
});

describe('fetchPersonCredits', () => {
  it('reads what of theirs is here', async () => {
    fetchMock.mockResolvedValue(ok({ films: [], shows: [], episodes: [] }));

    await expect(fetchPersonCredits(1245)).resolves.toEqual({
      films: [],
      shows: [],
      episodes: [],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/people/1245/credits');
  });

  it('answers with nothing where the request was refused', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(fetchPersonCredits(1245)).resolves.toEqual({
      films: [],
      shows: [],
      episodes: [],
    });
  });

  it('answers with nothing where the request threw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchPersonCredits(1245)).resolves.toEqual({
      films: [],
      shows: [],
      episodes: [],
    });
  });
});
