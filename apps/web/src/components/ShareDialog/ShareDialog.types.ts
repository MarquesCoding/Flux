import type { MediaSummary } from '@FluxContracts/schemas/Library';

type ShareDialogProps = {
  media: MediaSummary | null;
  isOpen: boolean;
  onClose: () => void;
  origin?: string;
};

export type { ShareDialogProps };
