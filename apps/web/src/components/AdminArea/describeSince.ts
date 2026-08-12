const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened, in words.
 *
 * Coarse on purpose. An operator reading when a library was last scanned wants
 * "2 hours ago", not a timestamp they have to subtract from the clock — and
 * the difference between 2 hours and 2 hours 14 minutes has never mattered to
 * that question.
 *
 * @param at When it happened, or null if it never has.
 * @param now What to measure against.
 */
const describeSince = (at: string | null, now: number): string => {
  if (at === null) {
    return 'never';
  }

  const then = Date.parse(at);

  if (Number.isNaN(then)) {
    return 'never';
  }

  const elapsed = now - then;

  if (elapsed < MINUTE) {
    return 'just now';
  }

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);

    return minutes === 1 ? '1 minute ago' : `${minutes.toString()} minutes ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);

    return hours === 1 ? '1 hour ago' : `${hours.toString()} hours ago`;
  }

  const days = Math.floor(elapsed / DAY);

  return days === 1 ? '1 day ago' : `${days.toString()} days ago`;
};

export { describeSince };
