import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRatings, setRating } from '@FluxWeb/library/fetchRatings';
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
 * What this viewer has rated, and the one gesture that changes it. Keeps its own copy so a star
 * fills the moment it is pressed rather than when the server answers, and puts it back if the server
 * refuses — the same bargain `useFavourites` makes, for the same reason.
 *
 * @returns What they gave each thing, and how to change it.
 */
const useRatings = (): Ratings => {
  const [given, setGiven] = useState<Map<string, number>>(new Map());
  const changedRef = useRef(new Map<string, number | null>());

  useEffect(() => {
    void fetchRatings().then((arrived) => {
      const held = new Map(
        arrived.map((entry) => [
          entry.mediaId === null
            ? keyFor({ seriesId: entry.seriesId ?? '' })
            : keyFor({ mediaId: entry.mediaId }),
          entry.stars,
        ]),
      );

      for (const [key, stars] of changedRef.current) {
        if (stars === null) {
          held.delete(key);
        } else {
          held.set(key, stars);
        }
      }

      setGiven(held);
    });
  }, []);

  const rate = useCallback(
    (subject: RatingSubject, stars: number | null) => {
      const key = keyFor(subject);
      const before = given.get(key) ?? null;

      changedRef.current.set(key, stars);

      setGiven((held) => {
        const next = new Map(held);

        if (stars === null) {
          next.delete(key);
        } else {
          next.set(key, stars);
        }

        return next;
      });

      void setRating(subject, stars).then((agreed) => {
        if (agreed) {
          return;
        }

        changedRef.current.set(key, before);

        setGiven((held) => {
          const next = new Map(held);

          if (before === null) {
            next.delete(key);
          } else {
            next.set(key, before);
          }

          return next;
        });
      });
    },
    [given],
  );

  return {
    ratingFor: (subject) => given.get(keyFor(subject)) ?? null,
    rate,
  };
};

export type { Ratings };

export { useRatings };
