const LASTS_FOR_MINUTES = 5;

const A_MINUTE = 60_000;

/**
 * Whether a notice has been on the bell long enough to take down on its own.
 *
 * A notice is worth showing while it is news. After that it is a list somebody has to deal with, and
 * a list nobody deals with is one they stop opening — so these take themselves down rather than
 * accumulating until somebody clears them.
 *
 * Five minutes is deliberately short, and it is the trade being made: somebody who steps away for
 * longer than that will not see what arrived while they were gone. What they will see is a bell that
 * only ever holds things that just happened.
 *
 * @param createdAt - When the notice was written.
 * @param now - The moment being judged against.
 * @returns Whether it has had its time.
 */
const hasExpired = (createdAt: Date | string, now: Date): boolean => {
  const written = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;

  if (Number.isNaN(written.getTime())) {
    return false;
  }

  return now.getTime() - written.getTime() > LASTS_FOR_MINUTES * A_MINUTE;
};

export { A_MINUTE, LASTS_FOR_MINUTES, hasExpired };
