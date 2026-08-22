import { describe, expect, it } from 'vitest';
import { checkAccountAction } from './checkAccountAction';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const holding = (...permissions: Permission[]) => new Set<Permission>(permissions);

const check = (options: {
  actorPermissions?: ReadonlySet<Permission>;
  actorHighestPosition?: number | null;
  targetHighestPosition?: number | null;
  targetId?: string;
}) =>
  checkAccountAction({
    actorId: 'usr_actor',
    actorPermissions: options.actorPermissions ?? holding('account.ban'),
    actorHighestPosition:
      options.actorHighestPosition === undefined ? 200 : options.actorHighestPosition,
    targetId: options.targetId ?? 'usr_target',
    targetHighestPosition:
      options.targetHighestPosition === undefined ? 100 : options.targetHighestPosition,
  });

describe('checkAccountAction', () => {
  it('allows acting on somebody below you', () => {
    expect(check({})).toBeNull();
  });

  describe('rank', () => {
    it('refuses somebody above you', () => {
      expect(check({ targetHighestPosition: 300 })).toBe('outranked');
    });

    it('refuses somebody at your own rank', () => {
      expect(check({ targetHighestPosition: 200 })).toBe('outranked');
    });

    it('allows acting on somebody holding no role at all', () => {
      expect(check({ targetHighestPosition: null })).toBeNull();
    });

    it('refuses an actor holding no role at all', () => {
      expect(check({ actorHighestPosition: null })).toBe('outranked');
    });

    it('refuses when neither holds a role, so nobody outranks nobody', () => {
      expect(check({ actorHighestPosition: null, targetHighestPosition: null })).toBe('outranked');
    });
  });

  describe('yourself', () => {
    it('refuses, whatever the ranks say', () => {
      expect(check({ targetId: 'usr_actor' })).toBe('self');
    });

    it('refuses an administrator too, since that is the worst accident', () => {
      expect(check({ targetId: 'usr_actor', actorPermissions: holding('administrator') })).toBe(
        'self',
      );
    });

    it('is checked before rank, so the message names the real reason', () => {
      expect(check({ targetId: 'usr_actor', targetHighestPosition: 999 })).toBe('self');
    });
  });

  describe('administrator', () => {
    it('may act on anybody, however senior', () => {
      expect(
        check({ actorPermissions: holding('administrator'), targetHighestPosition: 999 }),
      ).toBeNull();
    });

    it('may act without holding a rank of its own', () => {
      expect(
        check({ actorPermissions: holding('administrator'), actorHighestPosition: null }),
      ).toBeNull();
    });
  });
});
