import { randomUUID } from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { watchHistory } from '@FluxServer/db/Schema';
import { decideViewing } from './decideViewing';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { HistoryService, Viewing } from './HistoryService';

type Row = {
  id: string;
  mediaItemId: string;
  startedAt: Date;
  lastWatchedAt: Date;
  secondsWatched: number;
  isFinished: boolean;
};

const shown = (row: Row): Viewing => ({
  id: row.id,
  mediaItemId: row.mediaItemId,
  startedAt: row.startedAt.toISOString(),
  lastWatchedAt: row.lastWatchedAt.toISOString(),
  secondsWatched: row.secondsWatched,
  isFinished: row.isFinished,
});

/**
 * A profile's viewing history, in the database.
 *
 * The rules about what counts as a viewing live in `decideViewing` rather than
 * here, so this and the in-memory one cannot drift apart — and so the
 * judgements can be read without a query in the way.
 */
const createDatabaseHistoryService = (db: FluxDatabase): HistoryService => ({
  record: async (profileId, mediaItemId, seen) => {
    const [open] = await db
      .select({
        id: watchHistory.id,
        mediaItemId: watchHistory.mediaItemId,
        startedAt: watchHistory.startedAt,
        lastWatchedAt: watchHistory.lastWatchedAt,
        secondsWatched: watchHistory.secondsWatched,
        isFinished: watchHistory.isFinished,
      })
      .from(watchHistory)
      .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.mediaItemId, mediaItemId)))
      .orderBy(desc(watchHistory.lastWatchedAt))
      .limit(1);

    const decided = decideViewing(
      open === undefined
        ? null
        : {
            id: open.id,
            lastWatchedAt: open.lastWatchedAt,
            secondsWatched: open.secondsWatched,
            isFinished: open.isFinished,
          },
      seen,
    );

    if (decided.kind === 'ignore') {
      return null;
    }

    if (decided.kind === 'extend') {
      const [changed] = await db
        .update(watchHistory)
        .set({
          secondsWatched: decided.secondsWatched,
          isFinished: decided.isFinished,
          lastWatchedAt: seen.at,
        })
        .where(eq(watchHistory.id, decided.id))
        .returning();

      return changed === undefined ? null : shown(changed);
    }

    const [made] = await db
      .insert(watchHistory)
      .values({
        id: randomUUID(),
        profileId,
        mediaItemId,
        startedAt: seen.at,
        lastWatchedAt: seen.at,
        secondsWatched: decided.secondsWatched,
        isFinished: decided.isFinished,
      })
      .returning();

    return made === undefined ? null : shown(made);
  },

  list: async (profileId, options = {}) => {
    const rows = await db
      .select({
        id: watchHistory.id,
        mediaItemId: watchHistory.mediaItemId,
        startedAt: watchHistory.startedAt,
        lastWatchedAt: watchHistory.lastWatchedAt,
        secondsWatched: watchHistory.secondsWatched,
        isFinished: watchHistory.isFinished,
      })
      .from(watchHistory)
      .where(eq(watchHistory.profileId, profileId))
      .orderBy(desc(watchHistory.lastWatchedAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    return rows.map(shown);
  },

  forget: async (profileId, viewingId) => {
    const gone = await db
      .delete(watchHistory)
      .where(and(eq(watchHistory.id, viewingId), eq(watchHistory.profileId, profileId)))
      .returning({ id: watchHistory.id });

    return gone.length > 0;
  },

  prune: async (before) => {
    const gone = await db
      .delete(watchHistory)
      .where(lt(watchHistory.lastWatchedAt, before))
      .returning({ id: watchHistory.id });

    return gone.length;
  },

  forgetAll: async (profileId) => {
    const gone = await db
      .delete(watchHistory)
      .where(eq(watchHistory.profileId, profileId))
      .returning({ id: watchHistory.id });

    return gone.length;
  },
});

export { createDatabaseHistoryService };
