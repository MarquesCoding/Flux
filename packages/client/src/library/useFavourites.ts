import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setFavourite } from '@ValenceClient/library/fetchFavourites';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';

type Favourites = {
  kept: Set<string>;
  isKept: (mediaId: string) => boolean;
  toggle: (mediaId: string) => void;
};

/**
 * What this viewer has kept, and the one gesture that changes it. The list lives in the shared cache
 * rather than in this hook, so a heart filled on the home page is filled in the dialog and on the
 * favourites page without any of them being told.
 *
 * The change is written to the cache before the server is asked, so a heart fills the moment it is
 * pressed, and put back the same way if the server refuses. Only that one item is put back rather
 * than the whole list, since somebody keeping two things quickly should not have the first undone
 * by the second being refused. Any read still in flight is called off first, so a list that arrives
 * a moment later does not report the heart as empty again.
 *
 * @param watcherId - Who is watching, so that their list is the one asked for.
 * @returns What they have kept, and how to change it.
 */
const useFavourites = (watcherId: string | null): Favourites => {
  const cache = useQueryClient();
  const asked = viewingQueries.favourites(watcherId);
  const held = useQuery(asked);

  const kept = useMemo(() => new Set(held.data ?? []), [held.data]);

  const write = (mediaId: string, wants: boolean): void => {
    cache.setQueryData(asked.queryKey, (ids = []) =>
      wants ? [...ids.filter((id) => id !== mediaId), mediaId] : ids.filter((id) => id !== mediaId),
    );
  };

  const toggle = (mediaId: string): void => {
    const wants = !kept.has(mediaId);

    write(mediaId, wants);

    void cache.cancelQueries({ queryKey: asked.queryKey }, { revert: false });

    void setFavourite(mediaId, wants).then((agreed) => {
      if (!agreed) {
        write(mediaId, !wants);
      }
    });
  };

  return {
    kept,
    isKept: (mediaId) => kept.has(mediaId),
    toggle,
  };
};

export type { Favourites };

export { useFavourites };
