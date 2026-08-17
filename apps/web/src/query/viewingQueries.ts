import { queryOptions } from '@tanstack/react-query';
import { fetchWatchProgress } from '@FluxWeb/playback/watchProgress';
import { fetchFavourites } from '@FluxWeb/library/fetchFavourites';
import { fetchRatings, fetchHouseholdRating } from '@FluxWeb/library/fetchRatings';
import type { RatingSubject } from '@FluxWeb/library/fetchRatings';
import { fetchHistory } from '@FluxWeb/history/fetchHistory';

const VIEWING = ['viewing'] as const;

/**
 * How far through everything this viewer is.
 *
 * Held once rather than fetched by the root and threaded into every card, rail and dialog that shows
 * a progress line. A screen that reports progress invalidates this key and every one of them
 * catches up, which is what it was doing by hand with a callback passed down five levels.
 *
 * @param profileId - Whose viewing, since two people in a household do not share a place in a film.
 * @returns The query.
 */
const progress = (profileId: string | null) =>
  queryOptions({
    queryKey: [...VIEWING, 'progress', profileId],
    queryFn: () => fetchWatchProgress(),
  });

/**
 * What this viewer has kept.
 *
 * @param profileId - Whose list.
 * @returns The query.
 */
const favourites = (profileId: string | null) =>
  queryOptions({
    queryKey: [...VIEWING, 'favourites', profileId],
    queryFn: () => fetchFavourites(),
    enabled: profileId !== null,
  });

/**
 * What this viewer has given stars to.
 *
 * @param profileId - Whose stars.
 * @returns The query.
 */
const ratings = (profileId: string | null) =>
  queryOptions({
    queryKey: [...VIEWING, 'ratings', profileId],
    queryFn: () => fetchRatings(),
    enabled: profileId !== null,
  });

/**
 * What the household thinks of one thing, which is a different question from what you think of it.
 *
 * @param subject - The item or the programme, or null where nothing is open.
 * @returns The query.
 */
const household = (subject: RatingSubject | null) =>
  queryOptions({
    queryKey: [...VIEWING, 'household', subject],
    queryFn: () => fetchHouseholdRating(subject ?? { mediaId: '' }),
    enabled: subject !== null,
  });

/**
 * What has been watched here lately.
 *
 * @param offset - How far back to start.
 * @returns The query.
 */
const history = (offset = 0) =>
  queryOptions({
    queryKey: [...VIEWING, 'history', offset],
    queryFn: () => fetchHistory(offset),
  });

const viewingQueries = { progress, favourites, ratings, household, history, key: VIEWING };

export { viewingQueries };
