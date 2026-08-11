import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFavourites, setFavourite } from '@FluxWeb/library/fetchFavourites';

type Favourites = {
  kept: Set<string>;
  isKept: (mediaId: string) => boolean;
  toggle: (mediaId: string) => void;
};

/**
 * What this viewer has kept, and the one gesture that changes it.
 *
 * Read once for the whole session rather than per card: a page of forty items
 * each asking whether it is kept is forty requests to draw forty hearts.
 *
 * The heart fills before the server has answered and puts itself back if the
 * server disagrees. Keeping something is not a transaction — nothing else
 * depends on it having happened — and a heart that waits for a round trip
 * feels broken on a connection that is merely slow.
 */
const useFavourites = (): Favourites => {
  const [kept, setKept] = useState<Set<string>>(new Set());
  // What this viewer has changed since the page opened. The list is read once
  // on the way in, and a heart pressed before that read lands would otherwise
  // be undone by an answer that was already stale when it was asked for.
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
