type SignInStore = {
  record: (userId: string, at: Date) => Promise<number>;
};

const SAME_VISIT_MILLISECONDS = 5 * 60 * 1000;

type RecordSignInOptions = {
  store: SignInStore;
  userId: string;
  at: Date;
  lastSignInAt: Date | null;
};

/**
 * Records that somebody signed in, ignoring a repeat within the same short window so that a browser
 * refreshing its session does not fill the history with one entry per request.
 *
 * @param options - The store to write to, whose account it is, when it happened, and when they last
 * signed in.
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

export type { SignInStore };

export { recordSignIn, SAME_VISIT_MILLISECONDS };
