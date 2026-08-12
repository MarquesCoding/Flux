import type { MediaSegment, SegmentKind } from '@FluxContracts/schemas/MediaSegment';
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';

type SegmentCandidate = {
  mediaId: string;
  path: string;
  probe: MediaProbe;
  durationSeconds: number;
};

/**
 * Where the marked stretches of an item come from.
 *
 * The extension point a plugin implements to bring its own detection. Flux
 * ships two: one that reads chapters a release already named, and one that
 * finds what the episodes of a season have in common.
 *
 * A provider is given a whole group at once rather than one item at a time,
 * because the interesting question — what do these files share — cannot be
 * answered from a single file.
 */
type SegmentProvider = {
  name: string;
  /**
   * `onItemDone`, if a provider calls it, is told once for every item in the
   * group it has finished with — not what it found, just that one more is
   * behind it. Optional because a provider that answers instantly, like
   * chapters, has nothing worth reporting mid-flight.
   */
  detect: (
    group: SegmentCandidate[],
    onItemDone?: () => void,
  ) => Promise<Map<string, MediaSegment[]>>;
};

/**
 * The bounds a detected intro has to fall inside to be believed.
 *
 * A theme tune is not eight seconds and not eight minutes, and it does not
 * begin an hour into an episode. Anything outside this is a coincidence that
 * happened to survive the comparison.
 */
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
 * Whether a range is plausible for the kind of thing it claims to be.
 *
 * Detection produces measurements, and a measurement that says the intro is
 * forty minutes long is wrong however confidently it was arrived at. Refusing
 * it leaves the viewer with no button, which is far better than a button that
 * skips half the episode.
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

/**
 * Asks each provider in turn and keeps the first answer for each kind.
 *
 * Ordered rather than merged, so a chapter a human named beats a range a
 * machine measured. A provider that throws is skipped: detection is an
 * improvement to playback and must never stop it.
 */
/**
 * What detection found, and whether anything was actually able to look.
 *
 * The two are not the same and the difference decides whether a file is done
 * with. A provider that ran and found no theme tune has finished with that
 * episode; a provider that could not be reached has not started. Recording the
 * second as the first marks a whole library complete while the media service is
 * down, and nothing ever asks about those files again.
 */
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

export type { Detection, SegmentCandidate, SegmentProvider };

export { resolveSegments, isPlausible, INTRO_BOUNDS, CREDITS_BOUNDS };
