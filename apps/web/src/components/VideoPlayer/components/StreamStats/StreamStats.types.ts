import type { DeliveredFormat } from '@FluxWeb/playback/attachShaka';
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession';
import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';

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
  delivered: DeliveredFormat | null;
  sessionStartSeconds: number;
  onClose: () => void;
};

export type { PlaybackHealth, StreamStatsProps };
