const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a number of bytes as a size somebody would say out loud, stepping up through B, KB, MB,
 * GB and TB and keeping one decimal place below ten so that 1.4 GB does not read as 1 GB. Anything
 * negative, infinite or not a number is reported as no size at all rather than as nonsense.
 *
 * @param bytes - The size to describe.
 * @returns The size and its unit, such as `1.4 GB`.
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
