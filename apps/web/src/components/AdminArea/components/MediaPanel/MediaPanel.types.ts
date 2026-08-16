import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaPanelProps = {
  isUnreachable?: boolean;
  media: MediaSummary[];
  onCorrect: (media: MediaSummary) => void;
  onRebuildArtefacts: (media: MediaSummary) => Promise<boolean>;
};

export type { MediaPanelProps };
