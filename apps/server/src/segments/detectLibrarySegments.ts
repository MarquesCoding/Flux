import { resolveSegments } from './SegmentProvider';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { SegmentService } from './SegmentService';

type GroupedCandidate = SegmentCandidate & {
  seriesId: string | null;
  seasonNumber: number | null;
  isComplete: boolean;
};

type DetectLibrarySegmentsOptions = {
  libraryId: string;
  providers: SegmentProvider[];
  segments: SegmentService;
  listCandidates: (libraryId: string) => Promise<GroupedCandidate[]>;
  markComplete: (mediaId: string) => Promise<void>;
  onProblem?: (provider: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  isCancelled?: () => boolean;
};

/**
 * Sorts a library's files into the groups worth comparing — episodes of the same season of the same
 * programme, which is where a shared intro would be. Comparing across programmes would be work spent
 * to find nothing.
 *
 * @param candidates - The library's items.
 * @returns The files grouped, one group per season.
 */
const groupBySeason = (candidates: GroupedCandidate[]): Map<string, GroupedCandidate[]> => {
  const groups = new Map<string, GroupedCandidate[]>();

  for (const candidate of candidates) {
    const key =
      candidate.seriesId === null || candidate.seasonNumber === null
        ? `film:${candidate.mediaId}`
        : `${candidate.seriesId}:${candidate.seasonNumber.toString()}`;

    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return groups;
};

/**
 * Finds and records the intros, recaps and credits across a library, reading chapters where files
 * carry them and listening to the audio where they do not. Reports progress as it goes, since
 * fingerprinting a season is minutes of work.
 *
 * @param options - The library to work through, the providers to ask, where to record what is
 *   found, and where to report progress.
 * @returns How many items were marked.
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

export type { GroupedCandidate };

export { detectLibrarySegments, groupBySeason };
