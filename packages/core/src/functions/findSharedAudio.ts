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
 * Finds the longest stretch of audio two recordings have in common.
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
