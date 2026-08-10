type MoodBackgroundProps = {
  /**
   * Whether the wash carries its grid of dots.
   *
   * Home only. Everywhere else is mostly words and figures, which read better
   * on something plain.
   */
  hasGrid?: boolean
  /**
   * The colour the page takes its light from, as any CSS colour.
   *
   * Left out means the accent, so a library with no artwork still looks
   * deliberate rather than unfinished.
   */
  color?: string | null
}

export type { MoodBackgroundProps }
