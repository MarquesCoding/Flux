const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Says a size the way a person would.
 *
 * One decimal at most: an operator glancing at memory use wants to know
 * whether it is three gigabytes or thirty, and "3.4 GB" answers that where
 * "3,623,878,656 bytes" makes them count digits.
 */
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const step = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** step;

  return `${value < 10 && step > 0 ? value.toFixed(1) : Math.round(value).toString()} ${UNITS[step] ?? 'B'}`;
};

export { formatBytes };
