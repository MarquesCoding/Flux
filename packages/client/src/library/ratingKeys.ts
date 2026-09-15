import type { RatingSubject } from '@ValenceClient/library/fetchRatings';

/**
 * Builds the key a rating is held under, keeping items and programmes apart so that an item and a
 * programme sharing an identifier never answer for each other.
 *
 * @param subject - The item or programme.
 * @returns The key it is held under.
 */
const keyFor = (subject: RatingSubject): string =>
  'mediaId' in subject ? `media:${subject.mediaId}` : `series:${subject.seriesId}`;

/**
 * Says which subject a rating the server sent back is about, which is the same key read the other
 * way round.
 *
 * @param rating - What the server sent.
 * @returns The key it is held under.
 */
const keyOf = (rating: { mediaId: string | null; seriesId: string | null }): string =>
  rating.mediaId === null ? `series:${rating.seriesId ?? ''}` : `media:${rating.mediaId}`;

export { keyFor, keyOf };
