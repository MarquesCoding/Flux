const A_MINUTE = 60_000;
const AN_HOUR = 60 * A_MINUTE;
const A_DAY = 24 * AN_HOUR;
const A_WEEK = 7 * A_DAY;

const dayAndMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * When something was watched, said the way somebody would say it.
 */
const describeWhen = (at: Date, now: Date): string => {
  const since = now.getTime() - at.getTime();

  if (since < A_MINUTE) {
    return 'Just now';
  }

  if (since < AN_HOUR) {
    const minutes = Math.floor(since / A_MINUTE);

    return `${minutes.toString()} min ago`;
  }

  if (since < A_DAY) {
    const hours = Math.floor(since / AN_HOUR);

    return hours === 1 ? 'An hour ago' : `${hours.toString()} hours ago`;
  }

  if (since < 2 * A_DAY) {
    return 'Yesterday';
  }

  if (since < A_WEEK) {
    const days = Math.floor(since / A_DAY);

    return `${days.toString()} days ago`;
  }

  return at.getFullYear() === now.getFullYear() ? dayAndMonth.format(at) : withYear.format(at);
};

export { describeWhen };
