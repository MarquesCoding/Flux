import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { favourite } from '@ValenceServer/db/Schema';
import type { FluxDatabase } from '@ValenceServer/db/Database';
import type { FavouriteService } from './FavouriteService';

const LIMIT = 500;

/**
 * What each profile has kept, held in Postgres — the list a favourites page is built from.
 *
 * @param db - The database to read and write.
 * @returns The favourite service.
 */
const createDatabaseFavouriteService = (db: FluxDatabase): FavouriteService => ({
  list: async (profileId) => {
    const rows = await db
      .select()
      .from(favourite)
      .where(eq(favourite.profileId, profileId))
      .orderBy(desc(favourite.keptAt))
      .limit(LIMIT);

    return rows.map((row) => ({
      mediaId: row.mediaItemId,
      keptAt: row.keptAt.toISOString(),
    }));
  },

  keep: async (profileId, mediaId) => {
    await db
      .insert(favourite)
      .values({
        id: randomUUID(),
        profileId,
        mediaItemId: mediaId,
        keptAt: new Date(),
      })
      .onConflictDoNothing({ target: [favourite.profileId, favourite.mediaItemId] });
  },

  drop: async (profileId, mediaId) => {
    await db
      .delete(favourite)
      .where(and(eq(favourite.profileId, profileId), eq(favourite.mediaItemId, mediaId)));
  },
});

export { createDatabaseFavouriteService, LIMIT };
