const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const pad = (value: number): string => value.toString().padStart(2, '0');

/**
 * Formats a length of time as a clock reads it — `h:mm:ss`, dropping the hours entirely when there
 * are none, so a forty minute episode is `40:12` rather than `0:40:12`. A duration that is negative
 * or not a number is treated as nothing having elapsed.
 *
 * @param totalSeconds - The length of time, in seconds, and not necessarily whole.
 * @returns The duration written as a clock, such as `1:04:09` or `40:12`.
 */
const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;

  const hours = Math.floor(safeSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((safeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = safeSeconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours.toString()}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${minutes.toString()}:${pad(seconds)}`;
};

export { formatDuration };
