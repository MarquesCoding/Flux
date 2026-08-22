/**
 * Says how much of the machine Valence is using, in words that stay honest at the edges — a share too
 * small to draw is said to be under a percent rather than rounded to nothing, and one that was never
 * measured says so rather than reading as zero.
 *
 * @param share - Valence's share of the machine, or null where it could not be worked out.
 * @returns The phrase to show.
 */
const describeCpuShare = (share: number | null): string => {
  if (share === null) {
    return 'not measured';
  }

  if (share <= 0) {
    return '0%';
  }

  return share < 1 ? '<1%' : `${share.toFixed(0)}%`;
};

export { describeCpuShare };
