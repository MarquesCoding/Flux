import type { RefObject } from 'react';

type TextTrack = {
  id: string;
  label: string;
  language: string;
  src: string;
};

type VideoSurfaceProps = {
  label: string;
  src?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  poster?: string;
  className?: string;
  textTrack?: TextTrack;
  isDrawnElsewhere?: boolean;
  onTimeUpdate?: (currentSeconds: number) => void;
  onDurationChange?: (durationSeconds: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onBufferingChange?: (isBuffering: boolean) => void;
  onEnded?: () => void;
  loops?: boolean;
};

export type { VideoSurfaceProps };
