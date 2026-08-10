import type { MediaSummary } from '@FluxContracts/schemas/Library'

type RailCardProps = {
  media: MediaSummary
  subtitle: string
  /**
   * How far through this item the viewer is, if they have started it.
   */
  watchedFraction?: number
  onPlay: (media: MediaSummary) => void
  onInspect: (media: MediaSummary) => void
  /**
   * How long a pointer must rest on the card before it opens.
   *
   * Long enough that moving across a row does not set off every card on the
   * way past.
   */
  hoverDelayMilliseconds?: number
}

export type { RailCardProps }
