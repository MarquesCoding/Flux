import type { LibraryKind } from '@ValenceContracts/schemas/Library';
import type { MediaKind } from '@ValenceContracts/schemas/MediaKind';

/**
 * Says what kind of thing one item is, which nothing stores.
 *
 * `media_item` has no discriminator column — an episode is told from a film by having a series
 * behind it, an extra by saying which sort of extra it is, and everything else is decided by the
 * library it sits in. A book is not a media item
 * at all, so it never reaches here through the same scan; it is admitted because a
 * subscriber filtering on kind has to be able to name one.
 *
 * @param item - What was found, so far as the scan knows it.
 * @param libraryKind - What the library it landed in reads.
 * @returns The kind to report.
 */
const mediaKindOf = (
  item: { seriesTitle: string | null; extraKind?: string | null },
  libraryKind: LibraryKind,
): MediaKind => {
  if (libraryKind === 'books') {
    return 'book';
  }

  if ((item.extraKind ?? null) !== null) {
    return 'video';
  }

  if (libraryKind === 'music') {
    return 'song';
  }

  return item.seriesTitle === null ? 'movie' : 'episode';
};

export { mediaKindOf };
