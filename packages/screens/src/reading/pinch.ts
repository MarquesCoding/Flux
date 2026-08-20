const CLOSEST = 1;

const FURTHEST = 5;

type Point = { clientX: number; clientY: number };

/**
 * How far apart two fingers are.
 *
 * @param one - One finger.
 * @param other - The other.
 * @returns The distance between them.
 */
const distanceBetween = (one: Point, other: Point): number =>
  Math.hypot(other.clientX - one.clientX, other.clientY - one.clientY);

/**
 * What a pinch has done to the size of the page.
 *
 * Measured against where the fingers started rather than where they were a moment ago, so that a
 * pinch that wanders is still the same pinch — comparing each move to the last accumulates its own
 * rounding, and a page that drifts while somebody holds still is worse than one that lags.
 *
 * Held between its own size and five times it. Smaller than its own size is what the fit settings are
 * for, and further in than five times a page is a screenful of paper texture.
 *
 * @param base - How large the page was when the pinch began.
 * @param from - How far apart the fingers were then.
 * @param to - How far apart they are now.
 * @returns How large the page should be.
 */
const scaleFrom = (base: number, from: number, to: number): number => {
  if (from <= 0) {
    return base;
  }

  return Math.min(Math.max((base * to) / from, CLOSEST), FURTHEST);
};

/**
 * Keeps a page that has been zoomed into from being dragged off the screen entirely.
 *
 * How far it may be moved depends on how far in it is: at its own size there is nothing to move, and
 * at three times there is a page and a half of it hidden on either side.
 *
 * @param moved - How far somebody has dragged it.
 * @param across - How wide the screen is.
 * @param scale - How large the page is.
 * @returns How far it may actually move.
 */
const heldWithin = (moved: number, across: number, scale: number): number => {
  const room = (across * (scale - 1)) / 2;

  return Math.min(Math.max(moved, -room), room);
};

export type { Point };

export { CLOSEST, FURTHEST, distanceBetween, heldWithin, scaleFrom };
