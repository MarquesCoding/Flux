import { ADMINISTRATOR, PERMISSIONS } from '@FluxContracts/schemas/Permission';
import type { Permission, PermissionGrant } from '@FluxContracts/schemas/Permission';

type ResolvePermissionsOptions = {
  roles: readonly { permissions: readonly Permission[] }[];
  overrides?: readonly PermissionGrant[];
};

/**
 * Works out what an account may actually do, by gathering every permission its roles grant and then
 * applying the exceptions set on the account itself. A denial always wins, whichever role granted
 * it: taking something away from one person has to be possible without unpicking a role that dozens
 * of others share.
 *
 * @param options - The account's roles, and any permissions granted or denied to it directly.
 * @returns Every permission the account holds, once denials have been applied.
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
