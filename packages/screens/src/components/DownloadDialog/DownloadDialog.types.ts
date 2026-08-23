import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type DownloadSeries = {
  id: string;
  title: string;
  episodes: number;
};

type DownloadDialogProps = {
  media: MediaSummary | null;
  series?: DownloadSeries | null;
  onClose: () => void;
};

export type { DownloadDialogProps, DownloadSeries };
