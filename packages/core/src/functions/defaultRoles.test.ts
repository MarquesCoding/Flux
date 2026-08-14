import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';
import { resolvePermissions } from './resolvePermissions';
import { DEFAULT_ROLES, DEFAULT_ROLE_NAME } from './defaultRoles';

const roleNamed = (name: string) => {
  const found = DEFAULT_ROLES.find((role) => role.name === name);

  if (found === undefined) {
    throw new Error(`No default role named ${name}`);
  }

  return found;
};

describe('DEFAULT_ROLES', () => {
  it('names each role once', () => {
    const names = DEFAULT_ROLES.map((role) => role.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('ranks each role differently, so management order is never ambiguous', () => {
    const positions = DEFAULT_ROLES.map((role) => role.position);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it('puts Administrator above everything else', () => {
    const administrator = roleNamed('Administrator');
    const others = DEFAULT_ROLES.filter((role) => role.name !== 'Administrator');

    for (const role of others) {
      expect(administrator.position).toBeGreaterThan(role.position);
    }
  });

  it('grants administrator to nobody but Administrator', () => {
    const holders = DEFAULT_ROLES.filter((role) => role.permissions.includes('administrator'));

    expect(holders.map((role) => role.name)).toEqual(['Administrator']);
  });

  it('only names permissions that exist', () => {
    for (const role of DEFAULT_ROLES) {
      for (const permission of role.permissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  describe('what each one can actually do', () => {
    it('lets an Administrator do everything', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Administrator')] });

      expect(resolved.size).toBe(PERMISSIONS.length);
    });

    it('keeps a Manager away from the server itself', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Manager')] });

      expect(resolved.has('server.settings')).toBe(false);
      expect(resolved.has('server.backup')).toBe(false);
      expect(resolved.has('account.manage')).toBe(false);
    });

    it('does not let a Manager run a destructive job', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Manager')] });

      expect(resolved.has('jobs.run')).toBe(true);
      expect(resolved.has('jobs.runDestructive')).toBe(false);
    });

    it('does not let a Manager delete a library', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Manager')] });

      expect(resolved.has('library.edit')).toBe(true);
      expect(resolved.has('library.delete')).toBe(false);
    });

    it('lets an ordinary Member share and download, because that is the ordinary use', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Member')] });

      expect(resolved.has('sharing.link')).toBe(true);
      expect(resolved.has('sharing.party')).toBe(true);
      expect(resolved.has('download.media')).toBe(true);
    });

    it('gives a Member nothing that reshapes the library', () => {
      const resolved = resolvePermissions({ roles: [roleNamed('Member')] });

      expect(resolved.has('library.create')).toBe(false);
      expect(resolved.has('media.delete')).toBe(false);
      expect(resolved.has('jobs.run')).toBe(false);
    });

    it('gives Restricted no capability at all', () => {
      expect(resolvePermissions({ roles: [roleNamed('Restricted')] }).size).toBe(0);
    });
  });

  it('gives a new account the Member role', () => {
    expect(DEFAULT_ROLES.map((role) => role.name)).toContain(DEFAULT_ROLE_NAME);
  });

  it('records which permissions no default role but Administrator grants', () => {
    const granted = new Set(
      DEFAULT_ROLES.filter((role) => role.name !== 'Administrator').flatMap((role) => [
        ...role.permissions,
      ]),
    );

    const unreachable = PERMISSIONS.filter(
      (permission) => permission !== 'administrator' && !granted.has(permission),
    );

    expect(unreachable).toEqual([
      'library.delete',
      'jobs.runDestructive',
      'media.delete',
      'account.invite',
      'account.manage',
      'account.ban',
      'account.roles',
      'account.profiles',
      'server.settings',
      'server.backup',
      'server.webhooks',
    ]);
  });
});
