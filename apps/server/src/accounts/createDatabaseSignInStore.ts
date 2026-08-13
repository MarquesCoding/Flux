import { eq, sql } from 'drizzle-orm';
import { accountActivity } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { SignInStore } from './recordSignIn';

/**
 * Where an account's sign-ins are written down.
 *
 * One row per account, upserted. The count is incremented in the database
 * rather than read and written back, so two devices signing in at the same
 * moment cannot each read the same number and store it twice.
 */
const createDatabaseSignInStore = (
  db: FluxDatabase,
): SignInStore & { lastSignInAt: (userId: string) => Promise<Date | null> } => ({
  lastSignInAt: async (userId) => {
    const [found] = await db
      .select({ at: accountActivity.lastSignInAt })
      .from(accountActivity)
      .where(eq(accountActivity.userId, userId))
      .limit(1);

    return found?.at ?? null;
  },

  record: async (userId, at) => {
    const [saved] = await db
      .insert(accountActivity)
      .values({ userId, lastSignInAt: at, signInCount: 1 })
      .onConflictDoUpdate({
        target: accountActivity.userId,
        set: {
          lastSignInAt: at,
          signInCount: sql`${accountActivity.signInCount} + 1`,
        },
      })
      .returning({ count: accountActivity.signInCount });

    return saved?.count ?? 1;
  },
});

export { createDatabaseSignInStore };
