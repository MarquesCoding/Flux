import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { fetchShows } from '@FluxWeb/library/fetchShows';
import type { LibraryKind } from '@FluxContracts/schemas/Library';
import type { Surprise } from './pickAnything.types';

/**
 * How many things a library offers, and how to reach the one at a given place.
 *
 * A programme counts once however long it ran. Counting its episodes instead
 * is what made the dice a recommendation: a library holding one film and one
 * two-hundred-episode programme offered that programme two hundred times out
 * of two hundred and one.
 */
type Shelf = {
  total: number;
  at: (index: number) => Promise<Surprise | null>;
};

/**
 * What a shows library offers, which is programmes rather than episodes.
 *
 * Costs the whole list, because there is no count of programmes to ask for —
 * only of items. That list is programmes rather than episodes, so it is a
 * fraction of the library either way.
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
 *
 * Counts first and then asks, rather than reading the library to shuffle it:
 * one request establishes the total and a second fetches a single item at a
 * random place, instead of ten thousand descriptions to use one.
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
 *
 * For the evening that starts with twenty minutes of scrolling. The point of
 * it is that it is not a recommendation: no weighting by what was watched, no
 * favouring of what a page happened to load, just one thing off the server
 * with the same chance as any other.
 *
 * "The same chance as any other" means every destination, not every file. A
 * programme is one thing to choose whether it ran for one series or twenty,
 * and it opens at the programme rather than at some episode seven nobody asked
 * for.
 *
 * `only` narrows it to a kind of library, for somebody who has already decided
 * they want a film. Left out, everything is in the running.
 *
 * Answers with nothing rather than throwing: a server with an empty library
 * has nothing to suggest, and that is an answer rather than a fault.
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
