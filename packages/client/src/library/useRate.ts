import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setRating } from '@ValenceClient/library/fetchRatings';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { keyFor, keyOf } from '@ValenceClient/library/ratingKeys';
import type { RatingSubject } from '@ValenceClient/library/fetchRatings';

/**
 * The one gesture that changes a rating, and nothing else.
 *
 * Deliberately holds no `useQuery`. Whoever gives a star is almost never whoever shows one — the
 * shell hands this to two dialogs and draws no star itself — and a hook that subscribed to every
 * rating in order to hand back a way of setting one would redraw the whole page on each press. That
 * is what it did: the press wrote to the very key the shell was reading, so rating something inside
 * a dialog redrew the library behind it. `useQueryClient` gives the cache without listening to it.
 *
 * The change is written to the cache before the server is asked, so a star fills on the press, and
 * only that one subject is put back if the server refuses. Any read still in flight is called off
 * first, so a list that arrives a moment later does not empty the star again.
 *
 * A rating the server took changes what the household gave the thing, so that figure is thrown away
 * and asked for again — the panel showing it does not have to know a rating was given.
 *
 * @param watcherId - Who is watching, so that their ratings are the ones written.
 * @returns How to give a star, or take one back.
 */
const useRate = (
  watcherId: string | null,
): ((subject: RatingSubject, stars: number | null) => void) => {
  const cache = useQueryClient();

  return useCallback(
    (subject: RatingSubject, stars: number | null) => {
      const asked = viewingQueries.ratings(watcherId);
      const key = keyFor(subject);

      const write = (given: number | null): void => {
        cache.setQueryData(asked.queryKey, (ratings = []) => {
          const without = ratings.filter((rating) => keyOf(rating) !== key);

          if (given === null) {
            return without;
          }

          return [
            ...without,
            {
              mediaId: 'mediaId' in subject ? subject.mediaId : null,
              seriesId: 'seriesId' in subject ? subject.seriesId : null,
              stars: given,
              ratedAt: new Date().toISOString(),
            },
          ];
        });
      };

      const before =
        (cache.getQueryData(asked.queryKey) ?? []).find((rating) => keyOf(rating) === key)?.stars ??
        null;

      write(stars);

      void cache.cancelQueries({ queryKey: asked.queryKey }, { revert: false });

      void setRating(subject, stars).then((agreed) => {
        if (!agreed) {
          write(before);

          return;
        }

        void cache.invalidateQueries({ queryKey: viewingQueries.household(subject).queryKey });
      });
    },
    [cache, watcherId],
  );
};

export { useRate };
