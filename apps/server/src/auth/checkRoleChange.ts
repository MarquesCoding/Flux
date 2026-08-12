import { ADMINISTRATOR } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * Why a change to a role was refused.
 *
 * `outranked` — the role sits at or above the highest the actor holds.
 * `escalation` — the change would grant something the actor does not have.
 */
type RoleChangeRefusal = 'outranked' | 'escalation';

type CheckRoleChangeOptions = {
  /**
   * The highest position among the roles the actor holds, or null when they
   * hold none.
   */
  actorHighestPosition: number | null;
  actorPermissions: ReadonlySet<Permission>;
  /**
   * Where the role being touched sits. For a change of position, the higher
   * of the old and the new — moving a role you may manage up above yourself
   * is the same escape as editing one already above you.
   */
  targetPosition: number;
  /**
   * What the change would have the role grant. Empty when the change grants
   * nothing new, such as a rename.
   */
  granting?: readonly Permission[];
};

/**
 * Whether an account may make this change to a role, and why not.
 *
 * Two rules, and without both of them "may manage roles" quietly means "may
 * make myself an administrator":
 *
 * 1. **Rank.** A role at or above the actor's own highest is out of reach.
 *    At, not merely above — being able to edit your own rank is being able to
 *    edit everybody at it.
 * 2. **No granting what you do not hold.** Somebody with `jobs.run` cannot
 *    build a role that grants `server.settings`, hand it to themselves, and
 *    arrive somewhere they were never permitted.
 *
 * `administrator` bypasses both, because it already implies every permission
 * and there is nothing above it to be outranked by. Refusing it would leave
 * the operator unable to edit the Administrator role itself.
 *
 * Answers null when the change is allowed.
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
