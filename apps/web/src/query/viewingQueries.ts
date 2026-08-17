import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchWatchProgress } from '@FluxWeb/playback/watchProgress';
import { fetchFavourites } from '@FluxWeb/library/fetchFavourites';
import { fetchRatings, fetchHouseholdRating } from '@FluxWeb/library/fetchRatings';
import type { RatingSubject } from '@FluxWeb/library/fetchRatings';
import { fetchHistory, A_PAGE } from '@FluxWeb/history/fetchHistory';
import type { Viewing } from '@FluxContracts/schemas/Viewing';

const VIEWING = ['viewing'] as const;

/**
 * How far through everything this viewer is.
 *
 * Held once rather than fetched by the root and threaded into every card, rail and dialog that shows
 * a progress line. A screen that reports progress invalidates this key and every one of them
 * catches up, which is what it was doing by hand with a callback passed down five levels.
 *
 * Not keyed by who is watching, because the server answers for whoever the session belongs to and a
 * rail drawing a progress line has no business knowing whose it is. Signing in as somebody else
 * throws the whole of this away rather than holding two answers at once.
 *
 * @returns The query.
 */
const progress = () =>
  queryOptions({
    queryKey: [...VIEWING, 'progress'],
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
 * What has been watched here lately, a page at a time.
 *
 * The pages already read are kept, so somebody who asked for more, opened something and came back
 * does not have to ask for more again — which is the whole point of the list living in the cache
 * rather than in the panel drawing it.
 *
 * @returns The query.
 */
const history = () =>
  infiniteQueryOptions({
    queryKey: [...VIEWING, 'history'],
    queryFn: ({ pageParam }) => fetchHistory(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: Viewing[], all: Viewing[][]) =>
      last.length < A_PAGE ? undefined : all.reduce((count, page) => count + page.length, 0),
  });

const viewingQueries = { progress, favourites, ratings, household, history, key: VIEWING };

export { viewingQueries };
