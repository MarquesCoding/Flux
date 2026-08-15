import { createHash } from 'node:crypto';

type SubtitleTrack = {
  id: string;
  language: string | null;
  label: string;
  format: string;
  isForced: boolean;
  isHearingImpaired: boolean;
};

type SubtitleService = {
  list: (mediaId: string) => Promise<SubtitleTrack[] | null>;
  read: (mediaId: string, trackId: string) => Promise<string | null>;
};

/**
 * Names a track from its path.
 */
const trackId = (path: string): string =>
  createHash('sha256').update(path).digest('hex').slice(0, 16);

export type { SubtitleService, SubtitleTrack };

export { trackId };
