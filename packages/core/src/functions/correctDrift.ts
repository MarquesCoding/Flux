const DEAD_BAND_MS = 150;

const SNAP_BEYOND_MS = 1000;

const MOST_RATE_CHANGE = 0.03;

type Drift = {
  behindByMs: number;
  jitterMs: number;
  isSeeking: boolean;
  isStalled: boolean;
};

type Correction = { kind: 'leave alone' } | { kind: 'rate'; rate: number } | { kind: 'snap' };

/**
 * How far out a picture has to be before it is worth touching, widened by how unsteady the
 * measurements are.
 *
 * A dead band is essential rather than a nicety: correcting constantly is more noticeable than the
 * error it corrects, and without one the rate hunts audibly. Widening it by measured jitter stops a
 * viewer on mobile data being corrected for noise in the measurement rather than real drift.
 *
 * @param jitterMs - How unsteady the clock exchanges have been.
 * @returns The band inside which drift is ignored.
 */
const deadBandFor = (jitterMs: number): number => DEAD_BAND_MS + Math.max(0, jitterMs) / 2;

/**
 * What to do about a picture that has drifted from the party's reference.
 *
 * Three bands, and the middle one is the point of the whole thing: rather than jumping, the rate is
 * nudged a few percent so the picture quietly catches up or falls behind. A viewer notices a jump;
 * they do not notice three percent. Only when it is hopeless does it snap, because a second out is
 * worse than a visible correction.
 *
 * Nothing is done while seeking or stalled — correcting then means fighting the buffer, and the
 * measurement is meaningless anyway.
 *
 * @param behindByMs - How far behind the reference this picture is; negative means ahead.
 * @param jitterMs - How unsteady the clock measurements are.
 * @param isSeeking - Whether the picture is already moving somewhere.
 * @param isStalled - Whether it has run out of buffer.
 * @returns What to do.
 */
const correctDrift = ({ behindByMs, jitterMs, isSeeking, isStalled }: Drift): Correction => {
  if (isSeeking || isStalled) {
    return { kind: 'leave alone' };
  }

  const off = Math.abs(behindByMs);

  if (off > SNAP_BEYOND_MS) {
    return { kind: 'snap' };
  }

  if (off <= deadBandFor(jitterMs)) {
    return { kind: 'leave alone' };
  }

  const share = Math.min(1, off / SNAP_BEYOND_MS);
  const change = MOST_RATE_CHANGE * share;

  return { kind: 'rate', rate: behindByMs > 0 ? 1 + change : 1 - change };
};

export type { Drift, Correction };

export { correctDrift, deadBandFor, DEAD_BAND_MS, SNAP_BEYOND_MS, MOST_RATE_CHANGE };
