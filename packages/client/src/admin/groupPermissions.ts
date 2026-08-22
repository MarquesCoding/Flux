import type { Permission } from '@ValenceContracts/schemas/Permission';

type PermissionGroup = {
  id: string;
  label: string;
  permissions: Permission[];
};

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
 * Arranges the permission catalogue the way somebody choosing from it reads it — by the thing being
 * permitted rather than in the order the server happens to list them, so that everything about
 * libraries sits together.
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
