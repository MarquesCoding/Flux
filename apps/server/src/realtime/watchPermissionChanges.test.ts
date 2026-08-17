import { describe, expect, it } from 'vitest';
import { watchPermissionChanges } from './watchPermissionChanges';
import type { PermissionService } from '@FluxServer/auth/PermissionService';
import type { Permission } from '@FluxContracts/schemas/Permission';

const createService = (): PermissionService => ({
  resolve: () => Promise.resolve(new Set<Permission>()),
  listRoles: () => Promise.resolve([]),
  createRole: (role) => Promise.resolve({ ...role, id: 'role' }),
  updateRole: () => Promise.resolve(null),
  deleteRole: () => Promise.resolve(true),
  rolesFor: () => Promise.resolve([]),
  assignRole: () => Promise.resolve(),
  removeRole: () => Promise.resolve(),
  overridesFor: () => Promise.resolve([]),
  setOverride: () => Promise.resolve(),
  clearOverride: () => Promise.resolve(),
  countAdministrators: () => Promise.resolve(1),
});

const createWatcher = () => {
  const accounts: string[] = [];
  let everyone = 0;

  return {
    accounts,
    everyone: () => everyone,
    watcher: {
      accountChanged: (userId: string) => accounts.push(userId),
      everyoneChanged: () => {
        everyone += 1;
      },
    },
  };
};

describe('watchPermissionChanges', () => {
  it('announces the account whose role was granted', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.assignRole('someone', 'role');

    expect(seen.accounts).toStrictEqual(['someone']);
  });

  it('announces the account whose role was taken away', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.removeRole('someone', 'role');

    expect(seen.accounts).toStrictEqual(['someone']);
  });

  it('announces the account whose override was set', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.setOverride('someone', { permission: 'server.logs', effect: 'deny' });

    expect(seen.accounts).toStrictEqual(['someone']);
  });

  it('announces the account whose override was cleared', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.clearOverride('someone', 'server.logs');

    expect(seen.accounts).toStrictEqual(['someone']);
  });

  it('announces everyone when a role itself is edited, since many people hold it', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.updateRole('role', { permissions: [] });

    expect(seen.everyone()).toBe(1);
  });

  it('announces everyone when a role is deleted', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.deleteRole('role');

    expect(seen.everyone()).toBe(1);
  });

  it('says nothing for a plain read', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    await watched.resolve('someone');
    await watched.listRoles();
    await watched.rolesFor('someone');
    await watched.overridesFor('someone');

    expect(seen.accounts).toStrictEqual([]);
    expect(seen.everyone()).toBe(0);
  });

  it('still answers with what the wrapped service returned', async () => {
    const seen = createWatcher();
    const watched = watchPermissionChanges(createService(), seen.watcher);

    expect(await watched.deleteRole('role')).toBe(true);
    expect(await watched.countAdministrators()).toBe(1);
  });
});
