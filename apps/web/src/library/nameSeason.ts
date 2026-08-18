/**
 * Names a season the way somebody would say it, giving specials their own name rather than calling
 * them season zero.
 *
 * @param seasonNumber - The season.
 * @returns What to call it.
 */
const nameSeason = (seasonNumber: number | null): string =>
  seasonNumber === null || seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber.toString()}`;

export { nameSeason };
