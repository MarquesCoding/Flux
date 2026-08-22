import { averageStars } from '@ValenceContracts/schemas/Rating';
import type { Rating } from '@ValenceContracts/schemas/Rating';
import type { RatingService, RatingSubject } from './RatingService';

type MemoryState = Record<string, Rating[]>;

/**
 * Whether a stored rating is about the subject being asked about, matching on the one identifier
 * that subject is keyed by so an item and a series of the same id never answer for each other.
 *
 * @param entry - The rating as stored.
 * @param subject - The item or series being asked about.
 * @returns Whether the rating is about it.
 */
const isAbout = (entry: Rating, subject: RatingSubject): boolean =>
  'mediaId' in subject ? entry.mediaId === subject.mediaId : entry.seriesId === subject.seriesId;

/**
 * Ratings held in memory, so the routes can be exercised without Postgres. Answers the household
 * questions by reading across every profile in the state, which is what the database does with a
 * group-by.
 *
 * @param state - Anything already rated, by profile.
 * @returns The rating service.
 */
const createMemoryRatingService = (
  state: MemoryState = {},
): RatingService & { state: MemoryState } => {
  const everyRating = (): Rating[] => Object.values(state).flat();

  return {
    state,

    list: (profileId) => Promise.resolve(state[profileId] ?? []),

    set: (profileId, subject, stars) => {
      const held = state[profileId] ?? [];
      const existing = held.find((entry) => isAbout(entry, subject));

      state[profileId] = existing
        ? held.map((entry) => (isAbout(entry, subject) ? { ...entry, stars } : entry))
        : [
            {
              mediaId: 'mediaId' in subject ? subject.mediaId : null,
              seriesId: 'seriesId' in subject ? subject.seriesId : null,
              stars,
              ratedAt: new Date(0).toISOString(),
            },
            ...held,
          ];

      return Promise.resolve();
    },

    clear: (profileId, subject) => {
      state[profileId] = (state[profileId] ?? []).filter((entry) => !isAbout(entry, subject));

      return Promise.resolve();
    },

    household: (subject) =>
      Promise.resolve(
        averageStars(
          everyRating()
            .filter((entry) => isAbout(entry, subject))
            .map((entry) => entry.stars),
        ),
      ),

    householdForItems: (mediaIds) => {
      const wanted = new Set(mediaIds);
      const found = new Map<string, number[]>();

      for (const entry of everyRating()) {
        if (entry.mediaId === null || !wanted.has(entry.mediaId)) {
          continue;
        }

        found.set(entry.mediaId, [...(found.get(entry.mediaId) ?? []), entry.stars]);
      }

      return Promise.resolve(
        new Map([...found].map(([mediaId, stars]) => [mediaId, averageStars(stars)])),
      );
    },
  };
};

export type { MemoryState };

export { createMemoryRatingService };
