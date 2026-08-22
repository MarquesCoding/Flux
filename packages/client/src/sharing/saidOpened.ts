import type { Share } from '@ValenceContracts/schemas/Share';

/**
 * Says how often a link has been opened, against its allowance where it has one. The plural follows
 * the number the word belongs to — the allowance where there is one, since that is what "times"
 * counts, and the openings where there is not.
 *
 * @param share - The link.
 * @returns The phrase to show.
 */
const saidOpened = (share: Share): string => {
  const opened = share.views.toString();

  if (share.viewCap === null) {
    return share.views === 1 ? '1 time' : `${opened} times`;
  }

  const cap = share.viewCap.toString();

  return share.viewCap === 1 ? `${opened} of 1 time` : `${opened} of ${cap} times`;
};

export { saidOpened };
