import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type ShareSubject =
  { kind: 'item'; media: MediaSummary } | { kind: 'series'; seriesId: string; title: string };

type ShareDialogProps = {
  subject: ShareSubject | null;
  isOpen: boolean;
  onClose: () => void;
  origin?: string;
};

export type { ShareDialogProps, ShareSubject };
