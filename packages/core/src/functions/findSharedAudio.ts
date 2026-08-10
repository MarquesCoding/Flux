type Range = {
  startSeconds: number
  endSeconds: number
}

type SharedAudio = {
  /**
   * Where the shared run sits in the first fingerprint.
   */
  left: Range
  /**
   * Where the same run sits in the second.
   */
  right: Range
  frames: number
}

type CompareOptions = {
  framesPerSecond: number
  /**
   * How many bits two hashes may differ by and still count as the same audio.
   *
   * Zero would demand bit-perfect agreement, which two encodes of the same
   * theme tune never quite reach. Too high and unrelated dialogue starts
   * matching. Six of thirty-two is loose enough for a re-encode and tight
   * enough that silence does not match noise.
   */
  maxBitsDiffering?: number
  /**
   * The shortest run worth reporting, in seconds.
   */
  minSeconds?: number
  /**
   * Gaps shorter than this are treated as part of the run.
   *
   * A theme tune is not identical throughout — a channel logo or a spoken
   * title lands over it — and without this the run would be chopped into
   * fragments none of which are long enough to report.
   */
  toleratedGapSeconds?: number
}

const DEFAULT_MAX_BITS_DIFFERING = 6

const DEFAULT_MIN_SECONDS = 15

const DEFAULT_TOLERATED_GAP_SECONDS = 3

/**
 * How many bits two hashes differ by.
 */
const bitsDiffering = (left: number, right: number): number => {
  let value = (left ^ right) >>> 0
  let count = 0

  while (value !== 0) {
    value &= value - 1
    count += 1
  }

  return count
}

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
  const from = Math.max(0, -offset)
  const to = Math.min(left.length, right.length - offset)

  let best = { start: 0, length: 0 }
  let runStart = -1
  let runEnd = -1
  let gap = 0

  for (let index = from; index < to; index += 1) {
    const matches = bitsDiffering(left[index] ?? 0, right[index + offset] ?? 0) <= maxBitsDiffering

    if (matches) {
      if (runStart === -1) {
        runStart = index
      }

      runEnd = index
      gap = 0

      continue
    }

    if (runStart === -1) {
      continue
    }

    gap += 1

    if (gap > toleratedGap) {
      if (runEnd - runStart + 1 > best.length) {
        best = { start: runStart, length: runEnd - runStart + 1 }
      }

      runStart = -1
      runEnd = -1
      gap = 0
    }
  }

  if (runStart !== -1 && runEnd - runStart + 1 > best.length) {
    best = { start: runStart, length: runEnd - runStart + 1 }
  }

  return best
}

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
  } = options

  if (left.length === 0 || right.length === 0 || framesPerSecond <= 0) {
    return null
  }

  const toleratedGap = Math.round(toleratedGapSeconds * framesPerSecond)
  const minFrames = Math.round(minSeconds * framesPerSecond)

  let best = { start: 0, length: 0, offset: 0 }

  for (let offset = -(left.length - 1); offset < right.length; offset += 1) {
    const run = longestRunAt(left, right, offset, maxBitsDiffering, toleratedGap)

    if (run.length > best.length) {
      best = { ...run, offset }
    }
  }

  if (best.length < minFrames) {
    return null
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
  }
}

/**
 * Whether two ranges describe the same stretch of a recording.
 */
const overlaps = (left: Range, right: Range, toleranceSeconds: number): boolean =>
  Math.abs(left.startSeconds - right.startSeconds) <= toleranceSeconds &&
  Math.abs(left.endSeconds - right.endSeconds) <= toleranceSeconds

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
    return null
  }

  let bestGroup: Range[] = []

  for (const candidate of candidates) {
    const group = candidates.filter((other) => overlaps(candidate, other, toleranceSeconds))

    if (group.length > bestGroup.length) {
      bestGroup = group
    }
  }

  if (bestGroup.length === 0) {
    return null
  }

  const median = (values: number[]): number => {
    const sorted = [...values].sort((first, second) => first - second)
    const middle = Math.floor(sorted.length / 2)

    return sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0)
  }

  return {
    startSeconds: median(bestGroup.map((range) => range.startSeconds)),
    endSeconds: median(bestGroup.map((range) => range.endSeconds)),
  }
}

export type { CompareOptions, Range, SharedAudio }

export default {
  findSharedAudio,
  agreeRange,
  bitsDiffering,
  longestRunAt,
  overlaps,
  DEFAULT_MAX_BITS_DIFFERING,
  DEFAULT_MIN_SECONDS,
}
