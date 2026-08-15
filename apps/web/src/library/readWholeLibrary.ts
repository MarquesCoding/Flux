import { fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const PAGE_SIZE = 200;
const MOST_PAGES = 100;

/**
 * Reads every item in a library, a page at a time.
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
