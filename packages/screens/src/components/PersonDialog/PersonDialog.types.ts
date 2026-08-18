import type { MediaSummary } from '@FluxContracts/schemas/Library';

type PersonDialogProps = {
  personId: number | null;
  role?: string | null;
  onClose: () => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  onOpenShow?: (media: MediaSummary) => void;
};

export type { PersonDialogProps };
