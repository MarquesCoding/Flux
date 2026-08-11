type Range = {
  startSeconds: number;
  endSeconds: number;
};

type SharedAudio = {
  /**
   * Where the shared run sits in the first fingerprint.
   */
  left: Range;
  /**
   * Where the same run sits in the second.
   */
  right: Range;
  frames: number;
};

type CompareOptions = {
  framesPerSecond: number;
  /**
   * How many bits two hashes may differ by and still count as the same audio.
   *
   * Zero would demand bit-perfect agreement, which two encodes of the same
   * theme tune never quite reach. Too high and unrelated dialogue starts
   * matching. Six of thirty-two is loose enough for a re-encode and tight
   * enough that silence does not match noise.
   */
  maxBitsDiffering?: number;
  /**
   * The shortest run worth reporting, in seconds.
   */
  minSeconds?: number;
  /**
   * Gaps shorter than this are treated as part of the run.
   *
   * A theme tune is not identical throughout — a channel logo or a spoken
   * title lands over it — and without this the run would be chopped into
   * fragments none of which are long enough to report.
   */
  toleratedGapSeconds?: number;
};

const DEFAULT_MAX_BITS_DIFFERING = 6;

const DEFAULT_MIN_SECONDS = 15;

const DEFAULT_TOLERATED_GAP_SECONDS = 3;

/**
 * How much work is worth doing exhaustively.
 *
 * Trying every alignment is exact and costs the product of the two lengths. On
 * ten minutes of audio that is ninety million comparisons per pair, which is
 * minutes of arithmetic for one season. Below this, exhaustive is instant and
 * worth keeping.
 */
const EXHAUSTIVE_LIMIT = 4_000_000;

/**
 * The bits an offset is proposed from.
 *
 * The low bits compare the lowest frequency bands, which are the ones that
 * survive re-encoding best. Indexing on them finds the frames two recordings
 * genuinely share without demanding they agree bit for bit.
 */
const INDEX_MASK = 0xffff;

/**
 * How many proposed alignments are worth scoring properly.
 */
const CANDIDATE_OFFSETS = 24;

/**
 * How many bits two hashes differ by.
 */
const bitsDiffering = (left: number, right: number): number => {
  let value = (left ^ right) >>> 0;
  let count = 0;

  while (value !== 0) {
    value &= value - 1;
    count += 1;
  }

  return count;
};

/**
 * The longest run of near-matching frames at one alignment.
 *
 * Runs are allowed to survive a short interruption, so a title card spoken
 * over a theme tune does not split one intro into three fragments.
 */
const longestRunAt = (
  left: number[],
  right: number[],
  offset: number,
  maxBitsDiffering: number,
  toleratedGap: number,
): { start: number; length: number } => {
  const from = Math.max(0, -offset);
  const to = Math.min(left.length, right.length - offset);

  let best = { start: 0, length: 0 };
  let runStart = -1;
  let runEnd = -1;
  let gap = 0;

  for (let index = from; index < to; index += 1) {
    const matches = bitsDiffering(left[index] ?? 0, right[index + offset] ?? 0) <= maxBitsDiffering;

    if (matches) {
      if (runStart === -1) {
        runStart = index;
      }

      runEnd = index;
      gap = 0;

      continue;
    }

    if (runStart === -1) {
      continue;
    }

    gap += 1;

    if (gap > toleratedGap) {
      if (runEnd - runStart + 1 > best.length) {
        best = { start: runStart, length: runEnd - runStart + 1 };
      }

      runStart = -1;
      runEnd = -1;
      gap = 0;
    }
  }

  if (runStart !== -1 && runEnd - runStart + 1 > best.length) {
    best = { start: runStart, length: runEnd - runStart + 1 };
  }

  return best;
};

/**
 * Proposes the alignments worth scoring.
 *
 * Every frame of one recording votes for the offsets at which a frame of the
 * other carries the same robust bits. Real shared audio casts thousands of
 * votes at one offset; coincidences scatter theirs. Scoring only the winners
 * turns a quadratic search into a linear one.
 *
 * Alignment cannot be approximated — a run misaligned by a single frame
 * matches nothing at all — which is why this narrows *which* offsets to try
 * rather than how carefully to try them.
 */
