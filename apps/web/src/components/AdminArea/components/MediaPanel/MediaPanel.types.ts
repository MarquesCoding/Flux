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
  /**
   * Asked to throw away an item's previews so they are made again.
   *
   * For the case where one clip is visibly wrong. Everything else Flux offers is
   * wholesale — a reset rebuilds a library — and none of it is a sensible answer
   * to a single bad preview.
   */
  onRebuildArtefacts: (media: MediaSummary) => Promise<boolean>;
};

export type { MediaPanelProps };
