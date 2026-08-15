import type { SubtitleService, SubtitleTrack } from './SubtitleService';

/**
 * Several sources of subtitles, presented as one.
 */
const createLayeredSubtitleService = (sources: SubtitleService[]): SubtitleService => ({
  list: async (mediaId) => {
    const found = await Promise.all(sources.map(async (source) => source.list(mediaId)));

    if (found.every((tracks) => tracks === null)) {
      return null;
    }

    const tracks: SubtitleTrack[] = found.flatMap((entry) => entry ?? []);

    return tracks;
  },

  read: async (mediaId, trackId) => {
    for (const source of sources) {
      const track = await source.read(mediaId, trackId);

      if (track !== null) {
        return track;
      }
    }

    return null;
  },
});

export { createLayeredSubtitleService };
