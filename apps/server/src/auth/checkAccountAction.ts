import { ADMINISTRATOR } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

type AccountActionRefusal = 'outranked' | 'self';

type CheckAccountActionOptions = {
  actorId: string;
  actorPermissions: ReadonlySet<Permission>;
  actorHighestPosition: number | null;
  targetId: string;
  targetHighestPosition: number | null;
};

/**
 * Decides whether one account may ban or remove another, and says why not when it may not. Rank
 * decides it: nobody may act on somebody at or above their own highest role, which is what stops a
 * moderator removing an administrator. An administrator is exempt, and nobody may act on themselves
 * however senior they are.
 *
 * @param options - Who is acting, what they may do, how senior they are, and who they are acting on.
 * @returns Why the action is refused, or null where it is allowed.
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
