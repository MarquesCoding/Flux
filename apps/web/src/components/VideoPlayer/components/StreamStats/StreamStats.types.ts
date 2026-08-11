import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession';
import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * What the browser is doing with the stream right now.
 *
 * Read from the media element rather than the server, because the two
 * disagreeing is exactly the situation this panel exists to expose.
 */
type PlaybackHealth = {
  positionSeconds: number;
  bufferedAheadSeconds: number;
  encodedSeconds: number;
  droppedFrames: number | null;
  decodedFrames: number | null;
  presentedWidth: number;
  presentedHeight: number;
};

type StreamStatsProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'>;
  session: StartedSession | null;
  detail: MediaDetail | null;
  health: PlaybackHealth;
  sessionStartSeconds: number;
  onClose: () => void;
};

export type { PlaybackHealth, StreamStatsProps };
