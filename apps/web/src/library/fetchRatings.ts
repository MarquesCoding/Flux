import { HouseholdRatingSchema, RatingListSchema } from '@FluxContracts/schemas/Rating';
import type { HouseholdRating, Rating } from '@FluxContracts/schemas/Rating';

type RatingSubject = { mediaId: string } | { seriesId: string };

const NOTHING: HouseholdRating = { average: null, count: 0 };

/**
 * Builds the address a subject's rating is reached at, so an item and a programme are asked about in
 * the same way at two different paths rather than through two near-identical functions.
 *
 * @param subject - The item or programme.
 * @returns Where its rating lives.
 */
const addressOf = (subject: RatingSubject): string =>
  'mediaId' in subject ? `/api/media/${subject.mediaId}` : `/api/series/${subject.seriesId}`;

/**
 * Everything this viewer has rated, items and programmes alike. Per profile rather than per account,
 * since two people in a household disagreeing about a film is the point of recording it at all.
 *
 * @returns What they have rated, or none where the request failed.
 */
const fetchRatings = async (): Promise<Rating[]> => {
  try {
    const response = await fetch('/api/ratings', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return RatingListSchema.parse(await response.json()).ratings;
  } catch {
    return [];
  }
};

/**
 * Records what this viewer thinks of something, or takes it back where no rating is given. One call
 * for both, since the row of stars in the interface already knows which of the two it means.
 *
 * @param subject - The item or programme being rated.
 * @param stars - What they gave it, or null to take the rating back.
 * @returns Whether the server accepted it.
 */
const setRating = async (subject: RatingSubject, stars: number | null): Promise<boolean> => {
  const response = await fetch(`${addressOf(subject)}/rating`, {
    method: stars === null ? 'DELETE' : 'PUT',
    credentials: 'same-origin',
    ...(stars === null
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stars }) }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Reads what the whole household gave something, which is the figure shown beside the catalogue's.
 * Answers with nothing rather than zero where nobody has rated it or the request failed — no opinion
 * and a bad opinion are different answers.
 *
 * @param subject - The item or programme being asked about.
 * @returns The average and how many gave it.
 */
const fetchHouseholdRating = async (subject: RatingSubject): Promise<HouseholdRating> => {
  try {
    const response = await fetch(`${addressOf(subject)}/rating/household`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return NOTHING;
    }

    return HouseholdRatingSchema.parse(await response.json());
  } catch {
    return NOTHING;
  }
};

export type { RatingSubject };

export { fetchRatings, setRating, fetchHouseholdRating };
