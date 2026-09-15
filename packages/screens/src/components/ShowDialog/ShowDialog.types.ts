import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { ShowSummary } from '@ValenceContracts/schemas/Show';

type ShowDialogProps = {
  show: ShowSummary | null;
  onClose: () => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect?: (media: MediaSummary) => void;
  onShare?: (show: ShowSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  isFinished?: (mediaId: string) => boolean;
  onRate?: (show: ShowSummary, stars: number | null) => void;
};

export type { ShowDialogProps };
