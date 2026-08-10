import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import SchemaModule from '@FluxServer/db/Schema'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { WatchProgressService } from './WatchProgressService'

const { watchProgress } = SchemaModule

/**
 * How many resumable items are worth carrying to a browser.
 *
 * A continue watching row is a handful of things, not a viewing history.
 */
const LIMIT = 60

/**
 * Watch progress held in Postgres.
 *
 * One row per viewer per item, replaced in place rather than appended to: this
 * records where someone is, not everywhere they have been.
 */
const createDatabaseWatchProgressService = (db: FluxDatabase): WatchProgressService => ({
  list: async (userId) => {
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, userId))
      .orderBy(desc(watchProgress.updatedAt))
      .limit(LIMIT)

    return rows.map((row) => ({
      mediaId: row.mediaItemId,
      positionSeconds: row.positionSeconds,
      durationSeconds: row.durationSeconds,
      isFinished: row.isFinished,
      updatedAt: row.updatedAt.toISOString(),
    }))
  },

  record: async (userId, report) => {
    await db
      .insert(watchProgress)
      .values({
        id: randomUUID(),
        userId,
        mediaItemId: report.mediaId,
        positionSeconds: report.positionSeconds,
        durationSeconds: report.durationSeconds,
        isFinished: report.isFinished,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [watchProgress.userId, watchProgress.mediaItemId],
        set: {
          positionSeconds: report.positionSeconds,
          durationSeconds: report.durationSeconds,
          isFinished: report.isFinished,
          updatedAt: new Date(),
        },
      })
  },

  forget: async (userId, mediaId) => {
    await db
      .delete(watchProgress)
      .where(and(eq(watchProgress.userId, userId), eq(watchProgress.mediaItemId, mediaId)))
  },
})

export default { createDatabaseWatchProgressService, LIMIT }
