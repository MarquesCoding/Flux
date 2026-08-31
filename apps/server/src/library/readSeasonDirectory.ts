const SEASON_DIRECTORY = /\b(?:season|series|s)[\s._-]*(?<season>\d{1,2})\b/i;

const SPECIALS_DIRECTORY = /\b(?:specials?|extras?)\b/i;

/**
 * Reads the season a directory declares, accepting the several ways people write it — `Season 2`,
 * `S02`, `Series 2` — since a shelf is arranged by whoever filled it rather than by a convention.
 *
 * @param name - The directory name as it is on disk.
 * @returns The season number, or null where the directory names none.
 */
const readSeasonDirectory = (name: string): number | null => {
  if (SPECIALS_DIRECTORY.test(name)) {
    return 0;
  }

  const match = SEASON_DIRECTORY.exec(name);

  return match?.groups?.season === undefined ? null : Number(match.groups.season);
};

export { readSeasonDirectory };
