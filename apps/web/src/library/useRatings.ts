import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setRating } from '@FluxWeb/library/fetchRatings';
import { viewingQueries } from '@FluxWeb/query/viewingQueries';
import type { RatingSubject } from '@FluxWeb/library/fetchRatings';

type Ratings = {
  ratingFor: (subject: RatingSubject) => number | null;
  rate: (subject: RatingSubject, stars: number | null) => void;
};

/**
 * Builds the key a rating is held under, keeping items and programmes apart so that an item and a
 * programme sharing an identifier never answer for each other.
 *
 * @param subject - The item or programme.
 * @returns The key it is held under.
 */
const keyFor = (subject: RatingSubject): string =>
  'mediaId' in subject ? `media:${subject.mediaId}` : `series:${subject.seriesId}`;

/**
 * Says which subject a rating the server sent back is about, which is the same key read the other
 * way round.
 *
 * @param rating - What the server sent.
 * @returns The key it is held under.
 */
const keyOf = (rating: { mediaId: string | null; seriesId: string | null }): string =>
  rating.mediaId === null ? `series:${rating.seriesId ?? ''}` : `media:${rating.mediaId}`;

/**
 * What this viewer has rated, and the one gesture that changes it. The stars live in the shared
 * cache rather than in this hook — the same bargain `useFavourites` makes, for the same reason: a
 * star given in a dialog is given everywhere else it is shown.
 *
 * The change is written to the cache before the server is asked so a star fills on the press, and
 * only that one subject is put back if the server refuses. Any read still in flight is called off
 * first, so a list that arrives a moment later does not empty the star again.
 *
 * @param watcherId - Who is watching, so that their ratings are the ones asked for.
 * @returns What they gave each thing, and how to change it.
 */
const useRatings = (watcherId: string | null): Ratings => {
  const cache = useQueryClient();
  const asked = viewingQueries.ratings(watcherId);
  const held = useQuery(asked);

  const given = useMemo(
    () => new Map((held.data ?? []).map((rating) => [keyOf(rating), rating.stars])),
    [held.data],
  );

  const write = (subject: RatingSubject, stars: number | null): void => {
    const key = keyFor(subject);

    cache.setQueryData(asked.queryKey, (ratings = []) => {
      const without = ratings.filter((rating) => keyOf(rating) !== key);

      if (stars === null) {
        return without;
      }

      return [
        ...without,
        {
          mediaId: 'mediaId' in subject ? subject.mediaId : null,
          seriesId: 'seriesId' in subject ? subject.seriesId : null,
          stars,
          ratedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const rate = (subject: RatingSubject, stars: number | null): void => {
    const before = given.get(keyFor(subject)) ?? null;

    write(subject, stars);

    void cache.cancelQueries({ queryKey: asked.queryKey }, { revert: false });

    void setRating(subject, stars).then((agreed) => {
      if (!agreed) {
        write(subject, before);
      }
    });
  };

  return {
    ratingFor: (subject) => given.get(keyFor(subject)) ?? null,
    rate,
  };
};

export type { Ratings };

export { useRatings };
