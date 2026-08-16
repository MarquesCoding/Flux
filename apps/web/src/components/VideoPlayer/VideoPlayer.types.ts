import type { MediaSummary } from '@FluxContracts/schemas/Library';

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
};

type PlayerState = 'starting' | 'playing' | 'failed';

export type { PlayerState, VideoPlayerProps };
