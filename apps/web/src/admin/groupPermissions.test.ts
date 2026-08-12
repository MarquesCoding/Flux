import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';
import { groupPermissions } from './groupPermissions';

describe('groupPermissions', () => {
  it('answers nothing for an empty catalogue', () => {
    expect(groupPermissions([])).toEqual([]);
  });

  it('gathers a prefix into one group', () => {
    const groups = groupPermissions(['jobs.run', 'jobs.schedule']);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.permissions).toEqual(['jobs.run', 'jobs.schedule']);
  });

  it('names a group in words rather than by its prefix', () => {
    expect(groupPermissions(['jobs.run'])[0]?.label).toBe('Jobs');
  });

  it('keeps different prefixes apart', () => {
    const groups = groupPermissions(['jobs.run', 'server.logs']);

    expect(groups.map((group) => group.label)).toEqual(['Jobs', 'Server']);
  });

  it('handles a permission with no prefix at all', () => {
    const groups = groupPermissions(['administrator']);

    expect(groups[0]?.label).toBe('Everything');
    expect(groups[0]?.permissions).toEqual(['administrator']);
  });

  it('keeps catalogue order, so Everything does not end up under Accounts', () => {
    const groups = groupPermissions([...PERMISSIONS]);

    expect(groups[0]?.id).toBe('administrator');
  });

  it('covers the whole catalogue without losing one', () => {
    const groups = groupPermissions([...PERMISSIONS]);
    const seen = groups.flatMap((group) => group.permissions);

    expect(seen).toHaveLength(PERMISSIONS.length);
    expect(new Set(seen).size).toBe(PERMISSIONS.length);
  });

  it('shows a group it has no name for rather than hiding it', () => {
    const groups = groupPermissions([...PERMISSIONS]);

    for (const group of groups) {
      expect(group.label).not.toBe('');
    }
  });
});
