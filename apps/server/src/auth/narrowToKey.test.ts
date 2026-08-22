import { describe, expect, it } from 'vitest';
import { narrowToKey } from './narrowToKey';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const held = (...permissions: Permission[]): ReadonlySet<Permission> => new Set(permissions);

describe('narrowToKey', () => {
  it('gives an unrestricted key exactly what its account has', () => {
    expect(narrowToKey(held('library.create', 'jobs.run'), null)).toEqual(
      held('library.create', 'jobs.run'),
    );
  });

  it('gives a restricted key only what it names', () => {
    expect(narrowToKey(held('library.create', 'jobs.run'), held('jobs.run'))).toEqual(
      held('jobs.run'),
    );
  });

  it('gives a key naming nothing nothing at all, which is not the same as unrestricted', () => {
    expect(narrowToKey(held('administrator'), held()).size).toBe(0);
    expect(narrowToKey(held('administrator'), null).size).toBe(1);
  });

  it('grants nothing by naming a permission the account does not hold', () => {
    expect(narrowToKey(held('jobs.run'), held('library.delete')).size).toBe(0);
  });

  it('cannot make a key an administrator by asking to be one', () => {
    expect(narrowToKey(held('jobs.run'), held('administrator', 'jobs.run'))).toEqual(
      held('jobs.run'),
    );
  });

  it('lets an operator hold a key that is not an operator', () => {
    expect(narrowToKey(held('administrator'), held('administrator'))).toEqual(
      held('administrator'),
    );
    expect(narrowToKey(held('administrator', 'streaming.view'), held('streaming.view'))).toEqual(
      held('streaming.view'),
    );
  });

  it('gives an account with nothing a key with nothing, however it is asked', () => {
    expect(narrowToKey(held(), null).size).toBe(0);
    expect(narrowToKey(held(), held('administrator')).size).toBe(0);
  });

  it('never answers with more than the account holds, whatever it is asked for', () => {
    const account = held('jobs.run', 'streaming.view');

    const everything: Permission[] = [
      'administrator',
      'library.create',
      'library.delete',
      'jobs.run',
      'jobs.runDestructive',
      'account.manage',
      'server.settings',
      'streaming.view',
    ];

    const narrowed = narrowToKey(account, held(...everything));

    for (const permission of narrowed) {
      expect(account.has(permission)).toBe(true);
    }

    expect(narrowed).toEqual(account);
  });
});
