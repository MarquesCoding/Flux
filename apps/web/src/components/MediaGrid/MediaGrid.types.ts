import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaGridProps = {
  items: MediaSummary[];
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  /**
   * How far through each item this viewer is, where they have started it.
   */
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  /**
   * Whether this viewer has kept each item, and how they say otherwise.
   */
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

export type { MediaGridProps };
