import { readSeasonDirectory } from './readSeasonDirectory';

const MEDIA_EXTENSIONS = new Set([
  'mkv',
  'mp4',
  'm4v',
  'mov',
  'avi',
  'webm',
  'ts',
  'm2ts',
  'mpg',
  'mpeg',
  'wmv',
  'flv',
  'ogv',
  '3gp',
]);

const NOISE = new Set([
  '1080p',
  '2160p',
  '720p',
  '480p',
  '4k',
  'uhd',
  'hdr',
  'hdr10',
  'dv',
  'dolbyvision',
  'bluray',
  'bdrip',
  'brrip',
  'webrip',
  'web',
  'webdl',
  'hdtv',
  'dvdrip',
  'remux',
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'avc',
  'av1',
  'xvid',
  'divx',
  'aac',
  'ac3',
  'eac3',
  'dts',
  'dtshd',
  'truehd',
  'atmos',
  'flac',
  'mp3',
  'opus',
  '5',
  '1',
  '7',
  '2',
  'proper',
  'repack',
  'extended',
  'unrated',
  'imax',
  'remastered',
  'multi',
  'dual',
  '10bit',
  '8bit',
  'sub',
  'subs',
  'subbed',
  'dub',
  'dubbed',
  'ita',
  'eng',
  'jap',
  'jpn',
  'fre',
  'ger',
  'spa',
  'amzn',
  'nf',
  'dsnp',
  'hulu',
  'atvp',
  'ddp',
  'sdr',
]);

/**
 * Decides whether a file is worth probing, from its extension alone. A library holds artwork,
 * subtitles, sample clips and stray archives, and probing each of them costs a process launch for an
 * answer already known from the name.
 *
 * @param fileName - The file's path.
 * @returns Whether it looks like something to play.
 */
const isMediaFile = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  return !fileName.startsWith('.') && MEDIA_EXTENSIONS.has(extension);
};

/**
 * Drops a filename's extension before anything tries to read a title out of it, leaving a leading
 * dot alone so that a hidden file does not become an empty name.
 *
 * @param fileName - The filename.
 * @returns It without its extension.
 */
const stripExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');

  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};

/**
 * Finds a release year in a piece of text, bracketed or bare, ignoring numbers that cannot be one —
 * a resolution, a track count, a year before films existed.
 *
 * @param text - The filename or folder name to read.
 * @returns The year, or null where the text names none.
 */
const findYear = (text: string): { year: number; index: number } | null => {
  const matches = [...text.matchAll(/(?<open>[([])?\b(?<year>19\d{2}|20\d{2})\b\)?]?/g)];

  const yearMatch =
    matches.find((match) => match.groups?.open !== undefined) ?? matches[matches.length - 1];

  return yearMatch?.groups?.year === undefined
    ? null
    : { year: Number(yearMatch.groups.year), index: yearMatch.index };
};

/**
 * Reads a title and a year out of one name, stripping the scene-release noise that surrounds them:
 * resolutions, codecs, source tags, group names.
 *
 * @param name - A filename without its extension, or a folder's name.
 * @returns The year where the name gave one, and the title, which is null where nothing survived
 *   the stripping — a folder called `2019` names a year and no film.
 */
const readName = (name: string): { title: string | null; year: number | null } => {
  const found = findYear(name);
  const year = found?.year ?? null;
  const beforeYear = found === null ? name : name.slice(0, found.index);

  const words = beforeYear
    .replace(/[[\]()_.]+/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 0)
    .filter((word) => !NOISE.has(word.toLowerCase()));

  const title = words.join(' ').trim();

  return { title: title.length > 0 ? title : null, year };
};

/**
 * Reads a title and a year for a file, from its own name and from the folder holding it. This is the
 * whole of the built-in metadata provider, and what a library falls back to when no catalogue is
 * configured or none recognises a file.
 *
 * A filename naming no year is weak evidence, and a folder deliberately called `Arrival (2016)` is
 * strong, so in that one case the folder is believed instead — which is what makes a folder-per-film
 * collection readable when whatever filled it left `movie.mkv` or `title00.mkv` inside. Edition
 * wording carried only by the filename is lost with it; identity is worth more than a suffix.
 *
 * A folder that names a season is never read this way. That is a programme, and the file's own name
 * is all there is to go on.
 *
 * @param filePath - The file's path inside the library.
 * @returns The title as it should be shown, and the year where either name gave one.
 */
const readTitleFromPath = (filePath: string): { title: string; year: number | null } => {
  const parts = filePath.split('/').filter((part) => part !== '');
  const fileName = parts[parts.length - 1] ?? filePath;
  const folderName = parts[parts.length - 2] ?? '';

  const fromFile = readName(stripExtension(fileName));
  const own = { title: fromFile.title ?? stripExtension(fileName), year: fromFile.year };

  if (fromFile.year !== null || readSeasonDirectory(folderName) !== null) {
    return own;
  }

  const fromFolder = readName(folderName);

  return fromFolder.year !== null && fromFolder.title !== null
    ? { title: fromFolder.title, year: fromFolder.year }
    : own;
};

export { isMediaFile, readTitleFromPath, findYear };
