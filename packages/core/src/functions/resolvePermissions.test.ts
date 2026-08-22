import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@ValenceContracts/schemas/Permission';
import { resolvePermissions } from './resolvePermissions';

describe('resolvePermissions', () => {
  it('grants nothing to an account with no roles', () => {
    expect(resolvePermissions({ roles: [] }).size).toBe(0);
  });

  it('grants what a role grants', () => {
    const resolved = resolvePermissions({
      roles: [{ permissions: ['jobs.run', 'streaming.view'] }],
    });

    expect(resolved.has('jobs.run')).toBe(true);
    expect(resolved.has('streaming.view')).toBe(true);
    expect(resolved.has('library.delete')).toBe(false);
  });

  describe('several roles', () => {
    it('grants what either of them grants', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['jobs.run'] }, { permissions: ['media.rescan'] }],
      });

      expect(resolved.has('jobs.run')).toBe(true);
      expect(resolved.has('media.rescan')).toBe(true);
    });

    it('does not mind them overlapping', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['jobs.run'] }, { permissions: ['jobs.run', 'jobs.schedule'] }],
      });

      expect([...resolved].sort()).toEqual(['jobs.run', 'jobs.schedule']);
    });
  });

  describe('administrator', () => {
    it('implies every permission in the catalogue', () => {
      const resolved = resolvePermissions({ roles: [{ permissions: ['administrator'] }] });

      for (const permission of PERMISSIONS) {
        expect(resolved.has(permission)).toBe(true);
      }
    });

    it('keeps implying them as the catalogue grows', () => {
      const resolved = resolvePermissions({ roles: [{ permissions: ['administrator'] }] });

      expect(resolved.size).toBe(PERMISSIONS.length);
    });

    it('can be granted by an override rather than a role', () => {
      const resolved = resolvePermissions({
        roles: [],
        overrides: [{ permission: 'administrator', effect: 'allow' }],
      });

      expect(resolved.has('server.backup')).toBe(true);
    });
  });

  describe('overrides', () => {
    it('grants something no role gave', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['jobs.run'] }],
        overrides: [{ permission: 'server.logs', effect: 'allow' }],
      });

      expect(resolved.has('server.logs')).toBe(true);
    });

    it('takes back something a role gave', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['jobs.run', 'jobs.runDestructive'] }],
        overrides: [{ permission: 'jobs.runDestructive', effect: 'deny' }],
      });

      expect(resolved.has('jobs.run')).toBe(true);
      expect(resolved.has('jobs.runDestructive')).toBe(false);
    });
  });

  describe('deny wins', () => {
    it('over an allow on the same permission, whichever came first', () => {
      const resolved = resolvePermissions({
        roles: [],
        overrides: [
          { permission: 'media.delete', effect: 'allow' },
          { permission: 'media.delete', effect: 'deny' },
        ],
      });

      expect(resolved.has('media.delete')).toBe(false);
    });

    it('and still wins when the allow was listed second', () => {
      const resolved = resolvePermissions({
        roles: [],
        overrides: [
          { permission: 'media.delete', effect: 'deny' },
          { permission: 'media.delete', effect: 'allow' },
        ],
      });

      expect(resolved.has('media.delete')).toBe(false);
    });

    it('over what administrator would otherwise imply', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['administrator'] }],
        overrides: [{ permission: 'library.delete', effect: 'deny' }],
      });

      expect(resolved.has('administrator')).toBe(true);
      expect(resolved.has('library.delete')).toBe(false);
    });

    it('over administrator itself, taking its implications with it', () => {
      const resolved = resolvePermissions({
        roles: [{ permissions: ['administrator', 'jobs.run'] }],
        overrides: [{ permission: 'administrator', effect: 'deny' }],
      });

      expect(resolved.has('administrator')).toBe(false);
      expect(resolved.has('server.backup')).toBe(false);
      expect(resolved.has('jobs.run')).toBe(true);
    });
  });

  it('answers a set that does not reach back into what it was given', () => {
    const roles = [{ permissions: ['jobs.run' as const] }];
    const resolved = resolvePermissions({ roles });

    expect(resolved.has('jobs.run')).toBe(true);
    expect(roles[0]?.permissions).toEqual(['jobs.run']);
  });
});
