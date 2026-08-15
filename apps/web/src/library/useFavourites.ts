import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFavourites, setFavourite } from '@FluxWeb/library/fetchFavourites';

type Favourites = {
  kept: Set<string>;
  isKept: (mediaId: string) => boolean;
  toggle: (mediaId: string) => void;
};

/**
 * What this viewer has kept, and the one gesture that changes it.
 */
const useFavourites = (): Favourites => {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const changedRef = useRef(new Map<string, boolean>());

  useEffect(() => {
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
  }, []);

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
