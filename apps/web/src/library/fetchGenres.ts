import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';

/**
 * How much of each library is read to find out what genres it holds.
 *
 * There is no endpoint that answers "what genres are there", so the answer is
 * gathered from a sample of what is in the library. A few hundred items name
 * every genre a library of any size actually contains — genres repeat, and one
 * that appears on nothing in the first two hundred items is not a heading
 * worth putting in a footer.
 */
const SAMPLED = 200;

/**
 * Every genre the library has anything filed under, in alphabetical order.
 *
 * Read from the items rather than from a list of its own, because a genre is
 * only real here if something carries it: a catalogue's full taxonomy would
 * offer a viewer forty headings, thirty of which lead to an empty page.
 */
const fetchGenres = async (): Promise<string[]> => {
  const libraries = await fetchLibraries().catch(() => []);

  const pages = await Promise.all(
    libraries.map((library) =>
      fetchLibraryItems(library.id, { limit: SAMPLED }).catch(() => ({ items: [], total: 0 })),
    ),
  );

  const named = new Set(pages.flatMap((page) => page.items).flatMap((item) => item.genres ?? []));

  return [...named].sort((left, right) => left.localeCompare(right));
};

export { fetchGenres };
