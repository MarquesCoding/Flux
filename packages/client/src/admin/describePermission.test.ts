import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@ValenceContracts/schemas/Permission';
import { describePermission } from './describePermission';

describe('describePermission', () => {
  it('has words for every permission in the catalogue', () => {
    for (const permission of PERMISSIONS) {
      expect(describePermission(permission)).toBeTruthy();
    }
  });

  it('says what is destroyed rather than that something is', () => {
    expect(describePermission('jobs.runDestructive')).toBe('Run reset and rebuild');
  });

  it('never answers with the identifier it was given', () => {
    for (const permission of PERMISSIONS) {
      expect(describePermission(permission)).not.toBe(permission);
    }
  });

  it('says administrator implies what has not been written yet', () => {
    expect(describePermission('administrator')).toContain('anything added later');
  });
});
