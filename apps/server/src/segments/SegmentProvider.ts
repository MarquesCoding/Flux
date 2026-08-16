import type { MediaSegment, SegmentKind } from '@FluxContracts/schemas/MediaSegment';
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';

type SegmentCandidate = {
  mediaId: string;
  path: string;
  probe: MediaProbe;
  durationSeconds: number;
};

type SegmentProvider = {
  name: string;
  detect: (
    group: SegmentCandidate[],
    onItemDone?: () => void,
  ) => Promise<Map<string, MediaSegment[]>>;
};

const INTRO_BOUNDS = {
  minSeconds: 10,
  maxSeconds: 180,
  maxStartFraction: 0.4,
} as const;

const CREDITS_BOUNDS = {
  minSeconds: 15,
  maxSeconds: 300,
  minStartFraction: 0.6,
} as const;

/**
 * Decides whether a marked stretch is plausible for what it claims to be — an intro that runs
 * twenty minutes, or a recap at the very end, is a detection gone wrong rather than an unusual
 * episode, and skipping it would lose real film.
 *
 * @param segment - The stretch found, with what it claims to be.
 * @param durationSeconds - How long the item is.
 * @returns Whether it is worth recording.
 */
const isPlausible = (
  segment: { kind: SegmentKind; startSeconds: number; endSeconds: number },
  durationSeconds: number,
): boolean => {
  const length = segment.endSeconds - segment.startSeconds;

  if (length <= 0 || segment.startSeconds < 0 || segment.endSeconds > durationSeconds + 1) {
    return false;
  }

  if (segment.kind === 'intro' || segment.kind === 'recap') {
    return (
      length >= INTRO_BOUNDS.minSeconds &&
      length <= INTRO_BOUNDS.maxSeconds &&
      segment.startSeconds <= durationSeconds * INTRO_BOUNDS.maxStartFraction
    );
  }

  if (segment.kind === 'credits') {
    return (
      length >= CREDITS_BOUNDS.minSeconds &&
      length <= CREDITS_BOUNDS.maxSeconds &&
      segment.startSeconds >= durationSeconds * CREDITS_BOUNDS.minStartFraction
    );
  }

  return true;
};

type Detection = {
  segments: Map<string, MediaSegment[]>;
  wasAsked: boolean;
};

const resolveSegments = async (
  providers: SegmentProvider[],
  group: SegmentCandidate[],
  onProblem?: (provider: string, reason: string) => void,
  onItemDone?: () => void,
): Promise<Detection> => {
  const resolved = new Map<string, MediaSegment[]>();
  const durations = new Map(group.map((item) => [item.mediaId, item.durationSeconds]));
  let answered = false;

  for (const provider of providers) {
    let found: Map<string, MediaSegment[]>;

    try {
      found = await provider.detect(group, onItemDone);
      answered = true;
    } catch (error) {
      onProblem?.(provider.name, error instanceof Error ? error.message : 'Detection failed.');

      continue;
    }

    for (const [mediaId, segments] of found) {
      const existing = resolved.get(mediaId) ?? [];
      const kinds = new Set(existing.map((segment) => segment.kind));

      const additions = segments.filter(
        (segment) =>
          !kinds.has(segment.kind) && isPlausible(segment, durations.get(mediaId) ?? Infinity),
      );

      if (additions.length > 0) {
        resolved.set(mediaId, [...existing, ...additions]);
      }
    }
  }

  return { segments: resolved, wasAsked: answered };
};

export type { SegmentCandidate, SegmentProvider };

export { resolveSegments, isPlausible, INTRO_BOUNDS };
