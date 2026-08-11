import { toWebVtt } from '@FluxCore/functions/toWebVtt';
import { trackId } from './SubtitleService';
import type { SubtitleService, SubtitleTrack } from './SubtitleService';

type MemorySubtitle = {
  path: string;
  language: string | null;
  label: string;
  format: string;
  contents: string;
  isForced?: boolean;
  isHearingImpaired?: boolean;
};

type MemoryState = Record<string, MemorySubtitle[]>;

/**
 * Subtitles held in memory.
 *
 * Lets the HTTP surface be tested without a library on disk, in the same way
 * the memory library and playback adapters do.
 */
const createMemorySubtitleService = (state: MemoryState = {}): SubtitleService => {
  const tracksFor = (mediaId: string): SubtitleTrack[] | null => {
    const found = state[mediaId];

    if (found === undefined) {
      return null;
    }

    return found.map((track) => ({
      id: trackId(track.path),
      language: track.language,
      label: track.label,
      format: track.format,
      isForced: track.isForced ?? false,
      isHearingImpaired: track.isHearingImpaired ?? false,
    }));
  };

  return {
    list: (mediaId) => Promise.resolve(tracksFor(mediaId)),

    read: (mediaId, id) => {
      const track = state[mediaId]?.find((candidate) => trackId(candidate.path) === id);

      return Promise.resolve(track === undefined ? null : toWebVtt(track.contents, track.format));
    },
  };
};

export type { MemoryState, MemorySubtitle };

export { createMemorySubtitleService };
