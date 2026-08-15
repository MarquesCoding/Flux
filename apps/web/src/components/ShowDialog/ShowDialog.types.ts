import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowSummary } from '@FluxContracts/schemas/Show';

type ShowDialogProps = {
  show: ShowSummary | null;
  onClose: () => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect?: (media: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  isFinished?: (mediaId: string) => boolean;
};

export type { ShowDialogProps };
