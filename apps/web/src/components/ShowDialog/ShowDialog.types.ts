import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowSummary } from '@FluxContracts/schemas/Show';

type ShowDialogProps = {
  /**
   * The series being read about, or nothing when the dialog is closed.
   *
   * A summary rather than the whole thing: the page knows this much from the
   * shelf it was opened from, and the episodes are fetched here.
   */
  show: ShowSummary | null;
  onClose: () => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  /**
   * Opens the page about one episode, for somebody who wants to read about it
   * rather than watch it.
   */
  onInspect?: (media: MediaSummary) => void;
  /**
   * How far through each episode this viewer is, where they left it, and
   * whether they finished it.
   */
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  isFinished?: (mediaId: string) => boolean;
};

export type { ShowDialogProps };
