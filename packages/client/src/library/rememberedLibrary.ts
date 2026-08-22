import type { Library, MediaSummary } from '@ValenceContracts/schemas/Library';

type Held = {
  libraries: Library[];
  heroItems: MediaSummary[];
  items: Map<string, MediaSummary[]>;
};

const held: Held = { libraries: [], heroItems: [], items: new Map() };

/**
 * Builds the key an answer is filed under, so that the same library asked the same question reads
 * back what it was told rather than asking again.
 *
 * @param libraryId - Which library.
 * @param search - What was being looked for, which is usually nothing.
 * @returns The key.
 */
const keyOf = (libraryId: string, search: string): string => `${libraryId}${search}`;

/**
 * The libraries themselves, which change rarely and never mid-visit.
 *
 * @returns What was last read, or nothing.
 */
const libraries = (): Library[] => held.libraries;

/**
 * Remembers the libraries.
 *
 * @param found - What the server said.
 */
const rememberLibraries = (found: Library[]): void => {
  held.libraries = found;
};

/**
 * The sample the hero picks from.
 *
 * @returns What was last read, or nothing.
 */
const heroItems = (): MediaSummary[] => held.heroItems;

/**
 * Remembers the hero's sample.
 *
 * @param found - What the server said.
 */
const rememberHeroItems = (found: MediaSummary[]): void => {
  held.heroItems = found;
};

/**
 * The first page of a library, for a given search.
 *
 * @param libraryId - Which library.
 * @param search - What was being looked for.
 * @returns What was last read, or nothing.
 */
const items = (libraryId: string, search: string): MediaSummary[] | undefined =>
  held.items.get(keyOf(libraryId, search));

/**
 * Remembers the first page of a library.
 *
 * @param libraryId - Which library.
 * @param search - What was being looked for.
 * @param found - What the server said.
 */
const rememberItems = (libraryId: string, search: string, found: MediaSummary[]): void => {
  held.items.set(keyOf(libraryId, search), found);
};

/**
 * Forgets everything, for a sign-out, a rescan under the viewer, or the end of a test.
 */
const forget = (): void => {
  held.libraries = [];
  held.heroItems = [];
  held.items.clear();
};

const rememberedLibrary = {
  libraries,
  rememberLibraries,
  heroItems,
  rememberHeroItems,
  items,
  rememberItems,
  forget,
};

export { rememberedLibrary };
