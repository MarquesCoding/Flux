import type { SubtitleService, SubtitleTrack } from './SubtitleService';

/**
 * Presents several sources of subtitles as one list — the container's own tracks and the files
 * beside it — so a viewer chooses between tracks rather than between where they came from.
 *
 * @param sources - The sources to ask, in the order their tracks should appear.
 * @returns One subtitle service covering all of them.
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

  readCues: async (mediaId, trackId) => {
    for (const source of sources) {
      const cues = await source.readCues(mediaId, trackId);

      if (cues !== null) {
        return cues;
      }
    }

    return null;
  },
});

export { createLayeredSubtitleService };
