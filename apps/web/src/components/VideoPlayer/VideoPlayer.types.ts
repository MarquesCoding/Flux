import type { MediaSummary } from '@FluxContracts/schemas/Library'

type VideoPlayerProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'>
  onClose: () => void
}

type PlayerState = 'starting' | 'playing' | 'failed'

export type { PlayerState, VideoPlayerProps }
