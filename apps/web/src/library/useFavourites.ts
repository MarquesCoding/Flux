import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFavourites, setFavourite } from '@FluxWeb/library/fetchFavourites';

type Favourites = {
  kept: Set<string>;
  isKept: (mediaId: string) => boolean;
  toggle: (mediaId: string) => void;
};

/**
 * What this viewer has kept, and the one gesture that changes it. Keeps its own copy so a heart fills
 * the moment it is pressed rather than when the server answers, and puts it back if the server
 * refuses.
 *
 * Read again whenever the person watching changes, and the local copy dropped with it, for the same
 * reason `useRatings` does it: the application is not remounted when somebody else signs in, so a
 * list held once for its lifetime belongs to whoever was there first.
 *
 * @param watcherId - Who is watching, so that their list is the one held.
 */
const useFavourites = (watcherId: string | null): Favourites => {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const changedRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    changedRef.current = new Map();
    setKept(new Set());

    if (watcherId === null) {
      return;
    }

    void fetchFavourites().then((ids) => {
      const arrived = new Set(ids);

      for (const [mediaId, wants] of changedRef.current) {
        if (wants) {
          arrived.add(mediaId);
        } else {
          arrived.delete(mediaId);
        }
      }

      setKept(arrived);
    });
  }, [watcherId]);

  const toggle = useCallback(
    (mediaId: string) => {
      const wants = !kept.has(mediaId);

      changedRef.current.set(mediaId, wants);

      setKept((held) => {
        const next = new Set(held);

        if (wants) {
          next.add(mediaId);
        } else {
          next.delete(mediaId);
        }

        return next;
      });

      void setFavourite(mediaId, wants).then((agreed) => {
        if (agreed) {
          return;
        }

        changedRef.current.set(mediaId, !wants);

        setKept((held) => {
          const next = new Set(held);

          if (wants) {
            next.delete(mediaId);
          } else {
            next.add(mediaId);
          }

          return next;
        });
      });
    },
    [kept],
  );

  return {
    kept,
    isKept: (mediaId) => kept.has(mediaId),
    toggle,
  };
};

export type { Favourites };

export { useFavourites };
