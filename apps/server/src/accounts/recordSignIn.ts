/**
 * Where a sign-in is written down.
 *
 * A port rather than the table, so the rule about what a sign-in counts as can
 * be tested without a database — and so the thing doing the counting is not
 * also the thing doing the storing.
 */
type SignInStore = {
  /**
   * Records that an account signed in, and answers with how many times it now
   * has.
   *
   * One row per account, upserted. A log of every sign-in would be a larger
   * feature answering a question nobody asked: what is wanted is when somebody
   * was last here and roughly how often they come, not a forensic trail.
   */
  record: (userId: string, at: Date) => Promise<number>;
};

/**
 * How close together two sign-ins have to be to count as one.
 *
 * A browser signing in is not always a person arriving. A tab refreshing, a
 * token renewing, a second device waking — each can create a session within
 * moments of the last, and counting all of them turns "how often do they come"
 * into "how flaky is their network". Anything inside this window is the same
 * visit.
 *
 * Measured as a distance rather than as a direction, so that a clock a few
 * seconds behind cannot invent a second visit out of one — while an event that
 * genuinely belongs to another day still counts, whichever side of the last
 * one it lands on.
 */
const SAME_VISIT_MILLISECONDS = 5 * 60 * 1000;

type RecordSignInOptions = {
  store: SignInStore;
  userId: string;
  at: Date;
  /**
   * When this account last signed in, if it ever has.
   */
  lastSignInAt: Date | null;
};

/**
 * Notes that somebody signed in.
 *
 * Answers whether it was counted, which is the part worth being able to see: a
 * caller that cannot tell the difference between "recorded" and "folded into
 * the last one" has no way to explain a count that did not move.
 */
const recordSignIn = async ({
  store,
  userId,
  at,
  lastSignInAt,
}: RecordSignInOptions): Promise<{ counted: boolean }> => {
  if (
    lastSignInAt !== null &&
    Math.abs(at.getTime() - lastSignInAt.getTime()) < SAME_VISIT_MILLISECONDS
  ) {
    return { counted: false };
  }

  await store.record(userId, at);

  return { counted: true };
};

export type { SignInStore, RecordSignInOptions };

export { recordSignIn, SAME_VISIT_MILLISECONDS };
