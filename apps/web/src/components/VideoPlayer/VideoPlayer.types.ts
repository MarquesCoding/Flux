import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { SequencedCommand } from '@FluxContracts/schemas/WatchParty';

type PartyPlayback = {
  command: SequencedCommand | null;
  referenceSeconds: number | null;
  jitterMs: number;
  onReport: (where: {
    positionSeconds: number;
    bufferedAheadSeconds: number;
    isWatching: boolean;
  }) => void;
  onCommand: (command: { kind: 'play' | 'pause' | 'seek'; atSeconds: number }) => void;
};

type VideoPlayerProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'>;
  isImmersive?: boolean;
  startSeconds?: number;
  onClose: () => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  episodes?: MediaSummary[];
  onSelectEpisode?: (episode: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  party?: PartyPlayback;
};

type PlayerState = 'starting' | 'playing' | 'failed';

export type { PartyPlayback, PlayerState, VideoPlayerProps };
