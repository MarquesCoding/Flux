import type { BadgeTone } from '@FluxUI/Badge.types';
import type { Share } from '@FluxContracts/schemas/Share';

type Standing = { label: string; tone: BadgeTone };

/**
 * Says how a link stands, and says which of the three ways it ended rather than only that it has.
 * Withdrawn, run out and used up are different things to have happened, and somebody looking at a
 * list of links is usually trying to tell them apart.
 *
 * @param share - The link.
 * @param now - What to treat as now, so the phrasing can be tested.
 * @returns What to show and how loudly.
 */
const standingOf = (share: Share, now: number): Standing => {
  if (share.isRevoked) {
    return { label: 'Withdrawn', tone: 'quiet' };
  }

  if (share.expiresAt !== null && Date.parse(share.expiresAt) <= now) {
    return { label: 'Ran out', tone: 'quiet' };
  }

  return share.isSpent
    ? { label: 'All used up', tone: 'quiet' }
    : { label: 'Live', tone: 'accent' };
};

export type { Standing };

export { standingOf };
