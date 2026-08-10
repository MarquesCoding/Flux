type MediaPreviewProps = {
  mediaId: string
  /**
   * Whether to fill its container rather than keep a film's shape.
   *
   * A hero is whatever height the screen is; a dialog is a rectangle the shape
   * of a film.
   */
  fills?: boolean
  /**
   * How long to wait before starting anything.
   *
   * Opening something to read its runtime should not start a transcode.
   */
  settleMilliseconds?: number
  /**
   * Drawn until the preview is playing, and left in place if it never does.
   */
  backdropUrl: string | null
  /**
   * How far in to start, as a fraction of the runtime.
   */
  startFraction?: number
  durationSeconds: number
  /**
   * The colour to hold while nothing has been drawn yet.
   *
   * Black is what an empty video element is, and a black rectangle where a
   * picture is about to be reads as broken. A shade taken from the film reads
   * as the picture arriving.
   */
  tint?: string | null
  /**
   * Whether the preview offers to turn its sound on.
   *
   * It always starts silent — a page that begins talking on its own is a page
   * people learn to close, and browsers refuse to autoplay with sound anyway.
   * This only decides whether there is a way to ask for it.
   */
  hasSound?: boolean
  /**
   * Called when the clip has finished.
   *
   * A hero waits for this before moving on, so it changes item from a still
   * picture rather than cutting away mid-shot.
   */
  onEnded?: () => void
}

export type { MediaPreviewProps }
