import { z } from 'zod';

const LOWEST_STARS = 1;

const HIGHEST_STARS = 5;

const StarsSchema = z.number().int().min(LOWEST_STARS).max(HIGHEST_STARS);

const RatingSchema = z.object({
  mediaId: z.string().uuid().nullable(),
  seriesId: z.string().uuid().nullable(),
  stars: StarsSchema,
  ratedAt: z.string().datetime(),
});

const RatingListSchema = z.object({ ratings: z.array(RatingSchema) });

const SetRatingSchema = z.object({ stars: StarsSchema });

const HouseholdRatingSchema = z.object({
  average: z.number().nullable(),
  count: z.number().int().nonnegative(),
});

type Rating = z.infer<typeof RatingSchema>;
type HouseholdRating = z.infer<typeof HouseholdRatingSchema>;

/**
 * Averages a set of ratings into the figure shown beside the catalogue's, rounded to one decimal
 * place because a household is a handful of people and further precision claims a consensus that
 * three opinions cannot support. A subject nobody has rated averages to nothing rather than to
 * zero — no opinion and a bad opinion are different answers, and zero would sort as the latter.
 *
 * @param stars - What each person gave it.
 * @returns The average and how many gave it, with a null average where nobody has.
 */
const averageStars = (stars: readonly number[]): HouseholdRating => {
  if (stars.length === 0) {
    return { average: null, count: 0 };
  }

  const total = stars.reduce((sum, one) => sum + one, 0);

  return { average: Math.round((total / stars.length) * 10) / 10, count: stars.length };
};

/**
 * Works out how much of a star row to fill for a given figure, as a fraction between nothing and
 * everything. Anything outside the scale is brought back within it rather than drawing a row longer
 * or shorter than five.
 *
 * @param stars - The figure being drawn.
 * @returns A fraction from zero to one.
 */
const starFraction = (stars: number): number =>
  Math.min(Math.max(stars, 0), HIGHEST_STARS) / HIGHEST_STARS;

export type { Rating, HouseholdRating };

export {
  RatingSchema,
  RatingListSchema,
  SetRatingSchema,
  HouseholdRatingSchema,
  StarsSchema,
  averageStars,
  starFraction,
  LOWEST_STARS,
  HIGHEST_STARS,
};
