import { readFromServer } from '@FluxClient/query/readFromServer';
import { LibraryFacetsSchema } from '@FluxContracts/schemas/Library';
import type { LibraryFacets } from '@FluxContracts/schemas/Library';

/**
 * What the libraries actually hold that is worth filtering by — the genres present, the decades
 * covered. Read from the catalogue rather than written into the page, so the filters offer only what
 * would find something.
 */
const fetchFacets = async (): Promise<LibraryFacets> => {
  return readFromServer('/api/library-facets', LibraryFacetsSchema);
};

export { fetchFacets };