const proposeOffsets = (left: number[], right: number[]): number[] => {
  const positions = new Map<number, number[]>();

  for (const [index, hash] of right.entries()) {
    const key = hash & INDEX_MASK;
    const seen = positions.get(key);

    if (seen === undefined) {
      positions.set(key, [index]);
    } else if (seen.length < 64) {
      // A hash appearing everywhere is silence or a drone, and says nothing
      // about alignment. Capping keeps one such hash from dominating.
      seen.push(index);
    }
  }

  const votes = new Map<number, number>();

  for (const [index, hash] of left.entries()) {
    for (const position of positions.get(hash & INDEX_MASK) ?? []) {
      const offset = position - index;

      votes.set(offset, (votes.get(offset) ?? 0) + 1);
    }
  }

  return [...votes.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, CANDIDATE_OFFSETS)
    .map(([offset]) => offset);
};

/**
 * Finds the longest stretch of audio two recordings have in common.
 *
 * Two episodes of the same series share exactly one substantial thing: the
 * music that opens both of them. Everything else — dialogue, effects, score —
 * is different, so the longest run of frames that fingerprint alike is the
 * theme, and its length and position are the intro.
 *
 * Every alignment of the two sequences is tried, because an intro rarely
 * begins at the same second in two episodes: one has a longer cold open than
 * the other.
 */
const findSharedAudio = (
  left: number[],
  right: number[],
  options: CompareOptions,
): SharedAudio | null => {
  const {
    framesPerSecond,
    maxBitsDiffering = DEFAULT_MAX_BITS_DIFFERING,
    minSeconds = DEFAULT_MIN_SECONDS,
    toleratedGapSeconds = DEFAULT_TOLERATED_GAP_SECONDS,
  } = options;

  if (left.length === 0 || right.length === 0 || framesPerSecond <= 0) {
    return null;
  }

  const toleratedGap = Math.round(toleratedGapSeconds * framesPerSecond);
  const minFrames = Math.round(minSeconds * framesPerSecond);

  let best = { start: 0, length: 0, offset: 0 };

  const offsets =
    left.length * right.length <= EXHAUSTIVE_LIMIT
      ? Array.from(
          { length: left.length + right.length - 1 },
          (_, index) => index - left.length + 1,
        )
      : proposeOffsets(left, right);

  for (const offset of offsets) {
    const run = longestRunAt(left, right, offset, maxBitsDiffering, toleratedGap);

    if (run.length > best.length) {
      best = { ...run, offset };
    }
  }

  if (best.length < minFrames) {
    return null;
  }

  return {
    left: {
      startSeconds: best.start / framesPerSecond,
      endSeconds: (best.start + best.length) / framesPerSecond,
    },
    right: {
      startSeconds: (best.start + best.offset) / framesPerSecond,
      endSeconds: (best.start + best.offset + best.length) / framesPerSecond,
    },
    frames: best.length,
  };
};

/**
 * Whether two ranges describe the same stretch of a recording.
 */
const overlaps = (left: Range, right: Range, toleranceSeconds: number): boolean =>
  Math.abs(left.startSeconds - right.startSeconds) <= toleranceSeconds &&
  Math.abs(left.endSeconds - right.endSeconds) <= toleranceSeconds;

/**
 * Settles on the range the most comparisons agreed about.
 *
 * One pair of episodes can agree on nonsense — a shared stretch of near
 * silence, or a sound effect both happen to use. A range several independent
 * pairs land on is the theme tune. The answer is the median of the agreeing
 * group rather than any single measurement, so one loose match cannot drag the
 * boundary.
 */
const agreeRange = (candidates: Range[], toleranceSeconds = 4): Range | null => {
  if (candidates.length === 0) {
    return null;
  }

  let bestGroup: Range[] = [];

  for (const candidate of candidates) {
    const group = candidates.filter((other) => overlaps(candidate, other, toleranceSeconds));

    if (group.length > bestGroup.length) {
      bestGroup = group;
    }
  }

  if (bestGroup.length === 0) {
    return null;
  }

  const median = (values: number[]): number => {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  };

  return {
    startSeconds: median(bestGroup.map((range) => range.startSeconds)),
    endSeconds: median(bestGroup.map((range) => range.endSeconds)),
  };
};

export type { CompareOptions, Range, SharedAudio };

export {
  findSharedAudio,
  proposeOffsets,
  agreeRange,
  bitsDiffering,
  longestRunAt,
  overlaps,
  DEFAULT_MAX_BITS_DIFFERING,
  DEFAULT_MIN_SECONDS,
};
