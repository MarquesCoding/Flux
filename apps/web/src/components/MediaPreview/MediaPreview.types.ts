import type { ReactNode } from 'react';
import type { MoodLight } from '@FluxUI/MoodBackground.types';
type PreviewAbsence = 'pending' | 'absent' | null;

type MediaPreviewProps = {
  mediaId: string;
  fills?: boolean;
  settleMilliseconds?: number;
  backdropUrl: string | null;
  startFraction?: number;
  durationSeconds: number;
  hasSound?: boolean;
  hasSubtitles?: boolean;
  repeats?: boolean;
  onEnded?: () => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onPalette?: (lights: MoodLight[]) => void;
  actions?: ReactNode;
};

export type { MediaPreviewProps, PreviewAbsence };
