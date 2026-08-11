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
])

/**
 * Noise that appears in scene release names and is never part of a title.
 */
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
])

/**
 * Reports whether a file looks like something Flux can play.
 *
 * An extension allowlist rather than a denylist: a library directory contains
 * artwork, subtitles, `.nfo` files and assorted junk, and probing every one of
 * them would make a first scan needlessly slow.
 */
const isMediaFile = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  return !fileName.startsWith('.') && MEDIA_EXTENSIONS.has(extension)
}

const stripExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.')

  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
}

/**
 * Finds a release year in a piece of text, bracketed or bare.
 *
 * Shared between reading a title out of a filename and reading one out of a
 * series' folder name — "Ted (2024)" says which "Ted" exactly the same way
 * whether it names a file or a directory.
 */
const findYear = (text: string): { year: number; index: number } | null => {
  const matches = [...text.matchAll(/(?<open>[([])?\b(?<year>19\d{2}|20\d{2})\b\)?]?/g)]

  // A title can contain a year: "Blade Runner 2049 (2017)". A bracketed year
  // is the release year by convention, and failing that the last one is, since
  // the title comes first. Taking the first match reads 2049 as the year and
  // truncates the title.
  const yearMatch =
    matches.find((match) => match.groups?.open !== undefined) ?? matches[matches.length - 1]

  return yearMatch?.groups?.year === undefined
    ? null
    : { year: Number(yearMatch.groups.year), index: yearMatch.index }
}

/**
 * Reads a display title and year out of a filename.
 *
 * A best effort only. Filenames in real libraries are unreliable, which is why
 * nothing about playback is decided from them — this feeds the title shown in
 * the interface until a metadata provider plugin supplies something better.
 */
const readTitleFromPath = (filePath: string): { title: string; year: number | null } => {
  const fileName = filePath.split('/').pop() ?? filePath
  const base = stripExtension(fileName)

  const found = findYear(base)
  const year = found?.year ?? null
  const beforeYear = found === null ? base : base.slice(0, found.index)

  const words = beforeYear
    .replace(/[[\]()_.]+/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 0)
    .filter((word) => !NOISE.has(word.toLowerCase()))

  const title = words.join(' ').trim()

  return { title: title.length > 0 ? title : stripExtension(fileName), year }
}

export { isMediaFile, readTitleFromPath, findYear, MEDIA_EXTENSIONS }
