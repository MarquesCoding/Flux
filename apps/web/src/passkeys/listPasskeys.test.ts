import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePasskey, listPasskeys, renamePasskey } from './listPasskeys';

const fetchMock = vi.fn();

const A_PASSKEY = {
  id: 'passkey-1',
  name: 'Laptop',
  deviceType: 'singleDevice',
  backedUp: false,
  createdAt: '2026-08-10T00:00:00.000Z',
};

const said = (body: object, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listPasskeys', () => {
  it('reads what is enrolled on this account', async () => {
    fetchMock.mockResolvedValue(said([A_PASSKEY]));

    await expect(listPasskeys()).resolves.toEqual([A_PASSKEY]);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/passkey/list-user-passkeys', {
      headers: { accept: 'application/json' },
    });
  });

  it('refuses to answer with a half-list where the server refused', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(listPasskeys()).rejects.toThrow(/500/);
  });
});

describe('deletePasskey', () => {
  it('asks for one to be removed, by its own identifier', async () => {
    fetchMock.mockResolvedValue(said({}));

    await expect(deletePasskey('passkey-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/passkey/delete-passkey',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: 'passkey-1' }) }),
    );
  });

  it('says so when the server would not remove it', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(deletePasskey('passkey-1')).resolves.toBe(false);
  });
});

describe('renamePasskey', () => {
  it('asks for one to be renamed, since a list of identical names is unusable', async () => {
    fetchMock.mockResolvedValue(said({}));

    await expect(renamePasskey('passkey-1', 'Phone')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/passkey/update-passkey',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'passkey-1', name: 'Phone' }),
      }),
    );
  });

  it('says so when the server would not rename it', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(renamePasskey('passkey-1', 'Phone')).resolves.toBe(false);
  });
});
