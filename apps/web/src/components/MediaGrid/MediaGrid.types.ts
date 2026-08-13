import type { MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * How large the cards are, which is really how many of them fit across.
 *
 * Not a number of columns, because the right number of columns depends on how
 * wide the window is and a viewer picking "four" on a laptop would get four on
 * a phone as well. Naming the size instead lets each width answer for itself.
 */
type MediaGridSize = 'small' | 'medium' | 'large';

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
  size?: MediaGridSize;
};

export type { MediaGridProps, MediaGridSize };
