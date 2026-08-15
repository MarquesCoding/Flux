import { ADMINISTRATOR, PERMISSIONS } from '@FluxContracts/schemas/Permission';
import type { Permission, PermissionGrant } from '@FluxContracts/schemas/Permission';

type ResolvePermissionsOptions = {
  roles: readonly { permissions: readonly Permission[] }[];
  overrides?: readonly PermissionGrant[];
};

/**
 * What an account may actually do, once its roles and its own exceptions have been read together.
 */
const resolvePermissions = ({
  roles,
  overrides = [],
}: ResolvePermissionsOptions): ReadonlySet<Permission> => {
  const denied = new Set(
    overrides.filter((grant) => grant.effect === 'deny').map((grant) => grant.permission),
  );

  const granted = new Set<Permission>();

  for (const role of roles) {
    for (const permission of role.permissions) {
      granted.add(permission);
    }
  }

  for (const grant of overrides) {
    if (grant.effect === 'allow') {
      granted.add(grant.permission);
    }
  }

  if (granted.has(ADMINISTRATOR) && !denied.has(ADMINISTRATOR)) {
    for (const permission of PERMISSIONS) {
      granted.add(permission);
    }
  }

  for (const permission of denied) {
    granted.delete(permission);
  }

  return granted;
};

export { resolvePermissions };
