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
 * Reports whether a file looks like something Flux can play.
 */
const isMediaFile = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  return !fileName.startsWith('.') && MEDIA_EXTENSIONS.has(extension);
};

const stripExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');

  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};

/**
 * Finds a release year in a piece of text, bracketed or bare.
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
 * Reads a display title and year out of a filename.
 */
const readTitleFromPath = (filePath: string): { title: string; year: number | null } => {
  const fileName = filePath.split('/').pop() ?? filePath;
  const base = stripExtension(fileName);

  const found = findYear(base);
  const year = found?.year ?? null;
  const beforeYear = found === null ? base : base.slice(0, found.index);

  const words = beforeYear
    .replace(/[[\]()_.]+/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 0)
    .filter((word) => !NOISE.has(word.toLowerCase()));

  const title = words.join(' ').trim();

  return { title: title.length > 0 ? title : stripExtension(fileName), year };
};

export { isMediaFile, readTitleFromPath, findYear, MEDIA_EXTENSIONS };
