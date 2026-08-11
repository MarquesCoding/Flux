import type { MediaSummary } from '@FluxContracts/schemas/Library'

type EpisodeMenuProps = {
  /**
   * The season, in broadcast order, including the one playing.
   *
   * Empty for anything that is not part of a series, which is what keeps the
   * button off a film.
   */
  episodes: MediaSummary[]
  /**
   * Which of them is on screen, so the list can say "you are here".
   */
  playingId: string
  onSelect: (episode: MediaSummary) => void
  /**
   * How far through each one this viewer is.
   */
  watchedFractionFor?: (mediaId: string) => number | undefined
  isDisabled?: boolean
}

export type { EpisodeMenuProps }
