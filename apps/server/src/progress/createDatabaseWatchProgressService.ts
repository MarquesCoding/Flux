import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { watchProgress } from '@ValenceServer/db/Schema';
import type { FluxDatabase } from '@ValenceServer/db/Database';
import type { WatchProgressService } from './WatchProgressService';

const LIMIT = 60;

/**
 * Where each profile has got to in each item, held in Postgres. This is the record a resume reads
 * and a reload depends on, so it is written on a timer while watching and once more on the way out.
 *
 * @param db - The database to read and write.
 * @returns The watch progress service.
 */
const createDatabaseWatchProgressService = (db: FluxDatabase): WatchProgressService => ({
  read: async (profileId, mediaId) => {
    const [row] = await db
      .select()
      .from(watchProgress)
      .where(and(eq(watchProgress.profileId, profileId), eq(watchProgress.mediaItemId, mediaId)))
      .limit(1);

    return row === undefined
      ? null
      : {
          mediaId: row.mediaItemId,
          positionSeconds: row.positionSeconds,
          durationSeconds: row.durationSeconds,
          isFinished: row.isFinished,
          updatedAt: row.updatedAt.toISOString(),
        };
  },

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
