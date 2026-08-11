import type { MediaSummary } from '@FluxContracts/schemas/Library'

type RailCardProps = {
  media: MediaSummary
  /**
   * How far through this item the viewer is, if they have started it.
   */
  watchedFraction?: number
  onPlay: (media: MediaSummary, startSeconds: number) => void
  onInspect: (media: MediaSummary) => void
  /**
   * Where this viewer left it, when that is worth offering.
   */
  resumeSeconds?: number
  /**
   * How long a pointer must rest on the card before it opens.
   *
   * Long enough that moving across a row does not set off every card on the
   * way past.
   */
  hoverDelayMilliseconds?: number
  /**
   * Whether this viewer has kept this item.
   *
   * Left out where there is nobody to keep it for — a card drawn in a test or
   * a preview — and the heart is not drawn at all.
   */
  isKept?: boolean
  onToggleKept?: (media: MediaSummary) => void
}

export type { RailCardProps }
