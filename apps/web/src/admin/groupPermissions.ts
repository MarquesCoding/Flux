import type { Permission } from '@FluxContracts/schemas/Permission';

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
 * The catalogue arranged as somebody choosing from it would read it.
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
