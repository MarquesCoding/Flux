import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaGridSize = 'small' | 'medium' | 'large';

type MediaGridProps = {
  items: MediaSummary[];
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
  size?: MediaGridSize;
};

export type { MediaGridProps, MediaGridSize };
