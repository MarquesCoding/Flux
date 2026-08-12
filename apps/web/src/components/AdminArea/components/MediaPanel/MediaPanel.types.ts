import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaPanelProps = {
  isUnreachable?: boolean;
  /**
   * One entry per programme and per film, rather than one per file.
   */
  media: MediaSummary[];
  /**
   * Asked to open the correction dialog for an item.
   */
  onCorrect: (media: MediaSummary) => void;
};

export type { MediaPanelProps };
