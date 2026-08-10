import type { ReactNode } from 'react'

type PlayerControlsProps = {
  title: string
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  isShowingStats: boolean
  isDisabled?: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onToggleStats: () => void
  renderPreview?: (seconds: number) => ReactNode
}

export type { PlayerControlsProps }
