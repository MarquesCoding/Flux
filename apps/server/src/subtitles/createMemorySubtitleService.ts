import { toWebVtt } from '@ValenceCore/functions/toWebVtt';
import { parseAdvancedSubStation } from '@ValenceCore/functions/parseAdvancedSubStation';
import { trackId } from './SubtitleService';
import type { SubtitleService, SubtitleTrack } from './SubtitleService';

const STYLED_FORMATS = new Set(['ass', 'ssa']);

type MemorySubtitle = {
  path: string;
  language: string | null;
  label: string;
  format: string;
  contents: string;
  isForced?: boolean;
  isHearingImpaired?: boolean;
  delivery?: 'text' | 'burnIn';
  streamIndex?: number | null;
};

type MemoryState = Record<string, MemorySubtitle[]>;

/**
 * Subtitles held in memory, so the routes can be exercised without files on disk.
 *
 * @param state - Any tracks to offer.
 * @returns The subtitle service.
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
      delivery: track.delivery ?? 'text',
      streamIndex: track.streamIndex ?? null,
    }));
  };

  return {
    list: (mediaId) => Promise.resolve(tracksFor(mediaId)),

    read: (mediaId, id) => {
      const track = state[mediaId]?.find((candidate) => trackId(candidate.path) === id);

      return Promise.resolve(track === undefined ? null : toWebVtt(track.contents, track.format));
    },

    readCues: (mediaId, id) => {
      const track = state[mediaId]?.find((candidate) => trackId(candidate.path) === id);

      if (track === undefined || !STYLED_FORMATS.has(track.format.toLowerCase())) {
        return Promise.resolve(null);
      }

      return Promise.resolve(parseAdvancedSubStation(track.contents).cues);
    },
  };
};

export type { MemoryState };

export { createMemorySubtitleService };
