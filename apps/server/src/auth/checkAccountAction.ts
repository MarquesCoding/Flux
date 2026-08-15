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
 * Whether one account may ban or remove another.
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
