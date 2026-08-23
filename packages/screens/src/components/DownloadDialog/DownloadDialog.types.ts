import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type DownloadDialogProps = {
  media: MediaSummary | null;
  onClose: () => void;
};

export type { DownloadDialogProps };
