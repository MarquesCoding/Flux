import { findYear } from './readTitleFromPath';
import { readSeasonDirectory } from './readSeasonDirectory';

const EPISODE_PATTERNS = [
  /\bs(?<season>\d{1,2})[\s._-]*e(?<episode>\d{1,3})\b/i,
  /\b(?<season>\d{1,2})x(?<episode>\d{1,3})\b/i,
  /\bseason[\s._-]*(?<season>\d{1,2})[\s._-]*episode[\s._-]*(?<episode>\d{1,3})\b/i,
] as const;

const RELEASE_NOISE =
  /\b(?:\d{3,4}p|4k|uhd|web[\s._-]?dl|webrip|bluray|blu[\s._-]?ray|hdtv|dvdrip|remux|proper|repack|x26[45]|h\.?26[45]|hevc|avc|aac\d*|ac3|eac3|ddp?\d?|dts[\w]*|flac|opus|10bit|8bit|hdr\d*|dv|sdr|amzn|nf|dsnp|hulu|atvp|multi|dual)\b/i;

type EpisodeNumbering = {
  seriesTitle: string | null;
  seriesYear: number | null;
  seriesFolder: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
};

/**
 * Tidies a directory name into something worth showing, turning separators into spaces, dropping
 * the scene-release noise a folder name collects, and trimming what is left.
 *
 * @param name - The directory name as it is on disk.
 * @returns The name as a person would write it.
 */
const tidy = (name: string): string =>
  name
    .replace(/[[\]()_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Reads which programme, season and episode a file is from its path, using the folders above it as
 * well as its own name — a file called `s02e04.mkv` says nothing about which programme it belongs to,
 * and the folder holding it usually does.
 *
 * @param filePath - The file's full path inside the library.
 * @returns What could be read: the series, the season and the episode, each absent where the path
 *   did not say.
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
 * Decides whether two files are episodes of the same season of the same programme, which is what
 * decides whether they can be compared for a shared intro.
 *
 * @param left - One episode, as read from its path.
 * @param right - The episode to compare it against.
 * @returns Whether both name the same programme and the same season.
 */
const isSameSeason = (left: EpisodeNumbering, right: EpisodeNumbering): boolean =>
  left.seriesTitle !== null &&
  left.seasonNumber !== null &&
  left.seriesTitle.toLowerCase() === right.seriesTitle?.toLowerCase() &&
  left.seasonNumber === right.seasonNumber;

export type { EpisodeNumbering };

export { readEpisodeFromPath, isSameSeason, tidy };
