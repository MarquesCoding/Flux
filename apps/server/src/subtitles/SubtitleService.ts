import { createHash } from 'node:crypto';

type SubtitleTrack = {
  id: string;
  language: string | null;
  label: string;
  format: string;
  isForced: boolean;
  isHearingImpaired: boolean;
  delivery: 'text' | 'burnIn';
  streamIndex: number | null;
};

type SubtitleService = {
  list: (mediaId: string) => Promise<SubtitleTrack[] | null>;
  read: (mediaId: string, trackId: string) => Promise<string | null>;
};

/**
 * Builds the identifier for a subtitle file from its path, so that listing the tracks and later
 * fetching one agree on what each is called without the path itself appearing in an address.
 *
 * @param path - The subtitle file's path.
 * @returns The track identifier.
 */
const trackId = (path: string): string =>
  createHash('sha256').update(path).digest('hex').slice(0, 16);

export type { SubtitleService, SubtitleTrack };

export { trackId };
