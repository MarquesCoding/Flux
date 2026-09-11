import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { ComponentProps } from 'react';
import type { MediaCard } from '@ValenceUI/MediaCard';

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
  shape?: ComponentProps<typeof MediaCard>['shape'];
};

export type { RailCardProps };
