import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type MatchPickerProps = {
  media: MediaSummary | null;
  onClose: () => void;
  onCorrected: (jobId: string | null) => void;
};

export type { MatchPickerProps };
