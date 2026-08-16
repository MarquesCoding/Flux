import { randomUUID } from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { watchHistory, mediaItem } from '@FluxServer/db/Schema';
import { decideViewing } from './decideViewing';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { HistoryService, Viewing } from './HistoryService';

type Row = {
  id: string;
  mediaItemId: string;
  title: string | null;
  seriesTitle: string | null;
  startedAt: Date;
  lastWatchedAt: Date;
  secondsWatched: number;
  isFinished: boolean;
};

const shown = (row: Row): Viewing => ({
  id: row.id,
  mediaItemId: row.mediaItemId,
  title: row.title,
  seriesTitle: row.seriesTitle,
  startedAt: row.startedAt.toISOString(),
  lastWatchedAt: row.lastWatchedAt.toISOString(),
  secondsWatched: row.secondsWatched,
  isFinished: row.isFinished,
});

/**
 * What each profile has actually watched and when, held in Postgres — one entry per viewing rather
 * than per report, so an evening's watching reads as an evening rather than as hundreds of ticks.
 *
 * @param db - The database to read and write.
 * @returns The history service.
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

      return changed === undefined ? null : shown({ ...changed, title: null, seriesTitle: null });
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

    return made === undefined ? null : shown({ ...made, title: null, seriesTitle: null });
  },

  list: async (profileId, options = {}) => {
    const rows = await db
      .select({
        id: watchHistory.id,
        mediaItemId: watchHistory.mediaItemId,
        title: mediaItem.title,
        seriesTitle: mediaItem.seriesTitle,
        startedAt: watchHistory.startedAt,
        lastWatchedAt: watchHistory.lastWatchedAt,
        secondsWatched: watchHistory.secondsWatched,
        isFinished: watchHistory.isFinished,
      })
      .from(watchHistory)
      .leftJoin(mediaItem, eq(mediaItem.id, watchHistory.mediaItemId))
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
