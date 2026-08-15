import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { fetchShows } from '@FluxWeb/library/fetchShows';
import type { LibraryKind } from '@FluxContracts/schemas/Library';
import type { Surprise } from './pickAnything.types';

type Shelf = {
  total: number;
  at: (index: number) => Promise<Surprise | null>;
};

/**
 * What a shows library offers, which is programmes rather than episodes.
 */
const shelfOfShows = async (libraryId: string): Promise<Shelf> => {
  const shows = await fetchShows(libraryId);

  return {
    total: shows.length,
    at: (index) => {
      const found = shows[index];

      return Promise.resolve(found === undefined ? null : { kind: 'show', showId: found.id });
    },
  };
};

/**
 * What every other library offers, where an item is its own destination.
 */
const shelfOfItems = async (libraryId: string): Promise<Shelf> => {
  const total = await fetchLibraryItems(libraryId, { limit: 1 })
    .then((page) => page.total)
    .catch(() => 0);

  return {
    total,
    at: async (index) => {
      const page = await fetchLibraryItems(libraryId, { limit: 1, offset: index });
      const found = page.items[0];

      return found === undefined ? null : { kind: 'item', item: found };
    },
  };
};

/**
 * Something to watch, chosen by nobody.
 */
const pickAnything = async (only?: LibraryKind): Promise<Surprise | null> => {
  try {
    const libraries = await fetchLibraries();
    const wanted = only === undefined ? libraries : libraries.filter((one) => one.kind === only);

    const shelves = await Promise.all(
      wanted.map(async (entry) =>
        entry.kind === 'shows'
          ? shelfOfShows(entry.id).catch(() => ({ total: 0, at: () => Promise.resolve(null) }))
          : shelfOfItems(entry.id).catch(() => ({ total: 0, at: () => Promise.resolve(null) })),
      ),
    );

    const total = shelves.reduce((held, shelf) => held + shelf.total, 0);

    if (total === 0) {
      return null;
    }

    let at = Math.floor(Math.random() * total);

    for (const shelf of shelves) {
      if (at < shelf.total) {
        return await shelf.at(at);
      }

      at -= shelf.total;
    }

    return null;
  } catch {
    return null;
  }
};

export { pickAnything };
