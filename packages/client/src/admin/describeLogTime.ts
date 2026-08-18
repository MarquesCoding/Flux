/**
 * When a record was written, in the reader's own time zone.
 *
 * Local rather than UTC because an operator comparing a line to a schedule they set in local time
 * needs the two to agree — otherwise they conclude the job ran at the wrong hour when it did not.
 *
 * @param atMs - When it happened.
 * @returns The time, to the second.
 */
const describeLogTime = (atMs: number): string =>
  new Date(atMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

/**
 * The day a record was written, for separating one day from the next.
 *
 * @param atMs - When it happened.
 * @returns The date, in the reader's own time zone.
 */
const describeLogDay = (atMs: number): string =>
  new Date(atMs).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export { describeLogTime, describeLogDay };
