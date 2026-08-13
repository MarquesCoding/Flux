import { readSeasonDirectory, tidy } from './readEpisodeFromPath';

/**
 * A name followed by a bare number.
 *
 * The number has to be cut off from the name by a separator, which is what
 * keeps `Lv999` and `2049` out of it: a title's own digits are welded to the
 * word beside them, and an episode number stands alone.
 */
const BARE_NUMBER = /^(?<stem>.+?)[\s._-]+(?<number>\d{1,3})(?=[\s._-]|$)/;

/**
 * The fewest files a run needs before it is a run.
 *
 * One file called `Something 01` is a film with a number in its name. Two that
 * agree on everything but the number are a programme, and nothing else looks
 * like that.
 */
const MIN_RUN = 2;

/**
 * Where a bare-numbered file sits in its programme.
 */
type BareEpisode = {
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
};

const stripExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');

  return lastDot > 0 ? name.slice(0, lastDot) : name;
};

/**
 * Reads the episodes out of files numbered without saying so.
 *
 * Plenty of releases never write `S01E01`. A folder of
 * `Some Show 01 ITA.mkv`, `Some Show 02 ITA.mkv` is unmistakably a programme
 * to anybody looking at it, and was landing in Flux as a shelf of films with
 * numbers in their names — each one asking a catalogue about a film that does
 * not exist, each one coming back missing.
 *
 * A bare number cannot be read from one filename, which is why the parser
 * refuses to: `Blade Runner 2049` and `Ocean's 11` are films, and guessing
 * wrongly welds unrelated files into a programme. It can be read from a
 * folder. Several files agreeing on every word and differing only in a number
 * is not a coincidence that happens to films, so the evidence is the run
 * rather than the name, and a run needs at least two.
 *
 * The number is taken as the episode and the folder is asked for the season,
 * which it usually does not say — a release that never wrote `S01` is a
 * release with one season as far as anybody can tell, so that is what it gets.
 * A catalogue correcting this later is the point of the correction routes.
 */
const groupBareNumberedEpisodes = (paths: readonly string[]): Map<string, BareEpisode> => {
  /**
   * Every candidate, filed under the folder and stem it agrees with.
   */
  const runs = new Map<string, { path: string; folder: string; stem: string; number: number }[]>();

  for (const path of paths) {
    const parts = path.split('/').filter((part) => part !== '');
    const fileName = parts[parts.length - 1] ?? path;
    const folder = parts.slice(0, -1).join('/');
    const found = BARE_NUMBER.exec(stripExtension(fileName));
    const stem = found?.groups?.stem === undefined ? null : tidy(found.groups.stem);

    if (stem === null || stem === '' || found?.groups?.number === undefined) {
      continue;
    }

    const key = `${folder}::${stem.toLowerCase()}`;

    runs.set(key, [
      ...(runs.get(key) ?? []),
      { path, folder, stem, number: Number(found.groups.number) },
    ]);
  }

  const episodes = new Map<string, BareEpisode>();

  for (const run of runs.values()) {
    const numbers = new Set(run.map((one) => one.number));
    const first = run[0];

    if (run.length < MIN_RUN || numbers.size < MIN_RUN || first === undefined) {
      continue;
    }

    const folderName =
      first.folder
        .split('/')
        .filter((part) => part !== '')
        .pop() ?? '';
    const seasonNumber = readSeasonDirectory(folderName) ?? 1;

    for (const one of run) {
      episodes.set(one.path, {
        seriesTitle: one.stem,
        seasonNumber,
        episodeNumber: one.number,
      });
    }
  }

  return episodes;
};

export type { BareEpisode };

export { groupBareNumberedEpisodes, BARE_NUMBER, MIN_RUN };
