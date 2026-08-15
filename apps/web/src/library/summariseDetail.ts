import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * Everything about an item, cut down to what a page needs to draw it.
 *
 * The library hands out summaries as it draws, but an address naming an item
 * arrives before anything has been drawn — a link to a film, or a reload while
 * one is playing. The only way to answer that is to read the item in full and
 * take the part that was wanted, which is what this does.
 *
 * `seriesId` is null because the full record does not carry one; the series
 * title does the work of grouping until it does. Better a summary that says
 * nothing about the series than one that invents an identifier.
 */
const summariseDetail = (detail: MediaDetail): MediaSummary => ({
  id: detail.id,
  libraryId: detail.libraryId,
  title: detail.title,
  year: detail.year ?? null,
  durationSeconds: detail.durationSeconds,
  width: detail.width,
  height: detail.height,
  videoCodec: detail.videoCodec,
  videoRange: detail.videoRange,
  addedAt: detail.addedAt,
  hasPoster: detail.metadata.hasPoster,
  hasBackdrop: detail.metadata.hasBackdrop,
  hasLogo: detail.metadata.hasLogo,
  seriesId: null,
  rating: detail.metadata.rating ?? null,
  seriesTitle: detail.metadata.seriesTitle ?? null,
  seasonNumber: detail.metadata.seasonNumber ?? null,
  episodeNumber: detail.metadata.episodeNumber ?? null,
  genres: detail.metadata.genres ?? null,
});

export { summariseDetail };
