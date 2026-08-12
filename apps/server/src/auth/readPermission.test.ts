import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';
import { readPermission } from './readPermission';

describe('readPermission', () => {
  it('reads back every permission the catalogue has', () => {
    for (const permission of PERMISSIONS) {
      expect(readPermission(permission)).toBe(permission);
    }
  });

  it('refuses a name the catalogue no longer has', () => {
    expect(readPermission('library.summon')).toBeNull();
  });

  it('refuses a name from a permission that was renamed away', () => {
    expect(readPermission('library.view')).toBeNull();
  });

  it('refuses an empty column', () => {
    expect(readPermission('')).toBeNull();
  });

  it('does not accept a permission by its prefix alone', () => {
    expect(readPermission('library')).toBeNull();
    expect(readPermission('jobs')).toBeNull();
  });

  it('is exact about case, so a hand-edited row does not quietly work', () => {
    expect(readPermission('Administrator')).toBeNull();
    expect(readPermission('JOBS.RUN')).toBeNull();
  });
});
