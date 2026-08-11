import type { RefObject } from 'react'

/**
 * A subtitle track the browser renders itself.
 *
 * Given as a URL rather than as cues, because a native text track is the only
 * way captions honour a viewer's own styling and stay in sync through a seek
 * without anything having to drive them.
 */
type TextTrack = {
  id: string
  label: string
  language: string
  src: string
}

type VideoSurfaceProps = {
  label: string
  videoRef: RefObject<HTMLVideoElement | null>
  poster?: string
  className?: string
  /**
   * The track to show, if any. Only one is rendered at a time: a browser will
   * happily display two at once, on top of each other.
   */
  textTrack?: TextTrack
  onTimeUpdate?: (currentSeconds: number) => void
  onDurationChange?: (durationSeconds: number) => void
  onPlayingChange?: (isPlaying: boolean) => void
  /**
   * Called when the media reaches its end.
   */
  onEnded?: () => void
  /**
   * Whether the media starts again when it reaches the end.
   */
  loops?: boolean
}

export type { TextTrack, VideoSurfaceProps }
