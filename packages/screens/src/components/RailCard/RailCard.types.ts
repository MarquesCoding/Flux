import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type RailCardProps = {
  media: MediaSummary;
  watchedFraction?: number;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  resumeSeconds?: number;
  hoverDelayMilliseconds?: number;
  onOpenShow?: (media: MediaSummary) => void;
  isKept?: boolean;
  onToggleKept?: (media: MediaSummary) => void;
  isSeries?: boolean;
};

export type { RailCardProps };
