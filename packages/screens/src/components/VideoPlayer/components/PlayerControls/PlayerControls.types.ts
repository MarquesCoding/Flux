import type { CastState } from '@ValenceScreens/playback/castPlayback.types';
import type { ReactNode } from 'react';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { CaptionStyle } from '@ValenceScreens/playback/captionStyle';
import type { SubtitleTrack } from '@ValenceClient/playback/fetchSubtitles';
import type { QualityPreference } from '@ValenceClient/playback/qualityPreference';
import type { QualityStepId } from '@ValenceContracts/schemas/QualityStep';

type AudioTrack = {
  index: number;
  label: string;
};

const SKIP_SECONDS = 10;

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const BOOST_STEPS = [1, 1.5, 2, 3] as const;

type PlayerControlsProps = {
  title: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  boost: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isShowingStats: boolean;
  playbackRate: number;
  subtitleTracks: SubtitleTrack[];
  selectedSubtitleId: string;
  audioTracks: AudioTrack[];
  selectedAudioIndex: number | null;
  availableQualitySteps: QualityStepId[];
  qualityStepCosts?: Partial<Record<QualityPreference, string>>;
  selectedQuality: QualityPreference;
  isDisabled?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (seconds: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onSubtitleChange: (trackId: string) => void;
  onAudioChange: (streamIndex: number) => void;
  onQualityChange: (quality: QualityPreference) => void;
  episodes?: MediaSummary[];
  playingId: string;
  onSelectEpisode?: (episode: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  onMenuOpenChange?: (isOpen: boolean) => void;
  isShowingRemaining: boolean;
  onToggleTimeDisplay: () => void;
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (style: CaptionStyle) => void;
  onCaptionStyleReset: () => void;
  onVolumeChange: (volume: number) => void;
  onBoostChange: (boost: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleStats: () => void;
  subtitleOffsetSeconds?: number;
  onSubtitleOffsetChange?: (seconds: number) => void;
  castState?: CastState;
  onCast?: () => void;
  onPopOut?: () => void;
  isPoppedOut?: boolean;
  renderPreview?: (seconds: number) => ReactNode;
  partyMenu?: ReactNode;
};

export type { PlayerControlsProps };

export { SKIP_SECONDS, PLAYBACK_RATES, BOOST_STEPS };
