import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { favourite } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { FavouriteService } from './FavouriteService';

/**
 * How many kept items are worth carrying to a browser.
 *
 * A list somebody curates by hand rather than a history that accumulates on
 * its own, so this is a ceiling nobody should meet.
 */
const LIMIT = 500;

/**
 * Favourites held in Postgres.
 *
 * Keeping something twice is keeping it once: the insert defers to whatever is
 * already there rather than failing, because a viewer pressing a heart twice
 * has said the same thing twice and deserves the same answer.
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
