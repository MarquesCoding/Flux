import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { RailCardProps } from '@ValenceScreens/components/RailCard/RailCard.types';

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
  isSeries?: boolean;
  onOpenShow?: (media: MediaSummary) => void;
  shape?: RailCardProps['shape'];
};

export type { MediaGridProps, MediaGridSize };
