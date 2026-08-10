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
}

export type { MediaPreviewProps }
