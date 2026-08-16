type Range = {
  startSeconds: number;
  endSeconds: number;
};

type SharedAudio = {
  left: Range;
  right: Range;
  frames: number;
};

type CompareOptions = {
  framesPerSecond: number;
  maxBitsDiffering?: number;
  minSeconds?: number;
  toleratedGapSeconds?: number;
};

const DEFAULT_MAX_BITS_DIFFERING = 6;

const DEFAULT_MIN_SECONDS = 15;

const DEFAULT_TOLERATED_GAP_SECONDS = 3;

const EXHAUSTIVE_LIMIT = 4_000_000;

const INDEX_MASK = 0xffff;

const CANDIDATE_OFFSETS = 24;

/**
 * Counts the bits by which two audio fingerprints differ, which is how alike two moments of sound
 * are: identical audio hashes identically, and a re-encode of the same audio differs in a handful
 * of bits rather than in half of them.
 *
 * @param left - One frame's fingerprint.
 * @param right - The frame to compare it against.
 * @returns How many bits differ, from zero to thirty two.
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
 * Measures the longest unbroken stretch of near-matching frames when two recordings are laid
 * against each other at one particular offset. A short run of mismatches inside a longer agreement
 * is tolerated rather than ending the run, since real recordings differ for a moment where one has
 * an announcement or a louder transfer.
 *
 * @param left - One recording's fingerprints, in order.
 * @param right - The other recording's fingerprints.
 * @param offset - How far to slide the second against the first, in frames.
 * @param maxBitsDiffering - How different two frames may be and still count as matching.
 * @param toleratedGap - How many mismatching frames may sit inside a run without ending it.
 * @returns Where the longest run starts in the first recording, and how long it is.
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
 * Proposes which alignments are worth measuring, rather than trying every one. Frames are indexed
 * by part of their fingerprint, so offsets that put identical-looking frames on top of each other
 * are found directly — comparing every offset against every other would be the length of one
 * recording multiplied by the other.
 *
 * @param left - One recording's fingerprints, in order.
 * @param right - The other recording's fingerprints.
 * @returns The offsets worth scoring, most promising first.
 */
const proposeOffsets = (left: number[], right: number[]): number[] => {
  const positions = new Map<number, number[]>();

  for (const [index, hash] of right.entries()) {
    const key = hash & INDEX_MASK;
    const seen = positions.get(key);

    if (seen === undefined) {
      positions.set(key, [index]);
    } else if (seen.length < 64) {
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
 * Finds the longest stretch of sound two recordings have in common, which is how an intro or a
 * credit sequence is detected: the same music appears in every episode, at a different point in
 * each. Works from fingerprints rather than from the audio itself, so two encodes of the same
 * material still match.
 *
 * @param left - One recording's fingerprints, in order.
 * @param right - The other recording's fingerprints.
 * @param options - How alike frames must be, how long a stretch has to be to count, and how much of a gap may sit inside one.
 * @returns Where the shared stretch falls in each recording, or null where they share nothing.
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
 * Decides whether two ranges are describing the same stretch of a recording, allowing for the ends
 * to disagree slightly — two comparisons of the same intro rarely find its edges in exactly the
 * same frame.
 *
 * @param left - One range.
 * @param right - The range to compare it against.
 * @param toleranceSeconds - How far the ends may differ and still count as the same stretch.
 * @returns Whether both ends agree within the tolerance.
 */
const overlaps = (left: Range, right: Range, toleranceSeconds: number): boolean =>
  Math.abs(left.startSeconds - right.startSeconds) <= toleranceSeconds &&
  Math.abs(left.endSeconds - right.endSeconds) <= toleranceSeconds;

/**
 * Settles on one range from many comparisons by taking the largest group that agree with each
 * other, and averaging their ends. Comparing an episode against several others gives several
 * answers, most of them the same intro and one or two of them noise; this is what picks the
 * consensus rather than the first or the longest.
 *
 * @param candidates - Every range the comparisons proposed.
 * @param toleranceSeconds - How far two ranges may differ and still be counted as agreeing.
 * @returns The agreed range, or null where nothing was proposed at all.
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

export type { Range };

export { findSharedAudio, agreeRange, bitsDiffering, overlaps };
