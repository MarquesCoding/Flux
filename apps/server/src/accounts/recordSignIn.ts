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
 * Notes that somebody signed in.
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
