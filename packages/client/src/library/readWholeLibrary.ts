import { fetchLibraryItems } from '@ValenceClient/library/fetchLibrary';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const PAGE_SIZE = 200;
const MOST_PAGES = 100;

/**
 * Reads every item in a library by asking for one page after another. For the few things that
 * genuinely need all of it — the randomiser, the rails — where a single page would answer with
 * whatever the first sixty happened to be.
 *
 * @param libraryId - The library to read.
 * @returns Every item in it.
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
