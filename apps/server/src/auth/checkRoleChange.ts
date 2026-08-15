import { ADMINISTRATOR } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

type RoleChangeRefusal = 'outranked' | 'escalation';

type CheckRoleChangeOptions = {
  actorHighestPosition: number | null;
  actorPermissions: ReadonlySet<Permission>;
  targetPosition: number;
  granting?: readonly Permission[];
};

/**
 * Whether an account may make this change to a role, and why not.
 */
const checkRoleChange = ({
  actorHighestPosition,
  actorPermissions,
  targetPosition,
  granting = [],
}: CheckRoleChangeOptions): RoleChangeRefusal | null => {
  if (actorPermissions.has(ADMINISTRATOR)) {
    return null;
  }

  if (actorHighestPosition === null || targetPosition >= actorHighestPosition) {
    return 'outranked';
  }

  if (granting.some((permission) => !actorPermissions.has(permission))) {
    return 'escalation';
  }

  return null;
};

export { checkRoleChange };
export type { RoleChangeRefusal };
