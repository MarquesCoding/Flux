import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { MediaSegmentSchema } from '@ValenceContracts/schemas/MediaSegment';
import { mediaSegment } from '@ValenceServer/db/Schema';
import type { FluxDatabase } from '@ValenceServer/db/Database';
import type { SegmentService } from './SegmentService';
import type { MediaSegment } from '@ValenceContracts/schemas/MediaSegment';

/**
 * The marked stretches of each item — intros, outros, recaps — held in Postgres, so detection runs
 * once and every playback afterwards simply reads them.
 *
 * @param db - The database to read and write.
 * @returns The segment service.
 */
const createDatabaseSegmentService = (db: FluxDatabase): SegmentService => ({
  list: async (mediaId) => {
    const rows = await db.select().from(mediaSegment).where(eq(mediaSegment.mediaItemId, mediaId));

    return rows
      .map((row) =>
        MediaSegmentSchema.safeParse({
          kind: row.kind,
          startSeconds: row.startSeconds,
          endSeconds: row.endSeconds,
          source: row.source,
        }),
      )
      .filter((parsed) => parsed.success)
      .map((parsed) => parsed.data);
  },

  replace: async (mediaId, segments) => {
    await db.transaction(async (transaction) => {
      await transaction.delete(mediaSegment).where(eq(mediaSegment.mediaItemId, mediaId));

      if (segments.length === 0) {
        return;
      }

      await transaction.insert(mediaSegment).values(
        segments.map((segment) => ({
          id: randomUUID(),
          mediaItemId: mediaId,
          kind: segment.kind,
          startSeconds: segment.startSeconds,
          endSeconds: segment.endSeconds,
          source: segment.source,
        })),
      );
    });
  },
});

export type { MediaSegment };

export { createDatabaseSegmentService };
