/**
 * One light on the page, and where it comes from.
 *
 * The place is part of the colour. Light off a screen showing a red coat on
 * the left falls on the left, and a wash that ignores that reads as a tint
 * somebody chose rather than as spill from the picture.
 */
type MoodLight = {
  color: string
  at?: string
}

type MoodBackgroundProps = {
  /**
   * Whether the wash carries its grid of dots.
   *
   * Home only. Everywhere else is mostly words and figures, which read better
   * on something plain.
   */
  hasGrid?: boolean
  /**
   * Whether the light drifts rather than sitting still.
   *
   * For screens somebody is waiting on — signing in, choosing who they are —
   * where a painted background reads as a page that has stopped.
   */
  isDrifting?: boolean
  /**
   * The lights the page is under.
   *
   * Read out of whatever is on screen, corner by corner, rather than chosen in
   * advance. An empty list means the page keeps its own light, so a library
   * with no artwork still looks deliberate rather than unfinished.
   */
  lights?: MoodLight[]
}

export type { MoodBackgroundProps, MoodLight }
