import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAccounts,
  banAccount,
  unbanAccount,
  removeAccount,
  inviteAccount,
} from './fetchAccounts';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type Answer = { ok: boolean; status: number; json: () => Promise<JsonValue> };

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>;

const fetchMock = vi.fn<FetchLike>();

const ACCOUNT = {
  id: 'user-1',
  name: 'Marques',
  email: 'marques@valence.local',
  createdAt: '2026-01-01T00:00:00.000Z',
  isBanned: false,
  banReason: null,
  position: 0,
  isAdministrator: true,
  roles: ['Admin'],
};

const answering = (body: JsonValue, ok = true, status = 200) => {
  fetchMock.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
};

const unreachable = () => {
  fetchMock.mockRejectedValue(new Error('offline'));
};

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];

  return { url, method: init?.method };
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the accounts', () => {
  it('reads every account on the server', async () => {
    answering({ accounts: [ACCOUNT] });

    await expect(fetchAccounts()).resolves.toMatchObject([{ name: 'Marques' }]);
    expect(lastCall().url).toBe('/api/admin/accounts');
  });

  it('carries a ban and its reason through, since that is what the page shows', async () => {
    answering({
      accounts: [{ ...ACCOUNT, isBanned: true, banReason: 'Sharing the password around.' }],
    });

    await expect(fetchAccounts()).resolves.toMatchObject([
      { isBanned: true, banReason: 'Sharing the password around.' },
    ]);
  });

  it('says so when the server refuses, rather than answering with nothing', async () => {
    answering({ error: 'no' }, false, 403);

    await expect(fetchAccounts()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    unreachable();

    await expect(fetchAccounts()).rejects.toThrow();
  });
});

describe('acting on an account', () => {
  const actions: [string, () => Promise<{ message: string } | null>, string, string][] = [
    [
      'banning somebody',
      () => banAccount('user-1', 'Sharing the password around.'),
      '/api/admin/accounts/user-1/ban',
      'POST',
    ],
    ['lifting a ban', () => unbanAccount('user-1'), '/api/admin/accounts/user-1/ban', 'DELETE'],
    ['deleting an account', () => removeAccount('user-1'), '/api/admin/accounts/user-1', 'DELETE'],
    [
      'inviting somebody',
      () =>
        inviteAccount({
          name: 'Dan',
          email: 'dan@valence.local',
          password: 'a-long-enough-password',
        }),
      '/api/admin/accounts',
      'POST',
    ],
  ];

  for (const [what, run, url, method] of actions) {
    describe(what, () => {
      it('says nothing when the server agreed', async () => {
        answering({});

        await expect(run()).resolves.toBeNull();
        expect(lastCall()).toEqual({ url, method });
      });

      it('passes on the reason the server gave for refusing', async () => {
        answering({ error: 'The last administrator cannot be removed.' }, false, 409);

        await expect(run()).resolves.toEqual({
          message: 'The last administrator cannot be removed.',
        });
      });

      it('says something rather than nothing when a refusal explains itself badly', async () => {
        fetchMock.mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('not json')),
        });

        const refusal = await run();

        expect(refusal?.message).toContain('could not be done');
      });

      it('says the server could not be reached rather than blaming the request', async () => {
        unreachable();

        await expect(run()).resolves.toEqual({ message: 'The server could not be reached.' });
      });
    });
  }

  it('sends the password with an invitation, since Valence cannot post a link', async () => {
    answering({});

    await inviteAccount({ name: 'Dan', email: 'dan@valence.local', password: 'a-long-password' });

    const [, init] = fetchMock.mock.calls.at(-1) ?? [];

    expect(init?.body).toContain('a-long-password');
  });
});
