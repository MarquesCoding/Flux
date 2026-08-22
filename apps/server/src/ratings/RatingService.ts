import type { HouseholdRating, Rating } from '@ValenceContracts/schemas/Rating';

type RatingSubject = { mediaId: string } | { seriesId: string };

type RatingService = {
  list: (profileId: string) => Promise<Rating[]>;
  set: (profileId: string, subject: RatingSubject, stars: number) => Promise<void>;
  clear: (profileId: string, subject: RatingSubject) => Promise<void>;
  household: (subject: RatingSubject) => Promise<HouseholdRating>;
  householdForItems: (mediaIds: readonly string[]) => Promise<Map<string, HouseholdRating>>;
};

export type { RatingService, RatingSubject };
