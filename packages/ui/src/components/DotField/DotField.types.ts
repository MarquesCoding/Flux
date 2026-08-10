type DotFieldProps = {
  /**
   * How far apart the dots sit, in pixels.
   *
   * Also decides how many there are: a field is drawn as one element per dot,
   * so this is the difference between a fine grid of ten thousand nodes and a
   * coarse one of a thousand.
   */
  spacing?: number
  /**
   * How many places ripples come from.
   *
   * Each is chosen at random and keeps rippling from there. Two reads as
   * weather; six reads as a screensaver.
   */
  sources?: number
  /**
   * How long one ripple takes to cross the field.
   */
  seconds?: number
  className?: string
}

export type { DotFieldProps }
