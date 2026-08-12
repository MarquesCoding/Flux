import { resolveSegments } from './SegmentProvider';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { SegmentService } from './SegmentService';

type GroupedCandidate = SegmentCandidate & {
  /**
   * What the path said about where this file sits. Files that say nothing are
   * films, and a film has no siblings to be compared against.
   */
  seriesTitle: string | null;
  seasonNumber: number | null;
  /**
   * Whether this file has already been listened to.
   *
   * Per file rather than per season, but acted on per season — see
   * `detectLibrarySegments`.
   */
  isComplete: boolean;
};

type DetectLibrarySegmentsOptions = {
  libraryId: string;
  providers: SegmentProvider[];
  segments: SegmentService;
  listCandidates: (libraryId: string) => Promise<GroupedCandidate[]>;
  /**
   * Records that a file has been listened to, whatever was or was not found
   * in it.
   *
   * An episode with no intro is still an episode that has been checked, so
   * finding nothing marks it done — otherwise the one file in a season with
   * no theme tune would be re-fingerprinted forever.
   */
  markComplete: (mediaId: string) => Promise<void>;
  onProblem?: (provider: string, reason: string) => void;
  /**
   * Told after every season, how many of the library's episodes have been
   * looked at.
   *
   * Counted in episodes rather than seasons: a library's few seasons say
   * nothing about how much listening is left, and a season of one and a
   * season of twenty should not look like equal steps.
   */
  onProgress?: (processed: number, total: number) => void;
  /**
   * Asked between seasons whether somebody has stopped this job.
   *
   * A season is the smallest unit worth finishing — its episodes are compared
   * against each other, and half a comparison answers nothing. Only the
   * seasons that were finished are marked, so the next run starts at the one
   * this stopped before.
   */
  isCancelled?: () => boolean;
};

/**
 * Sorts a library's files into the groups worth comparing.
 *
 * A season is the unit, not a series: a theme tune is often re-recorded
 * between seasons, and comparing across them finds either nothing or something
 * misleading. Films are left out entirely — they have nothing to be compared
 * against, and a chapter provider reads them one at a time anyway.
 */
const groupBySeason = (candidates: GroupedCandidate[]): Map<string, GroupedCandidate[]> => {
  const groups = new Map<string, GroupedCandidate[]>();

  for (const candidate of candidates) {
    const key =
      candidate.seriesTitle === null || candidate.seasonNumber === null
        ? `film:${candidate.mediaId}`
        : `${candidate.seriesTitle.toLowerCase()}:${candidate.seasonNumber.toString()}`;

    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return groups;
};

/**
 * Finds and records the marked stretches of a library.
 *
 * Runs after a scan rather than during one: a scan should finish in the time it
 * takes to walk a directory, and listening to a season takes far longer than
 * that.
 *
 * A season nothing could be asked about is left outstanding rather than marked
 * done. A media service that is down must cost a library a delay, not its
 * intros: marking those files complete is a decision nothing ever revisits.
 *
 * Only the seasons with something outstanding, but each of those in full. A
 * season is the unit of comparison — an episode fingerprinted on its own has
 * nothing to match against — so one new episode brings its whole season back
 * through, and every episode in that season is marked afterwards. A library
 * where nothing has changed does no listening at all, which is what makes a
 * nightly run of this affordable.
 */
const detectLibrarySegments = async ({
  libraryId,
  providers,
  segments,
  listCandidates,
  markComplete,
  onProblem,
  onProgress,
  isCancelled,
}: DetectLibrarySegmentsOptions): Promise<number> => {
  const groups = [...groupBySeason(await listCandidates(libraryId))].filter(([, group]) =>
    group.some((candidate) => !candidate.isComplete),
  );
  const total = groups.reduce((sum, [, group]) => sum + group.length, 0);
  let processed = 0;
  let marked = 0;

  onProgress?.(processed, total);

  for (const [, group] of groups) {
    if (isCancelled?.() === true) {
      return marked;
    }

    const baseline = processed;

    const { segments: found, wasAsked } = await resolveSegments(providers, group, onProblem, () => {
      processed += 1;
      onProgress?.(Math.min(processed, baseline + group.length), total);
    });

    for (const [mediaId, detected] of found) {
      await segments.replace(mediaId, detected);
      marked += 1;
    }

    if (wasAsked) {
      for (const candidate of group) {
        await markComplete(candidate.mediaId);
      }
    }

    processed = baseline + group.length;
    onProgress?.(processed, total);
  }

  return marked;
};

export type { DetectLibrarySegmentsOptions, GroupedCandidate };

export { detectLibrarySegments, groupBySeason };
