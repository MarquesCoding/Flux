const FIRST_MS = 500;

const CEILING_MS = 30000;

/**
 * How long to wait before trying a dropped connection again. Grows with each failed attempt so a
 * server that is down is not hammered, and stops growing so a tab left open overnight still comes
 * back promptly once the server returns rather than waiting hours.
 *
 * @param attempt - How many attempts have already failed, counting from zero.
 * @returns The wait in milliseconds.
 */
const realtimeBackoffMs = (attempt: number): number =>
  Math.min(CEILING_MS, FIRST_MS * 2 ** Math.max(0, attempt));

export { realtimeBackoffMs };
