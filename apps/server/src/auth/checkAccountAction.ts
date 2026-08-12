import { ADMINISTRATOR } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * Why acting on an account was refused.
 *
 * `outranked` — the account sits at or above the actor's own highest rank.
 * `self` — somebody tried it on themselves.
 */
type AccountActionRefusal = 'outranked' | 'self';

type CheckAccountActionOptions = {
  actorId: string;
  actorPermissions: ReadonlySet<Permission>;
  /**
   * The highest rank among the roles the actor holds, or null when none.
   */
  actorHighestPosition: number | null;
  targetId: string;
  /**
   * The highest rank the target holds, or null when it holds no role.
   */
  targetHighestPosition: number | null;
};

/**
 * Whether one account may ban or remove another.
 *
 * Two rules, and the second is the one people forget:
 *
 * 1. **Rank.** An account at or above the actor's own highest is out of
 *    reach — at, not merely above, because being able to act on your own rank
 *    is being able to act on everybody at it.
 * 2. **Not yourself.** Banning yourself locks you out of the server you were
 *    administering, and removing yourself destroys your own profiles and
 *    history. Neither is ever what somebody meant, and the last-administrator
 *    check does not catch either — a server with two administrators would let
 *    one delete themselves by accident.
 *
 * `administrator` bypasses the rank rule, having nothing above it, but **not**
 * the self rule. The operator is exactly the person whose accidental
 * self-removal would be worst.
 *
 * An account holding no role at all outranks nobody, which is why a null
 * target position is treated as below everything rather than above it.
 *
 * Answers null when the action is allowed.
 */
const checkAccountAction = ({
  actorId,
  actorPermissions,
  actorHighestPosition,
  targetId,
  targetHighestPosition,
}: CheckAccountActionOptions): AccountActionRefusal | null => {
  if (actorId === targetId) {
    return 'self';
  }

  if (actorPermissions.has(ADMINISTRATOR)) {
    return null;
  }

  if (targetHighestPosition === null) {
    return actorHighestPosition === null ? 'outranked' : null;
  }

  return actorHighestPosition === null || targetHighestPosition >= actorHighestPosition
    ? 'outranked'
    : null;
};

export { checkAccountAction };
export type { AccountActionRefusal };
