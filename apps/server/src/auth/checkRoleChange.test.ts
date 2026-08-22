import { describe, expect, it } from 'vitest';
import { checkRoleChange } from './checkRoleChange';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const holding = (...permissions: Permission[]) => new Set<Permission>(permissions);

describe('checkRoleChange', () => {
  it('allows a change to a role below the actor, granting what they hold', () => {
    expect(
      checkRoleChange({
        actorHighestPosition: 200,
        actorPermissions: holding('account.roles', 'jobs.run'),
        targetPosition: 100,
        granting: ['jobs.run'],
      }),
    ).toBeNull();
  });

  describe('rank', () => {
    it('refuses a role above the actor', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 100,
          actorPermissions: holding('account.roles'),
          targetPosition: 200,
        }),
      ).toBe('outranked');
    });

    it('refuses a role at the actor’s own rank', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 200,
          actorPermissions: holding('account.roles'),
          targetPosition: 200,
        }),
      ).toBe('outranked');
    });

    it('refuses everything to somebody holding no role at all', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: null,
          actorPermissions: holding('account.roles'),
          targetPosition: 0,
        }),
      ).toBe('outranked');
    });
  });

  describe('granting what you do not hold', () => {
    it('refuses a permission the actor lacks', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 200,
          actorPermissions: holding('account.roles', 'jobs.run'),
          targetPosition: 100,
          granting: ['server.settings'],
        }),
      ).toBe('escalation');
    });

    it('refuses when only one of several is missing', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 200,
          actorPermissions: holding('account.roles', 'jobs.run'),
          targetPosition: 100,
          granting: ['jobs.run', 'server.backup'],
        }),
      ).toBe('escalation');
    });

    it('refuses somebody handing out administrator', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 200,
          actorPermissions: holding('account.roles'),
          targetPosition: 100,
          granting: ['administrator'],
        }),
      ).toBe('escalation');
    });

    it('allows granting nothing new, such as a rename', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 200,
          actorPermissions: holding('account.roles'),
          targetPosition: 100,
        }),
      ).toBeNull();
    });
  });

  describe('rank is checked before what is granted', () => {
    it('reports being outranked rather than the escalation underneath it', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 100,
          actorPermissions: holding('account.roles'),
          targetPosition: 300,
          granting: ['administrator'],
        }),
      ).toBe('outranked');
    });
  });

  describe('administrator', () => {
    it('may edit a role at its own rank, including Administrator itself', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 300,
          actorPermissions: holding('administrator'),
          targetPosition: 300,
          granting: ['administrator'],
        }),
      ).toBeNull();
    });

    it('may grant anything, holding everything by implication', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: 300,
          actorPermissions: holding('administrator'),
          targetPosition: 999,
          granting: ['server.settings', 'account.ban'],
        }),
      ).toBeNull();
    });

    it('is not fooled by holding no position, since rank does not apply', () => {
      expect(
        checkRoleChange({
          actorHighestPosition: null,
          actorPermissions: holding('administrator'),
          targetPosition: 0,
        }),
      ).toBeNull();
    });
  });
});
