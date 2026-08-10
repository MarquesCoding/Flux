type MediaPreviewProps = {
  mediaId: string
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
