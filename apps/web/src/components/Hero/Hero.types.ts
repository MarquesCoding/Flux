import type { MediaSummary } from '@FluxContracts/schemas/Library'

type HeroProps = {
  /**
   * The items worth featuring, most interesting first.
   */
  items: MediaSummary[]
  onPlay: (media: MediaSummary, startSeconds: number) => void
  /**
   * How far into each item this viewer already is.
   *
   * Decides whether the button offers to start something or to carry on with
   * it, which is the only question a hero's one button has to answer.
   */
  resumeFor?: (mediaId: string) => number | null
  /**
   * Told which item is showing, so the page can be lit by its colour.
   */
  onFeatureChange?: (media: MediaSummary) => void
  /**
   * How long each item holds the screen. Zero holds the first one forever,
   * which is what a single featured item should do.
   */
  rotateAfterMilliseconds?: number
}

export type { HeroProps }
