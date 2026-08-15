import { LibraryFacetsSchema } from '@FluxContracts/schemas/Library';
import type { LibraryFacets } from '@FluxContracts/schemas/Library';

/**
 * What the libraries hold that is worth filtering by.
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
