import { tidy } from './readEpisodeFromPath';
import { readSeasonDirectory } from './readSeasonDirectory';

const BARE_NUMBER = /^(?<stem>.+?)[\s._-]+(?<number>\d{1,3})(?=[\s._-]|$)/;

const MIN_RUN = 2;

type BareEpisode = {
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
};

/**
 * Drops a filename's extension, leaving a leading dot alone so that a hidden file does not become an
 * empty name.
 *
 * @param name - The filename.
 * @returns It without its extension.
 */
const stripExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');

  return lastDot > 0 ? name.slice(0, lastDot) : name;
};

/**
 * Reads episode numbers out of files that are numbered without saying so — `01.mkv`, `02.mkv` — by
 * treating a folder of consecutively numbered files as a season. Common in ripped collections, and
 * without this every one of them is a separate film named after a number.
 *
 * @param paths - The files in one folder, with what was already read from their names.
 * @returns Which episode each file is, where the folder read as a season.
 */
const groupBareNumberedEpisodes = (paths: readonly string[]): Map<string, BareEpisode> => {
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

export { groupBareNumberedEpisodes };
