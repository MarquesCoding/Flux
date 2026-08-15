import { LibraryFacetsSchema } from '@FluxContracts/schemas/Library';
import type { LibraryFacets } from '@FluxContracts/schemas/Library';

/**
 * What the libraries hold that is worth filtering by.
 *
 * Asked of the server rather than gathered here. This used to read a couple
 * of hundred items out of every library and collect the genres from them,
 * which cost a request per library to answer a question one query answers —
 * and quietly missed any genre that happened to appear further down than the
 * sample reached, so a chip for it never existed.
 *
 * Answers with nothing rather than failing when the server cannot be reached:
 * the chips are a way to narrow a search, and a search page that will not draw
 * because a list of headings could not be fetched is worse than one with no
 * headings.
 */
const fetchFacets = async (): Promise<LibraryFacets> => {
  const empty: LibraryFacets = {
    genres: [],
    decades: [],
    maxRating: 0,
  };

  const response = await fetch('/api/library-facets', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return empty;
  }

  const read = LibraryFacetsSchema.safeParse(await response.json().catch(() => null));

  return read.success ? read.data : empty;
};

export { fetchFacets };
