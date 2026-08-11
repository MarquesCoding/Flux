import type { MediaSummary } from '@FluxContracts/schemas/Library'

type VideoPlayerProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'>
  /**
   * Whether the player owns the whole screen.
   *
   * An immersive player fills what it is given and lets the video decide its
   * own height, rather than sitting in a page's flow beneath a heading.
   */
  isImmersive?: boolean
  /**
   * Where to begin, in seconds.
   *
   * Somebody resuming a film has already watched the first hour of it, and a
   * player that starts at zero regardless is a player that loses their place
   * every time they close it.
   */
  startSeconds?: number
  onClose: () => void
}

type PlayerState = 'starting' | 'playing' | 'failed'

export type { PlayerState, VideoPlayerProps }
