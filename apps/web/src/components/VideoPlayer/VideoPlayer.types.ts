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
  onClose: () => void
}

type PlayerState = 'starting' | 'playing' | 'failed'

export type { PlayerState, VideoPlayerProps }
