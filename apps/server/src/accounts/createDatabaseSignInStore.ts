import { eq, sql } from 'drizzle-orm';
import { accountActivity } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { SignInStore } from './recordSignIn';

/**
 * Records when each account signs in, which is what the admin pages read to show who has been
 * active and what an operator checks before removing an account nobody uses.
 *
 * @param db - The database to read and write.
 * @returns The sign-in store.
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
