import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { watchProgress } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { WatchProgressService } from './WatchProgressService';

/**
 * How many resumable items are worth carrying to a browser.
 *
 * A continue watching row is a handful of things, not a viewing history.
 */
const LIMIT = 60;

/**
 * Watch progress held in Postgres.
 *
 * One row per person per item, replaced in place rather than appended to: this
 * records where someone is, not everywhere they have been.
 */
const createDatabaseWatchProgressService = (db: FluxDatabase): WatchProgressService => ({
  list: async (profileId) => {
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.profileId, profileId))
      .orderBy(desc(watchProgress.updatedAt))
      .limit(LIMIT);

    return rows.map((row) => ({
      mediaId: row.mediaItemId,
      positionSeconds: row.positionSeconds,
      durationSeconds: row.durationSeconds,
      isFinished: row.isFinished,
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  record: async (profileId, report) => {
    await db
      .insert(watchProgress)
      .values({
        id: randomUUID(),
        profileId,
        mediaItemId: report.mediaId,
        positionSeconds: report.positionSeconds,
        durationSeconds: report.durationSeconds,
        isFinished: report.isFinished,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [watchProgress.profileId, watchProgress.mediaItemId],
        set: {
          positionSeconds: report.positionSeconds,
          durationSeconds: report.durationSeconds,
          isFinished: report.isFinished,
          updatedAt: new Date(),
        },
      });
  },

  forget: async (profileId, mediaId) => {
    await db
      .delete(watchProgress)
      .where(and(eq(watchProgress.profileId, profileId), eq(watchProgress.mediaItemId, mediaId)));
  },
});

export { createDatabaseWatchProgressService, LIMIT };
