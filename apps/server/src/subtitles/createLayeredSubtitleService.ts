import type { SubtitleService, SubtitleTrack } from './SubtitleService';

/**
 * Several sources of subtitles, presented as one.
 *
 * A viewer does not care whether a track came out of the container or off the
 * disk beside it, so the menu does not say. Sources are asked in the order
 * they were given and their tracks appear in that order, which is what puts a
 * hand-picked sidecar above whatever the release happened to embed.
 *
 * Identifiers stay unique across sources because each names its tracks from
 * something only it has: a sidecar from the file's own path, an embedded track
 * from that path and a stream index.
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
