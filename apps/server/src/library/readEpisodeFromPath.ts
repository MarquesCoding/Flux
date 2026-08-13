import { findYear } from './readTitleFromPath';

/**
 * The shapes an episode number is written in.
 *
 * Ordered by how much each one asserts. `S01E02` says exactly what it means;
 * `1x02` is nearly as clear; a bare `102` could be anything, so it is only
 * read when a directory has already said which season this is.
 */
const EPISODE_PATTERNS = [
  /\bs(?<season>\d{1,2})[\s._-]*e(?<episode>\d{1,3})\b/i,
  /\b(?<season>\d{1,2})x(?<episode>\d{1,3})\b/i,
  /\bseason[\s._-]*(?<season>\d{1,2})[\s._-]*episode[\s._-]*(?<episode>\d{1,3})\b/i,
] as const;

const SEASON_DIRECTORY = /\b(?:season|series|s)[\s._-]*(?<season>\d{1,2})\b/i;

/**
 * The first word a release group adds rather than a person.
 *
 * An episode title runs until one of these appears: everything after
 * `1080p` is how the file was made, not what it is called.
 */
const RELEASE_NOISE =
  /\b(?:\d{3,4}p|4k|uhd|web[\s._-]?dl|webrip|bluray|blu[\s._-]?ray|hdtv|dvdrip|remux|proper|repack|x26[45]|h\.?26[45]|hevc|avc|aac\d*|ac3|eac3|ddp?\d?|dts[\w]*|flac|opus|10bit|8bit|hdr\d*|dv|sdr|amzn|nf|dsnp|hulu|atvp|multi|dual)\b/i;

const SPECIALS_DIRECTORY = /\b(?:specials?|extras?)\b/i;

type EpisodeNumbering = {
  /**
   * The show this file belongs to, as far as the path says.
   *
   * Taken from the filename where it names the show before saying which
   * episode it is, and from the directory structure otherwise. A file called
   * `A Sign of Affection - 1x01 - ....mkv` says the show's name plainly, and
   * trusting the folder over it means searching a catalogue for whatever the
   * library folder happens to be called.
   */
  seriesTitle: string | null;
  /**
   * The year a folder names alongside the show, when it does.
   *
   * Release folders reach for this exactly when a name alone is ambiguous —
   * "Ted (2024)" says which "Ted", the same way a film's filename does. Absent
   * far more often than a film's year is, since only a name collision usually
   * makes anyone bother writing it down.
   */
  seriesYear: number | null;
  /**
   * The directory that separates this programme from every other one.
   *
   * The path rather than the name, because two libraries can each hold a
   * folder called `Season 1` and two households can each hold a folder called
   * `The Office`. What makes this useful is that a directory is what actually
   * keeps two same-named programmes apart on disk — which is the one thing a
   * title cannot do.
   *
   * Null for a film, which has no series to be told apart from.
   */
  seriesFolder: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /**
   * What this particular episode is called, where the filename says.
   *
   * Only ever a guess, and only used when a catalogue has nothing better.
   */
  episodeTitle: string | null;
};

/**
 * Tidies a directory name into something readable.
 */
const tidy = (name: string): string =>
  name
    .replace(/[[\]()_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Reads the season a directory name declares.
 */
const readSeasonDirectory = (name: string): number | null => {
  if (SPECIALS_DIRECTORY.test(name)) {
    return 0;
  }

  const match = SEASON_DIRECTORY.exec(name);

  return match?.groups?.season === undefined ? null : Number(match.groups.season);
};

/**
 * Reads a series, season and episode out of a path.
 *
 * Everything here is a guess from a filename, and a wrong guess groups two
 * unrelated files together. It therefore refuses more readily than it asserts:
 * a file has to say which episode it is before Flux will treat it as one.
 *
 * The series name comes from the directory structure rather than the filename
 * because `Some.Show.S01E02.1080p.WEB-DL.mkv` and
 * `Some Show - S01E02 - Title.mkv` sit in the same folder and should group.
 */
const readEpisodeFromPath = (filePath: string): EpisodeNumbering => {
  const parts = filePath.split('/').filter((part) => part !== '');
  const fileName = parts[parts.length - 1] ?? filePath;
  const parentName = parts[parts.length - 2] ?? '';
  const grandparentName = parts[parts.length - 3] ?? '';

  const numbering = EPISODE_PATTERNS.map((pattern) => pattern.exec(fileName)).find(
    (match) => match !== null,
  );

  const parentSeason = readSeasonDirectory(parentName);

  const seasonNumber =
    numbering?.groups?.season === undefined ? parentSeason : Number(numbering.groups.season);

  const episodeNumber =
    numbering?.groups?.episode === undefined ? null : Number(numbering.groups.episode);

  if (episodeNumber === null || numbering === undefined) {
    return {
      seriesTitle: null,
      seriesYear: null,
      seriesFolder: null,
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
    };
  }

  const beforeNumbering = fileName.slice(0, numbering.index).replace(/[-–—\s]+$/, '');
  const fileNameYear = findYear(beforeNumbering);
  const fromFileName = tidy(
    fileNameYear === null ? beforeNumbering : beforeNumbering.slice(0, fileNameYear.index),
  );

  const seriesDirectory = parentSeason === null ? parentName : grandparentName;
  const upFromFile = parentSeason === null ? 1 : 2;
  const seriesFolder =
    parts.length > upFromFile ? `/${parts.slice(0, parts.length - upFromFile).join('/')}` : null;
  const directoryYear = findYear(seriesDirectory);
  const tidiedDirectory = tidy(
    directoryYear === null ? seriesDirectory : seriesDirectory.slice(0, directoryYear.index),
  );
  const seriesTitle = fromFileName === '' ? tidiedDirectory : fromFileName;
  const seriesYear = directoryYear?.year ?? fileNameYear?.year ?? null;

  const afterNumbering = fileName.slice(numbering.index + numbering[0].length);
  const spoken = afterNumbering.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/^[-–—\s._]+/, '');

  const noise = RELEASE_NOISE.exec(spoken);

  const episodeTitle = tidy(
    (noise === null ? spoken : spoken.slice(0, noise.index)).replace(/\bby\s+\S+$/i, ''),
  );

  return {
    seriesTitle: seriesTitle === '' ? null : seriesTitle,
    seriesYear,
    seriesFolder,
    seasonNumber,
    episodeNumber,
    episodeTitle: episodeTitle === '' ? null : episodeTitle,
  };
};

/**
 * Whether two files are episodes of the same season.
 *
 * The question intro detection actually asks: comparing a file against
 * something from another show finds nothing, and comparing it against another
 * season finds a theme tune that may well have changed.
 */
const isSameSeason = (left: EpisodeNumbering, right: EpisodeNumbering): boolean =>
  left.seriesTitle !== null &&
  left.seasonNumber !== null &&
  left.seriesTitle.toLowerCase() === right.seriesTitle?.toLowerCase() &&
  left.seasonNumber === right.seasonNumber;

export type { EpisodeNumbering };

export { readEpisodeFromPath, readSeasonDirectory, isSameSeason, tidy };
