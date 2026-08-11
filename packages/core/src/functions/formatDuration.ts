const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

const pad = (value: number): string => value.toString().padStart(2, '0')

/**
 * Formats a duration in seconds as `h:mm:ss`, or `m:ss` when under an hour.
 *
 * Fractional seconds are truncated. Negative input is treated as zero, because
 * a negative duration is never meaningful to display.
 */
const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0

  const hours = Math.floor(safeSeconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((safeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = safeSeconds % SECONDS_PER_MINUTE

  if (hours > 0) {
    return `${hours.toString()}:${pad(minutes)}:${pad(seconds)}`
  }

  return `${minutes.toString()}:${pad(seconds)}`
}

export { formatDuration }
