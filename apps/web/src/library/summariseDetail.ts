import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * Everything about an item, cut down to what a page needs to draw it.
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
