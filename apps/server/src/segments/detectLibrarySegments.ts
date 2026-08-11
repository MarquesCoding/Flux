import SegmentProviderModule from './SegmentProvider'
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider'
import type { SegmentService } from './SegmentService'

const { resolveSegments } = SegmentProviderModule

type GroupedCandidate = SegmentCandidate & {
  /**
   * What the path said about where this file sits. Files that say nothing are
   * films, and a film has no siblings to be compared against.
   */
  seriesTitle: string | null
  seasonNumber: number | null
}

type DetectLibrarySegmentsOptions = {
  libraryId: string
  providers: SegmentProvider[]
  segments: SegmentService
  listCandidates: (libraryId: string) => Promise<GroupedCandidate[]>
  onProblem?: (provider: string, reason: string) => void
  /**
   * Told after every season, how many of the library's seasons have been
   * looked at.
   */
  onProgress?: (processed: number, total: number) => void
}

/**
 * Sorts a library's files into the groups worth comparing.
 *
 * A season is the unit, not a series: a theme tune is often re-recorded
 * between seasons, and comparing across them finds either nothing or something
 * misleading. Films are left out entirely — they have nothing to be compared
 * against, and a chapter provider reads them one at a time anyway.
 */
const groupBySeason = (candidates: GroupedCandidate[]): Map<string, GroupedCandidate[]> => {
  const groups = new Map<string, GroupedCandidate[]>()

  for (const candidate of candidates) {
    const key =
      candidate.seriesTitle === null || candidate.seasonNumber === null
        ? `film:${candidate.mediaId}`
        : `${candidate.seriesTitle.toLowerCase()}:${candidate.seasonNumber.toString()}`

    groups.set(key, [...(groups.get(key) ?? []), candidate])
  }

  return groups
}

/**
 * Finds and records the marked stretches of a library.
 *
 * Runs after a scan rather than during one: a scan should finish in the time it
 * takes to walk a directory, and listening to a season takes far longer than
 * that.
 */
const detectLibrarySegments = async ({
  libraryId,
  providers,
  segments,
  listCandidates,
  onProblem,
  onProgress,
}: DetectLibrarySegmentsOptions): Promise<number> => {
  const groups = groupBySeason(await listCandidates(libraryId))
  const total = groups.size
  let processed = 0
  let marked = 0

  onProgress?.(processed, total)

  for (const [, group] of groups) {
    const found = await resolveSegments(providers, group, onProblem)

    for (const [mediaId, detected] of found) {
      await segments.replace(mediaId, detected)
      marked += 1
    }

    processed += 1
    onProgress?.(processed, total)
  }

  return marked
}

export type { DetectLibrarySegmentsOptions, GroupedCandidate }

export default { detectLibrarySegments, groupBySeason }
