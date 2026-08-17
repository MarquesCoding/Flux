const KEPT_READINGS = 9;

type Reading = {
  sentAtMs: number;
  serverAtMs: number;
  backAtMs: number;
};

/**
 * How far this machine's clock is from the server's, from one exchange.
 *
 * The same arithmetic NTP uses: the round trip is halved and taken as the time the answer spent
 * coming back, so the server's stamp plus that half is where the server was when this machine
 * received it. Comparing positions across machines is meaningless without it — wall clocks drift,
 * and they are user-settable.
 *
 * @param reading - When it was sent, what the server said, and when the answer arrived.
 * @returns How far ahead of this machine the server is, in milliseconds.
 */
const offsetOf = (reading: Reading): number =>
  reading.serverAtMs + (reading.backAtMs - reading.sentAtMs) / 2 - reading.backAtMs;

/**
 * How long an exchange took, which is what says whether it is worth believing.
 *
 * @param reading - The exchange.
 * @returns The round trip in milliseconds.
 */
const roundTripOf = (reading: Reading): number => reading.backAtMs - reading.sentAtMs;

/**
 * The clock offset to work from, taken as the median of recent exchanges.
 *
 * A single measurement is not usable over the internet: round trips are long and jitter is real, so
 * one delayed packet would read as a clock jump. The median ignores it, where a mean would not.
 *
 * @param readings - Recent exchanges, oldest first.
 * @returns The offset to use, or zero where nothing has been measured.
 */
const estimateClockOffset = (readings: readonly Reading[]): number => {
  const recent = readings.slice(-KEPT_READINGS);

  if (recent.length === 0) {
    return 0;
  }

  const offsets = recent.map(offsetOf).sort((one, other) => one - other);
  const middle = Math.floor(offsets.length / 2);

  if (offsets.length % 2 === 1) {
    return offsets[middle] ?? 0;
  }

  return ((offsets[middle - 1] ?? 0) + (offsets[middle] ?? 0)) / 2;
};

/**
 * How unsteady the measurements are, used to widen the band inside which drift is ignored.
 *
 * Somebody on mobile data measures far less steadily than somebody on fibre, and correcting for
 * measurement error rather than real drift is how a picture ends up visibly hunting.
 *
 * @param readings - Recent exchanges.
 * @returns The spread of round trips in milliseconds.
 */
const measurementJitter = (readings: readonly Reading[]): number => {
  const recent = readings.slice(-KEPT_READINGS);

  if (recent.length < 2) {
    return 0;
  }

  const trips = recent.map(roundTripOf);

  return Math.max(...trips) - Math.min(...trips);
};

export type { Reading };

export { estimateClockOffset, measurementJitter, offsetOf, roundTripOf, KEPT_READINGS };
