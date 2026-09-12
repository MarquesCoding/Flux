import type { ScanEntry } from '@ValenceScreens/components/AdminArea/scanCoordinator';

const READING_KINDS = new Set([
  'scan',
  'rescan',
  'library.scan',
  'library.readAgain',
  'library.reset',
]);

/**
 * The reading a library has going, where it has any.
 *
 * A library row says one thing, and the thing it says is whether the library is being read.
 * Thumbnails and clips are drawn for hours after a scan has finished — that is the point of a scan
 * that returns — and they are reported where the rest of the queue is reported, rather than by a row
 * that would otherwise mean two things at once and flicker between them.
 *
 * It is also what decides whether the row's actions are offered. Reading twice at once is what
 * cannot happen; a rescan while the thumbnails are still being drawn is exactly what should.
 *
 * @param progress - Every piece of work being followed.
 * @param libraryId - The library the row is for.
 * @returns The reading, or undefined where the library is not being read.
 */
const readingOf = (
  progress: ReadonlyMap<string, ScanEntry>,
  libraryId: string,
): ScanEntry | undefined =>
  [...progress.values()].find(
    (entry) => entry.libraryId === libraryId && READING_KINDS.has(entry.kind),
  );

export { readingOf };
