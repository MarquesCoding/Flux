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
] as const

const SEASON_DIRECTORY = /\b(?:season|series|s)[\s._-]*(?<season>\d{1,2})\b/i

const SPECIALS_DIRECTORY = /\b(?:specials?|extras?)\b/i

type EpisodeNumbering = {
  /**
   * The show this file belongs to, as far as the path says.
   *
   * Taken from the directory above the season where there is one, because a
   * filename is where release groups put their noise and a directory is where
   * people put the name.
   */
  seriesTitle: string | null
  seasonNumber: number | null
  episodeNumber: number | null
}

/**
 * Tidies a directory name into something readable.
 */
const tidy = (name: string): string =>
  name
    .replace(/[[\]()_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Reads the season a directory name declares.
 */
const readSeasonDirectory = (name: string): number | null => {
  if (SPECIALS_DIRECTORY.test(name)) {
    return 0
  }

  const match = SEASON_DIRECTORY.exec(name)

  return match?.groups?.season === undefined ? null : Number(match.groups.season)
}

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
  const parts = filePath.split('/').filter((part) => part !== '')
  const fileName = parts[parts.length - 1] ?? filePath
  const parentName = parts[parts.length - 2] ?? ''
  const grandparentName = parts[parts.length - 3] ?? ''

  const numbering = EPISODE_PATTERNS.map((pattern) => pattern.exec(fileName)).find(
    (match) => match !== null,
  )

  const parentSeason = readSeasonDirectory(parentName)

  const seasonNumber =
    numbering?.groups?.season === undefined ? parentSeason : Number(numbering.groups.season)

  const episodeNumber =
    numbering?.groups?.episode === undefined ? null : Number(numbering.groups.episode)

  if (episodeNumber === null) {
    return { seriesTitle: null, seasonNumber: null, episodeNumber: null }
  }

  // A season directory means the one above it names the show. Without one, the
  // immediate parent is the best guess available.
  const seriesDirectory = parentSeason === null ? parentName : grandparentName
  const seriesTitle = tidy(seriesDirectory)

  return {
    seriesTitle: seriesTitle === '' ? null : seriesTitle,
    seasonNumber,
    episodeNumber,
  }
}

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
  left.seasonNumber === right.seasonNumber

export type { EpisodeNumbering }

export default { readEpisodeFromPath, readSeasonDirectory, isSameSeason, tidy }
