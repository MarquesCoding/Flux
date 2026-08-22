import { saidWhen } from '@ValenceClient/format/saidWhen';
import type { Share } from '@ValenceContracts/schemas/Share';

/**
 * Says what still holds a link open, for one that is still working. A link with neither an end date
 * nor a limit works until somebody withdraws it, which is worth saying plainly rather than leaving
 * blank. Worded without an owner, since the same phrase is read by whoever made the link and by
 * whoever looks after everybody's.
 *
 * @param share - The link.
 * @returns The phrase to show.
 */
const untilWhen = (share: Share): string => {
  if (share.expiresAt !== null) {
    return `Runs out ${saidWhen(share.expiresAt)}`;
  }

  return share.viewCap === null ? 'Until it is withdrawn' : 'Until it has been opened enough times';
};

export { untilWhen };
