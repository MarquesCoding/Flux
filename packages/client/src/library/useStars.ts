import { useQuery } from '@tanstack/react-query';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { keyFor, keyOf } from '@ValenceClient/library/ratingKeys';
import type { RatingSubject } from '@ValenceClient/library/fetchRatings';

/**
 * What this viewer gave one thing, read by whoever is drawing that thing's stars.
 *
 * Narrowed to the one subject rather than handing back the map of every rating, which is the whole
 * point of it. A component subscribed to the list is told when any rating anywhere changes; one
 * subscribed through `select` is told only when its own star moves, because what `select` returns is
 * compared with what it returned before and an unchanged answer is not an event.
 *
 * @param watcherId - Whose stars.
 * @param subject - The item or programme being shown.
 * @returns What they gave it, or null where they have not.
 */
const useStars = (watcherId: string | null, subject: RatingSubject): number | null => {
  const key = keyFor(subject);

  const asked = useQuery({
    ...viewingQueries.ratings(watcherId),
    select: (given) => given.find((rating) => keyOf(rating) === key)?.stars ?? null,
  });

  return asked.data ?? null;
};

export { useStars };
