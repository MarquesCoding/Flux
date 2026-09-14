import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyPermissions } from './fetchMyPermissions';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type Answer = { ok: boolean; json: () => Promise<JsonValue> };

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>;

const fetchMock = vi.fn<FetchLike>();

const answerWith = (body: JsonValue, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: () => Promise.resolve(body) });
};

beforeEach(() => {
  fetchMock.mockReset();
  answerWith({ permissions: [], isAdministrator: false });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMyPermissions', () => {
  it('asks the server what this account may do', async () => {
    await fetchMyPermissions();

    expect(fetchMock).toHaveBeenCalledWith('/api/account/permissions', expect.anything());
  });

  it('reads what is held, and whether it amounts to administering the server', async () => {
    answerWith({ permissions: ['administrator', 'library.create'], isAdministrator: true });

    await expect(fetchMyPermissions()).resolves.toStrictEqual({
      permissions: ['administrator', 'library.create'],
      isAdministrator: true,
    });
  });

  it('reads an account that holds nothing', async () => {
    await expect(fetchMyPermissions()).resolves.toStrictEqual({
      permissions: [],
      isAdministrator: false,
    });
  });

  it('says so when nobody is signed in, rather than answering with nothing held', async () => {
    answerWith({ error: 'Nobody is signed in.' }, false);

    await expect(fetchMyPermissions()).rejects.toThrow();
  });

  it('says so when the answer names a permission that does not exist', async () => {
    answerWith({ permissions: ['everything'], isAdministrator: true });

    await expect(fetchMyPermissions()).rejects.toThrow();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchMyPermissions()).rejects.toThrow();
  });
});
