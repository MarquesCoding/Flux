import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPermissionCatalogue,
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchAccountPermissions,
  assignRole,
  removeRole,
  setOverride,
  clearOverride,
} from './fetchRoles';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type Answer = { ok: boolean; status: number; json: () => Promise<JsonValue> };

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>;

const fetchMock = vi.fn<FetchLike>();

const answering = (body: JsonValue, ok = true, status = 200) => {
  fetchMock.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
};

const unreachable = () => {
  fetchMock.mockRejectedValue(new Error('offline'));
};

/**
 * What the last request was, so a test can say where it went and how.
 */
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

describe('reading what a server allows', () => {
  it('reads the catalogue of permissions', async () => {
    answering({ permissions: ['library.edit', 'jobs.run'] });

    await expect(fetchPermissionCatalogue()).resolves.toEqual(['library.edit', 'jobs.run']);
    expect(lastCall().url).toBe('/api/admin/permissions');
  });

  it('has no permissions to offer when the server refuses', async () => {
    answering({ error: 'no' }, false, 403);

    await expect(fetchPermissionCatalogue()).resolves.toEqual([]);
  });

  it('has no permissions to offer when the server cannot be reached', async () => {
    unreachable();

    await expect(fetchPermissionCatalogue()).resolves.toEqual([]);
  });

  it('reads the roles', async () => {
    answering({
      roles: [{ id: 'role-1', name: 'Admin', position: 0, permissions: ['library.edit'] }],
    });

    await expect(fetchRoles()).resolves.toMatchObject([{ name: 'Admin' }]);
  });

  it('has no roles to offer when the server cannot be reached', async () => {
    unreachable();

    await expect(fetchRoles()).resolves.toEqual([]);
  });

  it('reads what one account is allowed', async () => {
    answering({
      roles: [{ id: 'role-1', name: 'Admin', position: 0, permissions: [] }],
      overrides: [{ permission: 'library.edit', effect: 'allow' }],
      effective: ['library.edit'],
    });

    await expect(fetchAccountPermissions('user-1')).resolves.toMatchObject({
      effective: ['library.edit'],
    });
    expect(lastCall().url).toBe('/api/admin/accounts/user-1/roles');
  });

  it('has nothing to say about an account the server will not describe', async () => {
    answering({ error: 'no' }, false, 403);

    await expect(fetchAccountPermissions('user-1')).resolves.toBeNull();
  });

  it('has nothing to say about an account when the server cannot be reached', async () => {
    unreachable();

    await expect(fetchAccountPermissions('user-1')).resolves.toBeNull();
  });
});

describe('changing what a server allows', () => {
  const changes: [string, () => Promise<{ message: string } | null>, string, string][] = [
    [
      'creating a role',
      () => createRole({ name: 'Staff', position: 1, permissions: [] }),
      '/api/admin/roles',
      'POST',
    ],
    [
      'changing a role',
      () => updateRole('role-1', { name: 'Staff' }),
      '/api/admin/roles/role-1',
      'PATCH',
    ],
    ['deleting a role', () => deleteRole('role-1'), '/api/admin/roles/role-1', 'DELETE'],
    [
      'giving an account a role',
      () => assignRole('user-1', 'role-1'),
      '/api/admin/accounts/user-1/roles/role-1',
      'PUT',
    ],
    [
      'taking a role away',
      () => removeRole('user-1', 'role-1'),
      '/api/admin/accounts/user-1/roles/role-1',
      'DELETE',
    ],
    [
      'setting an override',
      () => setOverride('user-1', { permission: 'library.edit', effect: 'deny' }),
      '/api/admin/accounts/user-1/overrides',
      'PUT',
    ],
    [
      'clearing an override',
      () => clearOverride('user-1', 'library.edit'),
      '/api/admin/accounts/user-1/overrides/library.edit',
      'DELETE',
    ],
  ];

  for (const [what, run, url, method] of changes) {
    describe(what, () => {
      it('says nothing when the server agreed', async () => {
        answering({});

        await expect(run()).resolves.toBeNull();
        expect(lastCall()).toEqual({ url, method });
      });

      it('passes on the reason the server gave for refusing', async () => {
        answering({ error: 'The last administrator cannot be demoted.' }, false, 409);

        await expect(run()).resolves.toEqual({
          message: 'The last administrator cannot be demoted.',
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
});
