import { platformInUse } from '@FluxClient/platform/installPlatform';

const STORAGE_KEY = 'flux.library.last';

/**
 * Reads which library this viewer was last looking at.
 *
 * Kept on the device rather than against the account, because it is a property of the sitting rather
 * than of the person: the same viewer opens the television to watch something and the tablet to read
 * something, and a choice that followed them between the two would be wrong in one of them every
 * time.
 *
 * @returns The library, or nothing where nobody has chosen one here yet.
 */
const readLastLibrary = (): string | null => platformInUse().store.read(STORAGE_KEY);

/**
 * Remembers which library is being looked at, so opening the application returns to it.
 *
 * Without this the application opens on whichever library the server happens to list first, which is
 * nobody's choice and is alphabetical — so somebody who has never opened a book is shown books every
 * time they start it.
 *
 * @param libraryId - The library being shown.
 */
const rememberLastLibrary = (libraryId: string): void => {
  platformInUse().store.write(STORAGE_KEY, libraryId);
};

export { STORAGE_KEY, readLastLibrary, rememberLastLibrary };
