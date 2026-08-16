import { randomUUID } from 'node:crypto';
import { and, avg, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { rating } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { HouseholdRating } from '@FluxContracts/schemas/Rating';
import type { RatingService, RatingSubject } from './RatingService';

const LIMIT = 1000;

const ROUNDING = 10;

/**
 * Narrows a subject to the one column it is stored against, so that every query about a rating asks
 * about an item or a series and never about both.
 *
 * @param subject - The item or the series being rated.
 * @returns The condition matching only that subject's rows.
 */
const matching = (subject: RatingSubject) =>
  'mediaId' in subject
    ? and(eq(rating.mediaItemId, subject.mediaId), isNull(rating.seriesId))
    : and(eq(rating.seriesId, subject.seriesId), isNull(rating.mediaItemId));

/**
 * Reads an average back out of the database, which returns it as a string because the exact value of
 * a numeric is not something a float can promise to carry. Rounded to one decimal place, matching
 * what `averageStars` does for a set held in memory.
 *
 * @param reported - The average as the database wrote it, or null where there were no rows.
 * @param howMany - How many ratings it was taken over.
 * @returns The household figure.
 */
const readAverage = (reported: string | null, howMany: number): HouseholdRating => {
  if (reported === null || howMany === 0) {
    return { average: null, count: 0 };
  }

  return { average: Math.round(Number(reported) * ROUNDING) / ROUNDING, count: howMany };
};

/**
 * What each profile thinks of what it has watched, held in Postgres. Ratings are visible to the
 * whole household, so this answers two different questions: what one profile gave something, and
 * what everyone gave it between them.
 *
 * @param db - The database to read and write.
 * @returns The rating service.
 */
const createDatabaseRatingService = (db: FluxDatabase): RatingService => ({
  list: async (profileId) => {
    const rows = await db
      .select()
      .from(rating)
      .where(eq(rating.profileId, profileId))
      .orderBy(desc(rating.updatedAt))
      .limit(LIMIT);

    return rows.map((row) => ({
      mediaId: row.mediaItemId,
      seriesId: row.seriesId,
      stars: row.stars,
      ratedAt: row.ratedAt.toISOString(),
    }));
  },

  set: async (profileId, subject, stars) => {
    const changed = await db
      .update(rating)
      .set({ stars, updatedAt: new Date() })
      .where(and(eq(rating.profileId, profileId), matching(subject)))
      .returning({ id: rating.id });

    if (changed.length > 0) {
      return;
    }

    await db.insert(rating).values({
      id: randomUUID(),
      profileId,
      mediaItemId: 'mediaId' in subject ? subject.mediaId : null,
      seriesId: 'seriesId' in subject ? subject.seriesId : null,
      stars,
      ratedAt: new Date(),
      updatedAt: new Date(),
    });
  },

  clear: async (profileId, subject) => {
    await db.delete(rating).where(and(eq(rating.profileId, profileId), matching(subject)));
  },

  household: async (subject) => {
    const [found] = await db
      .select({ average: avg(rating.stars), howMany: count() })
      .from(rating)
      .where(matching(subject));

    return readAverage(found?.average ?? null, found?.howMany ?? 0);
  },

  householdForItems: async (mediaIds) => {
    if (mediaIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({ mediaItemId: rating.mediaItemId, average: avg(rating.stars), howMany: count() })
      .from(rating)
      .where(inArray(rating.mediaItemId, [...mediaIds]))
      .groupBy(rating.mediaItemId);

    return new Map(
      rows.flatMap((row) =>
        row.mediaItemId === null
          ? []
          : [[row.mediaItemId, readAverage(row.average, row.howMany)] as const],
      ),
    );
  },
});

export { createDatabaseRatingService, LIMIT };
