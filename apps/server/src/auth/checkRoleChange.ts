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
 * Decides whether an account may change a role, and says why not when it may not. Two rules, both
 * about not exceeding your own reach: a role at or above your own highest is out of bounds, and you
 * cannot grant a permission you do not hold yourself. An administrator is exempt from both.
 *
 * @param options - How senior the actor is, what they may do, the role being changed, and any
 *   permissions being granted to it.
 * @returns Why the change is refused, or null where it is allowed.
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
