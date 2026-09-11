/**
 * Ranks a season by the kind of thing it is rather than by its number, which is what puts specials
 * and unplaced episodes where a viewer expects them rather than where the integers fall.
 *
 * @param seasonNumber - The season, or null where the scanner could not place it.
 * @returns Which group it sorts into.
 */
const rank = (seasonNumber: number | null): number => {
  if (seasonNumber === null) {
    return 2;
  }

  return seasonNumber === 0 ? 1 : 0;
};

/**
 * Orders seasons the way a programme is watched: season one onwards, then the specials, then
 * anything nobody could place.
 *
 * Specials are season zero because they needed a number to live under, not because they come before
 * season one. Sorting on the number alone puts them first, which is how the one play button on an
 * unwatched programme came to start on a special.
 *
 * @param left - One season.
 * @param right - The season to place it against.
 * @returns Negative when the left one comes first, as a sort comparator.
 */
const inSeasonOrder = (left: number | null, right: number | null): number => {
  const byRank = rank(left) - rank(right);

  return byRank === 0 ? (left ?? 0) - (right ?? 0) : byRank;
};

export { inSeasonOrder };
