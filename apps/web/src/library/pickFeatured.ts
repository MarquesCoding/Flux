import type { MediaSummary } from '@FluxContracts/schemas/Library'

/**
 * Which item stands for a show.
 *
 * The earliest episode there is: somebody meeting a series on a home page is
 * being introduced to it, and being introduced at episode nine is no
 * introduction at all.
 */
const isEarlier = (candidate: MediaSummary, against: MediaSummary): boolean => {
  const season = (candidate.seasonNumber ?? 0) - (against.seasonNumber ?? 0)

  return season === 0 ? (candidate.episodeNumber ?? 0) < (against.episodeNumber ?? 0) : season < 0
}

/**
 * The items worth putting on the front of a library.
 *
 * One per show rather than one per file. A hero that rotates through every
 * episode of a series is a hero that shows the same programme twelve times
 * and calls each one a different thing — and the picture and the name a
 * viewer needs at that moment belong to the show, not to episode seven.
 *
 * Films stand for themselves, since there is nothing to group them under.
 */
const pickFeatured = (items: MediaSummary[], limit: number): MediaSummary[] => {
  const shows = new Map<string, MediaSummary>()
  const featured: MediaSummary[] = []

  for (const item of items) {
    const series = item.seriesTitle ?? null

    if (series === null) {
      featured.push(item)

      continue
    }

    const standing = shows.get(series)

    if (standing === undefined) {
      shows.set(series, item)
      // The place is claimed now and filled in later, so a show appears where
      // its first file did rather than being pushed to the end by an episode
      // that happened to be listed sooner.
      featured.push(item)

      continue
    }

    if (isEarlier(item, standing)) {
      shows.set(series, item)

      const at = featured.indexOf(standing)

      if (at !== -1) {
        featured[at] = item
      }
    }
  }

  return featured.slice(0, limit)
}

/**
 * The other episodes of the same season.
 *
 * In broadcast order and without the one being read about, because a list of
 * what to watch next that includes what is already open is a list with a hole
 * in it.
 */
const findSiblings = (items: MediaSummary[], of: MediaSummary): MediaSummary[] => {
  const series = of.seriesTitle ?? null

  if (series === null) {
    return []
  }

  return items
    .filter(
      (item) =>
        item.id !== of.id &&
        item.seriesTitle === series &&
        (item.seasonNumber ?? null) === (of.seasonNumber ?? null),
    )
    .sort((left, right) => (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0))
}

/**
 * What follows an episode.
 *
 * The next one in the same season, and nothing at all for a film or for the
 * last episode there is. A season that runs on into whatever happened to be
 * listed next would be worse than stopping.
 */
const nextEpisode = (items: MediaSummary[], after: MediaSummary): MediaSummary | null => {
  const at = after.episodeNumber ?? null

  if (at === null) {
    return null
  }

  return findSiblings(items, after).find((item) => (item.episodeNumber ?? 0) > at) ?? null
}

export { pickFeatured, isEarlier, findSiblings, nextEpisode }
