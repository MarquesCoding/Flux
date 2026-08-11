import type { MediaSummary } from '@FluxContracts/schemas/Library'

type EpisodeRowProps = {
  episode: MediaSummary
  onPlay: (media: MediaSummary, startSeconds: number) => void
  onInspect?: (media: MediaSummary) => void
  /**
   * How far through it this viewer is, where they have started it.
   */
  watchedFraction?: number
  resumeSeconds?: number
}

export type { EpisodeRowProps }
