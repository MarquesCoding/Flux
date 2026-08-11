import type { MediaSummary } from '@FluxContracts/schemas/Library'

type MediaDetailDialogProps = {
  media: MediaSummary | null
  onClose: () => void
  /**
   * Called with where to start, which is the end of what they already watched
   * when resuming and the beginning when starting again.
   */
  onPlay: (media: MediaSummary, startSeconds: number) => void
  /**
   * How far into this item the viewer already is, when that is worth offering.
   */
  resumeSeconds?: number
  /**
   * How far through each item this viewer is, for the episodes listed below.
   */
  watchedFractionFor?: (mediaId: string) => number | undefined
  /**
   * Other episodes of the same season, when this item is one.
   */
  siblings?: MediaSummary[]
  onSelectSibling?: (media: MediaSummary) => void
  /**
   * Whether this viewer has kept it, and how they say otherwise.
   */
  isKept?: boolean
  onToggleKept?: (media: MediaSummary) => void
}

export type { MediaDetailDialogProps }
