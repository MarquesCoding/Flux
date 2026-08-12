import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaDetailDialogProps = {
  /**
   * Whether this viewer may correct what a file is. Only an administrator can,
   * because a correction is global: a wrong title is wrong for everybody.
   */
  canCorrect?: boolean;
  media: MediaSummary | null;
  onClose: () => void;
  /**
   * Called with where to start, which is the end of what they already watched
   * when resuming and the beginning when starting again.
   */
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  /**
   * How far into this item the viewer already is, when that is worth offering.
   */
  resumeSeconds?: number;
  /**
   * How far through each item this viewer is, for the episodes listed below.
   */
  watchedFractionFor?: (mediaId: string) => number | undefined;
  /**
   * Other episodes of the same season, when this item is one.
   */
  siblings?: MediaSummary[];
  onSelectSibling?: (media: MediaSummary) => void;
  /**
   * Whether this viewer has kept it, and how they say otherwise.
   */
  /**
   * Where this was opened from, when it was opened from something.
   *
   * An episode reached from its programme should lead back to it: closing
   * would drop somebody onto the shelf they came through two steps ago.
   */
  onBack?: () => void;
  backLabel?: string;
  isKept?: boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

export type { MediaDetailDialogProps };
