import type { ReactNode } from 'react';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { SequencedCommand } from '@FluxContracts/schemas/WatchParty';

type PartyPlayback = {
  id: string;
  command: SequencedCommand | null;
  meConnectionId: string | null;
  referenceSeconds: number | null;
  jitterMs: number;
  isPlaying: boolean;
  isHeld: boolean;
  waitingFor: readonly string[];
  members: number;
  onReport: (where: {
    positionSeconds: number;
    bufferedAheadSeconds: number;
    isWatching: boolean;
    isReady: boolean;
  }) => void;
  onCommand: (command: { kind: 'play' | 'pause' | 'seek'; atSeconds: number }) => void;
};

type VideoPlayerProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'> &
    Partial<Pick<MediaSummary, 'seriesTitle' | 'seasonNumber' | 'episodeNumber' | 'hasPoster'>>;
  isImmersive?: boolean;
  startSeconds?: number;
  onClose: () => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  episodes?: MediaSummary[];
  onSelectEpisode?: (episode: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  party?: PartyPlayback;
  partyNotice?: string | null;
  renderPartyMenu?: (options: {
    isHidden: boolean;
    onOpenChange: (isOpen: boolean) => void;
  }) => ReactNode;
};

type PlayerState = 'starting' | 'playing' | 'failed';

export type { PartyPlayback, PlayerState, VideoPlayerProps };
