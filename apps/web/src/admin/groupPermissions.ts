import type { Permission } from '@FluxContracts/schemas/Permission';

type PermissionGroup = {
  id: string;
  label: string;
  permissions: Permission[];
};

/**
 * What each prefix is called.
 *
 * A prefix with no entry here is shown under its own name rather than being
 * hidden, so a permission added to the catalogue appears on this screen
 * without anybody remembering to come back and name its group.
 */
const GROUP_LABELS: Record<string, string> = {
  administrator: 'Everything',
  library: 'Libraries',
  jobs: 'Jobs',
  media: 'Media',
  sharing: 'Sharing',
  streaming: 'Streaming',
  download: 'Downloads',
  account: 'Accounts',
  server: 'Server',
};

/**
 * The catalogue arranged as somebody choosing from it would read it.
 *
 * Grouped on the prefix the permission already carries, so the grouping is
 * derived rather than being a second list to keep in step — a flat column of
 * twenty-six is not something anybody configures correctly.
 *
 * Order follows the catalogue rather than the alphabet, because the catalogue
 * is already ordered from most to least sweeping and re-sorting would put
 * "Accounts" above "Everything".
 *
 * @param permissions The catalogue, as the server gave it.
 */
const groupPermissions = (permissions: readonly Permission[]): PermissionGroup[] => {
  const groups: PermissionGroup[] = [];

  for (const permission of permissions) {
    const id = permission.split('.')[0] ?? permission;
    const existing = groups.find((group) => group.id === id);

    if (existing === undefined) {
      groups.push({ id, label: GROUP_LABELS[id] ?? id, permissions: [permission] });
    } else {
      existing.permissions.push(permission);
    }
  }

  return groups;
};

export { groupPermissions };
export type { PermissionGroup };
