import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { fetchLibraries, fetchLibraryItems, fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
import { fetchShows, fetchShow } from '@FluxWeb/library/fetchShows';
import { fetchFacets } from '@FluxWeb/library/fetchFacets';
import { fetchPerson, fetchPersonCredits } from '@FluxWeb/library/fetchPerson';
import type { ListItemsOptions } from '@FluxWeb/library/fetchLibrary';

const LIBRARY = ['library'] as const;

/**
 * The libraries this server holds.
 *
 * @returns The query.
 */
const all = () =>
  queryOptions({
    queryKey: [...LIBRARY, 'all'],
    queryFn: () => fetchLibraries(),
  });

/**
 * A page of one library, for whatever question is being asked of it.
 *
 * The options are the key, so two screens asking the same question share one answer and a screen
 * asking a different one does not overwrite it. Searching does not throw away the unsearched page,
 * which is what makes clearing a search instant.
 *
 * The answer carries the library it came from, because the last one stays on screen while the next
 * is being fetched, and a page reporting itself empty has to name the library it is empty of rather
 * than the library that has only just been asked for.
 *
 * @param libraryId - Which library, or null where none has been chosen yet.
 * @param options - What is being asked of it.
 * @returns The query.
 */
const items = (libraryId: string | null, options: ListItemsOptions = {}) =>
  queryOptions({
    queryKey: [...LIBRARY, 'items', libraryId, options],
    queryFn: async () => ({ ...(await fetchLibraryItems(libraryId ?? '', options)), libraryId }),
    enabled: libraryId !== null,
    placeholderData: keepPreviousData,
  });

/**
 * Everything about one item, which is what a dialog and a hover card both want.
 *
 * @param mediaId - The item, or null where nothing is being looked at.
 * @returns The query.
 */
const detail = (mediaId: string | null) =>
  queryOptions({
    queryKey: [...LIBRARY, 'detail', mediaId],
    queryFn: () => fetchMediaDetail(mediaId ?? ''),
    enabled: mediaId !== null,
  });

/**
 * The programmes in a library, grouped from their episodes.
 *
 * @param libraryId - Which library, or null where none has been chosen yet.
 * @returns The query.
 */
const shows = (libraryId: string | null) =>
  queryOptions({
    queryKey: [...LIBRARY, 'shows', libraryId],
    queryFn: () => fetchShows(libraryId ?? ''),
    enabled: libraryId !== null,
  });

/**
 * One programme, with its seasons.
 *
 * @param libraryId - Which library it is in.
 * @param showId - Which programme, or null where none is open.
 * @returns The query.
 */
const show = (libraryId: string | null, showId: string | null) =>
  queryOptions({
    queryKey: [...LIBRARY, 'show', libraryId, showId],
    queryFn: () => fetchShow(libraryId ?? '', showId ?? ''),
    enabled: libraryId !== null && showId !== null,
  });

/**
 * What a library can be filtered by — its genres, its years, its ratings.
 *
 * @returns The query.
 */
const facets = () =>
  queryOptions({
    queryKey: [...LIBRARY, 'facets'],
    queryFn: () => fetchFacets(),
  });

/**
 * Somebody in the cast or crew.
 *
 * @param personId - Who, or null where nobody is open.
 * @returns The query.
 */
const person = (personId: number | null) =>
  queryOptions({
    queryKey: [...LIBRARY, 'person', personId],
    queryFn: () => fetchPerson(personId ?? 0),
    enabled: personId !== null,
  });

/**
 * What of theirs is here.
 *
 * @param personId - Who, or null where nobody is open.
 * @returns The query.
 */
const credits = (personId: number | null) =>
  queryOptions({
    queryKey: [...LIBRARY, 'credits', personId],
    queryFn: () => fetchPersonCredits(personId ?? 0),
    enabled: personId !== null,
  });

/**
 * A sample from every library at once, which is what the hero picks what to feature from.
 *
 * One query rather than one per library, because the hero wants a single answer and a screen that
 * renders when three of five libraries have replied is a screen that changes what it is featuring
 * while somebody is looking at it.
 *
 * @param libraryIds - The libraries to sample.
 * @param each - How much to take from each.
 * @returns The query.
 */
const sample = (libraryIds: readonly string[], each: number) =>
  queryOptions({
    queryKey: [...LIBRARY, 'sample', [...libraryIds].sort(), each],
    queryFn: async () => {
      const pages = await Promise.all(
        libraryIds.map((libraryId) =>
          fetchLibraryItems(libraryId, { search: '', limit: each })
            .then((page) => page.items)
            .catch(() => []),
        ),
      );

      return pages.flat();
    },
    enabled: libraryIds.length > 0,
  });

const libraryQueries = {
  all,
  items,
  detail,
  shows,
  show,
  facets,
  person,
  credits,
  sample,
  key: LIBRARY,
};

export { libraryQueries };
