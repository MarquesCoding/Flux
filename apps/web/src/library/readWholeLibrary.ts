import { fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const PAGE_SIZE = 200;
const MOST_PAGES = 100;

/**
 * Reads every item in a library, a page at a time.
 *
 * The server refuses a page larger than two hundred, so asking for the lot in
 * one go fails the whole read rather than returning a shortened list. Paging
 * is therefore not an optimisation here, it is the only way to see past the
 * two hundredth item.
 *
 * Stops when a page comes back short, when the total is reached, or after a
 * hundred pages — a server that always says there is more should not be able
 * to spin this forever.
 *
 * A failed page ends the read and returns what was gathered, since a partial
 * list is more use than none.
 */
const readWholeLibrary = async (libraryId: string): Promise<MediaSummary[]> => {
  const gathered: MediaSummary[] = [];

  for (let page = 0; page < MOST_PAGES; page += 1) {
    const answer = await fetchLibraryItems(libraryId, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).catch(() => null);

    if (answer === null) {
      return gathered;
    }

    gathered.push(...answer.items);

    if (answer.items.length < PAGE_SIZE || gathered.length >= answer.total) {
      return gathered;
    }
  }

  return gathered;
};

export { readWholeLibrary };
