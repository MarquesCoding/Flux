import WatchProgressModule from '@FluxContracts/schemas/WatchProgress'
import type { MediaSummary } from '@FluxContracts/schemas/Library'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'

const { isWorthResuming } = WatchProgressModule

type Rail = {
  /**
   * Stable across renders, so React keeps a row's scroll position when the
   * library around it changes.
   */
  id: string
  title: string
  items: MediaSummary[]
}

/**
 * How many items a row shows before it is just a list again.
 */
const RAIL_LIMIT = 24

/**
 * The fewest episodes worth a row of their own.
 *
 * One episode of something is not a season, and a row containing a single card
 * looks like a mistake.
 */
const MIN_SERIES_ITEMS = 2

/**
 * How recently something must have arrived to count as new.
 */
const RECENT_DAYS = 30

/**
 * Reads a timestamp, treating anything unreadable as long ago.
 */
const addedAtMs = (media: MediaSummary): number => {
  const parsed = Date.parse(media.addedAt)

  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Orders episodes the way they are watched.
 *
 * By season and then by episode, rather than by title: `Episode 10` sorts
 * before `Episode 2` alphabetically, which is no use to anyone.
 */
const inBroadcastOrder = (left: MediaSummary, right: MediaSummary): number => {
  const season = (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0)

  if (season !== 0) {
    return season
  }

  const episode = (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0)

  return episode === 0 ? left.title.localeCompare(right.title) : episode
}

/**
 * Names a season the way someone would say it out loud.
 */
const describeSeason = (seriesTitle: string, seasonNumber: number | null | undefined): string => {
  if (seasonNumber === null || seasonNumber === undefined) {
    return seriesTitle
  }

  return seasonNumber === 0
    ? `${seriesTitle} · Specials`
    : `${seriesTitle} · Season ${seasonNumber}`
}

/**
 * Sorts a library into the rows it is browsed by.
 *
 * A library is not one list, it is several: what arrived recently, each season
 * of each series, and everything else. Rows rather than a grid because that is
 * how someone browses when they do not already know what they want.
 *
 * Nothing here invents a row it cannot fill. Continue watching appears only
 * once there is something to continue, because a row that is always empty
 * teaches people to ignore rows.
 */
const groupIntoRails = (
  items: MediaSummary[],
  now = Date.now(),
  progress: Map<string, WatchProgress> = new Map(),
): Rail[] => {
  if (items.length === 0) {
    return []
  }

  const rails: Rail[] = []

  // What someone left half watched comes first, most recently left at the
  // front. It is the one row that knows what a particular person was doing,
  // which makes it the only row worth putting above everything else.
  const resuming = items
    .filter((media) => {
      const found = progress.get(media.id)

      return found !== undefined && isWorthResuming(found)
    })
    .sort((left, right) => {
      const leftAt = Date.parse(progress.get(left.id)?.updatedAt ?? '')
      const rightAt = Date.parse(progress.get(right.id)?.updatedAt ?? '')

      return (Number.isNaN(rightAt) ? 0 : rightAt) - (Number.isNaN(leftAt) ? 0 : leftAt)
    })
    .slice(0, RAIL_LIMIT)

  if (resuming.length > 0) {
    rails.push({ id: 'resume', title: 'Continue watching', items: resuming })
  }
  const recentThreshold = now - RECENT_DAYS * 24 * 60 * 60 * 1000

  // One card per programme rather than one per episode. A series that arrived
  // whole would otherwise fill this row with twelve pictures of itself, which
  // says less than one picture of it does.
  const seenSeries = new Set<string>()

  const recent = [...items]
    .filter((media) => addedAtMs(media) >= recentThreshold)
    .sort((left, right) => addedAtMs(right) - addedAtMs(left))
    .filter((media) => {
      const series = media.seriesTitle ?? ''

      if (series === '') {
        return true
      }

      const named = series.toLowerCase()

      if (seenSeries.has(named)) {
        return false
      }

      seenSeries.add(named)

      return true
    })
    .slice(0, RAIL_LIMIT)

  if (recent.length > 0) {
    rails.push({ id: 'recent', title: 'Recently added', items: recent })
  }

  const seasons = new Map<string, MediaSummary[]>()
  const films: MediaSummary[] = []

  for (const media of items) {
    if (media.seriesTitle === null || media.seriesTitle === undefined || media.seriesTitle === '') {
      films.push(media)

      continue
    }

    const key = `${media.seriesTitle.toLowerCase()}:${(media.seasonNumber ?? 0).toString()}`

    seasons.set(key, [...(seasons.get(key) ?? []), media])
  }

  for (const [key, episodes] of seasons) {
    if (episodes.length < MIN_SERIES_ITEMS) {
      films.push(...episodes)

      continue
    }

    const first = episodes[0]

    if (first?.seriesTitle === null || first?.seriesTitle === undefined) {
      continue
    }

    rails.push({
      id: `season:${key}`,
      title: describeSeason(first.seriesTitle, first.seasonNumber),
      items: [...episodes].sort(inBroadcastOrder).slice(0, RAIL_LIMIT),
    })
  }

  if (films.length > 0) {
    rails.push({
      id: 'everything',
      title: rails.length === 0 ? 'Everything' : 'Films',
      items: [...films].sort((left, right) => left.title.localeCompare(right.title)),
    })
  }

  return rails
}

export type { Rail }

export default {
  groupIntoRails,
  describeSeason,
  inBroadcastOrder,
  RAIL_LIMIT,
  MIN_SERIES_ITEMS,
  RECENT_DAYS,
}
