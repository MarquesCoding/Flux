import type { Ref } from 'react'

type VideoSurfaceProps = {
  label: string
  videoRef: Ref<HTMLVideoElement>
  poster?: string
  className?: string
  onTimeUpdate?: (currentSeconds: number) => void
  onDurationChange?: (durationSeconds: number) => void
  onPlayingChange?: (isPlaying: boolean) => void
}

export type { VideoSurfaceProps }
