import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestFailed } from '@ValenceClient/query/RequestFailed';
import { fetchFolders } from './fetchFolders';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type Answer = { ok: boolean; status: number; json: () => Promise<JsonValue> };

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Answer>>();

const LISTING = {
  path: '/media',
  parent: '/',
  folders: [{ name: 'films', path: '/media/films' }],
  isTruncated: false,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(LISTING) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFolders', () => {
  it('asks for the places to start from where no folder is named', async () => {
    await fetchFolders(null);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/folders');
  });

  it('asks about the folder named, with its path carried safely', async () => {
    await fetchFolders('/media/films & shows');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/folders?path=%2Fmedia%2Ffilms+%26+shows');
  });

  it('answers with what is inside it', async () => {
    await expect(fetchFolders('/media')).resolves.toEqual(LISTING);
  });

  it('says a folder is not there by failing with the status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'There is no such folder.' }),
    });

    await expect(fetchFolders('/nowhere')).rejects.toBeInstanceOf(RequestFailed);
  });
});
