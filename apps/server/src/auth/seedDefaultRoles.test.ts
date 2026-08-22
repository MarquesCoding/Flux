import { describe, expect, it } from 'vitest';
import { createMemorySettingsStore } from '@ValenceServer/settings/createMemorySettingsStore';
import { createMemoryPermissionService } from './createMemoryPermissionService';
import { seedDefaultRoles } from './seedDefaultRoles';
import type { SeedableAccount } from './seedDefaultRoles';

const emptySettings = () =>
  createMemorySettingsStore({
    trustedOrigins: [],
    cookieSecure: false,
    setupCompletedAt: null,
    catalogueApiKey: '',
    hardwareAccel: '',
    seededJobTriggerKinds: [],
    seededRoleNames: [],
    pushPublicKey: '',
    pushPrivateKey: '',
    mediaDigestReadTo: null,
    jobsTimezone: '',
  });

/**
 * A permission service with no roles at all, so seeding has something to do.
 */
const emptyPermissions = () =>
  createMemoryPermissionService({ roles: [], assignments: {}, overrides: {} });

const seed = (accounts: SeedableAccount[] = [], permissions = emptyPermissions()) => {
  const settings = emptySettings();

  return {
    permissions,
    settings,
    run: () =>
      seedDefaultRoles({ permissions, settings, accounts: () => Promise.resolve(accounts) }),
  };
};

describe('seedDefaultRoles', () => {
  it('creates the default roles on a fresh instance', async () => {
    const context = seed();

    const outcome = await context.run();

    expect(outcome.rolesCreated).toEqual(['Administrator', 'Manager', 'Member', 'Restricted']);
    expect((await context.permissions.listRoles()).map((role) => role.name)).toContain('Manager');
  });

  it('creates them once, however many times it runs', async () => {
    const context = seed();

    await context.run();
    const second = await context.run();

    expect(second.rolesCreated).toEqual([]);
    expect(await context.permissions.listRoles()).toHaveLength(4);
  });

  it('does not bring back a default role the operator deleted', async () => {
    const context = seed();

    await context.run();

    const restricted = (await context.permissions.listRoles()).find(
      (role) => role.name === 'Restricted',
    );

    await context.permissions.deleteRole(restricted?.id ?? '');
    await context.run();

    expect((await context.permissions.listRoles()).map((role) => role.name)).not.toContain(
      'Restricted',
    );
  });

  it('leaves a role the operator already made under the same name alone', async () => {
    const permissions = emptyPermissions();

    await permissions.createRole({
      name: 'Manager',
      position: 999,
      permissions: ['server.backup'],
    });

    const context = seed([], permissions);

    await context.run();

    const manager = (await permissions.listRoles()).find((role) => role.name === 'Manager');

    expect(manager?.position).toBe(999);
    expect(manager?.permissions).toEqual(['server.backup']);
  });

  describe('carrying the old role column over', () => {
    it('makes an existing admin an Administrator', async () => {
      const context = seed([{ id: 'usr_1', role: 'admin' }]);

      const outcome = await context.run();

      expect(outcome.administratorsCarried).toBe(1);
      expect((await context.permissions.resolve('usr_1')).has('administrator')).toBe(true);
    });

    it('gives everybody else the default role rather than nothing', async () => {
      const context = seed([{ id: 'usr_2', role: null }]);

      const outcome = await context.run();

      expect(outcome.membersAssigned).toBe(1);
      expect((await context.permissions.resolve('usr_2')).has('download.media')).toBe(true);
    });

    it('does not make an ordinary account an administrator', async () => {
      const context = seed([{ id: 'usr_2', role: 'user' }]);

      await context.run();

      expect((await context.permissions.resolve('usr_2')).has('administrator')).toBe(false);
    });

    it('leaves at least one administrator standing after an upgrade', async () => {
      const context = seed([
        { id: 'usr_1', role: 'admin' },
        { id: 'usr_2', role: null },
        { id: 'usr_3', role: null },
      ]);

      await context.run();

      expect(await context.permissions.countAdministrators()).toBe(1);
    });
  });

  describe('leaving decisions alone', () => {
    it('does not touch an account that already holds a role', async () => {
      const permissions = emptyPermissions();
      const context = seed([{ id: 'usr_1', role: 'admin' }], permissions);

      await context.run();

      const restricted = (await permissions.listRoles()).find((role) => role.name === 'Restricted');

      await permissions.removeRole(
        'usr_1',
        (await permissions.listRoles()).find((role) => role.name === 'Administrator')?.id ?? '',
      );
      await permissions.assignRole('usr_1', restricted?.id ?? '');

      const second = await context.run();

      expect(second.administratorsCarried).toBe(0);
      expect((await permissions.resolve('usr_1')).has('administrator')).toBe(false);
    });

    it('does not give somebody a second role on the next boot', async () => {
      const context = seed([{ id: 'usr_2', role: null }]);

      await context.run();
      await context.run();

      expect(await context.permissions.rolesFor('usr_2')).toHaveLength(1);
    });

    it('gives the default back to somebody stripped to no roles at all', async () => {
      const context = seed([{ id: 'usr_2', role: null }]);

      await context.run();

      const member = (await context.permissions.listRoles()).find((role) => role.name === 'Member');

      await context.permissions.removeRole('usr_2', member?.id ?? '');

      const second = await context.run();

      expect(second.membersAssigned).toBe(1);
    });

    it('leaves somebody deliberately narrowed to Restricted alone', async () => {
      const context = seed([{ id: 'usr_2', role: null }]);

      await context.run();

      const roles = await context.permissions.listRoles();

      await context.permissions.removeRole(
        'usr_2',
        roles.find((role) => role.name === 'Member')?.id ?? '',
      );
      await context.permissions.assignRole(
        'usr_2',
        roles.find((role) => role.name === 'Restricted')?.id ?? '',
      );

      const second = await context.run();

      expect(second.membersAssigned).toBe(0);
      expect((await context.permissions.resolve('usr_2')).size).toBe(0);
    });
  });

  it('does nothing at all on an instance with no accounts', async () => {
    const outcome = await seed([]).run();

    expect(outcome.administratorsCarried).toBe(0);
    expect(outcome.membersAssigned).toBe(0);
  });
});
