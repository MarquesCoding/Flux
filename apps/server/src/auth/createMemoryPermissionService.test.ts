import { describe, expect, it } from 'vitest';
import { createMemoryPermissionService } from './createMemoryPermissionService';

const named = (service: ReturnType<typeof createMemoryPermissionService>, name: string) => {
  const found = service.state.roles.find((role) => role.name === name);

  if (found === undefined) {
    throw new Error(`No role named ${name}`);
  }

  return found;
};

describe('createMemoryPermissionService', () => {
  it('starts with the default roles', async () => {
    const service = createMemoryPermissionService();

    expect((await service.listRoles()).map((role) => role.name)).toEqual([
      'Administrator',
      'Manager',
      'Member',
      'Restricted',
    ]);
  });

  it('grants nothing to an account with no role', async () => {
    const service = createMemoryPermissionService();

    expect((await service.resolve('usr_1')).size).toBe(0);
  });

  it('resolves what an assigned role grants', async () => {
    const service = createMemoryPermissionService();

    await service.assignRole('usr_1', named(service, 'Manager').id);

    const resolved = await service.resolve('usr_1');

    expect(resolved.has('jobs.run')).toBe(true);
    expect(resolved.has('server.settings')).toBe(false);
  });

  it('unions two roles', async () => {
    const service = createMemoryPermissionService();

    await service.assignRole('usr_1', named(service, 'Member').id);
    await service.assignRole('usr_1', named(service, 'Manager').id);

    const resolved = await service.resolve('usr_1');

    expect(resolved.has('download.media')).toBe(true);
    expect(resolved.has('jobs.run')).toBe(true);
  });

  it('does not assign the same role twice', async () => {
    const service = createMemoryPermissionService();
    const manager = named(service, 'Manager').id;

    await service.assignRole('usr_1', manager);
    await service.assignRole('usr_1', manager);

    expect(await service.rolesFor('usr_1')).toHaveLength(1);
  });

  it('takes a role away again', async () => {
    const service = createMemoryPermissionService();
    const manager = named(service, 'Manager').id;

    await service.assignRole('usr_1', manager);
    await service.removeRole('usr_1', manager);

    expect((await service.resolve('usr_1')).size).toBe(0);
  });

  describe('overrides', () => {
    it('grants something no role gave', async () => {
      const service = createMemoryPermissionService();

      await service.setOverride('usr_1', { permission: 'server.logs', effect: 'allow' });

      expect((await service.resolve('usr_1')).has('server.logs')).toBe(true);
    });

    it('denies something a role gave', async () => {
      const service = createMemoryPermissionService();

      await service.assignRole('usr_1', named(service, 'Manager').id);
      await service.setOverride('usr_1', { permission: 'jobs.run', effect: 'deny' });

      expect((await service.resolve('usr_1')).has('jobs.run')).toBe(false);
    });

    it('replaces rather than stacks a second word on the same permission', async () => {
      const service = createMemoryPermissionService();

      await service.setOverride('usr_1', { permission: 'media.delete', effect: 'deny' });
      await service.setOverride('usr_1', { permission: 'media.delete', effect: 'allow' });

      expect(await service.overridesFor('usr_1')).toEqual([
        { permission: 'media.delete', effect: 'allow' },
      ]);
      expect((await service.resolve('usr_1')).has('media.delete')).toBe(true);
    });

    it('clears one', async () => {
      const service = createMemoryPermissionService();

      await service.assignRole('usr_1', named(service, 'Manager').id);
      await service.setOverride('usr_1', { permission: 'jobs.run', effect: 'deny' });
      await service.clearOverride('usr_1', 'jobs.run');

      expect((await service.resolve('usr_1')).has('jobs.run')).toBe(true);
    });
  });

  describe('roles the operator makes', () => {
    it('creates one and resolves it', async () => {
      const service = createMemoryPermissionService();
      const created = await service.createRole({
        name: 'Housemate',
        position: 150,
        permissions: ['media.rescan'],
      });

      await service.assignRole('usr_1', created.id);

      expect((await service.resolve('usr_1')).has('media.rescan')).toBe(true);
    });

    it('changes what one grants, and every holder feels it', async () => {
      const service = createMemoryPermissionService();
      const member = named(service, 'Member').id;

      await service.assignRole('usr_1', member);
      await service.updateRole(member, { permissions: ['media.hide'] });

      const resolved = await service.resolve('usr_1');

      expect(resolved.has('media.hide')).toBe(true);
      expect(resolved.has('download.media')).toBe(false);
    });

    it('reports nothing for a role that is not there', async () => {
      const service = createMemoryPermissionService();

      expect(await service.updateRole('nope', { name: 'Anything' })).toBeNull();
      expect(await service.deleteRole('nope')).toBe(false);
    });

    it('deletes one, and stops granting it to whoever held it', async () => {
      const service = createMemoryPermissionService();
      const manager = named(service, 'Manager').id;

      await service.assignRole('usr_1', manager);
      await service.deleteRole(manager);

      expect((await service.resolve('usr_1')).size).toBe(0);
      expect(await service.rolesFor('usr_1')).toEqual([]);
    });

    it('lists them highest first', async () => {
      const service = createMemoryPermissionService();

      const positions = (await service.listRoles()).map((role) => role.position);

      expect(positions).toEqual([...positions].sort((a, b) => b - a));
    });
  });

  describe('counting administrators', () => {
    it('counts nobody on a fresh instance', async () => {
      expect(await createMemoryPermissionService().countAdministrators()).toBe(0);
    });

    it('counts somebody holding the role', async () => {
      const service = createMemoryPermissionService();

      await service.assignRole('usr_1', named(service, 'Administrator').id);

      expect(await service.countAdministrators()).toBe(1);
    });

    it('counts somebody granted it outright', async () => {
      const service = createMemoryPermissionService();

      await service.setOverride('usr_1', { permission: 'administrator', effect: 'allow' });

      expect(await service.countAdministrators()).toBe(1);
    });

    it('does not count somebody denied it, whatever their role says', async () => {
      const service = createMemoryPermissionService();

      await service.assignRole('usr_1', named(service, 'Administrator').id);
      await service.setOverride('usr_1', { permission: 'administrator', effect: 'deny' });

      expect(await service.countAdministrators()).toBe(0);
    });

    it('counts each account once, however many ways it holds it', async () => {
      const service = createMemoryPermissionService();

      await service.assignRole('usr_1', named(service, 'Administrator').id);
      await service.setOverride('usr_1', { permission: 'administrator', effect: 'allow' });

      expect(await service.countAdministrators()).toBe(1);
    });
  });
});
