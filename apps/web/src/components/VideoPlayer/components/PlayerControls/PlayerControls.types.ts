import type { ReactNode } from 'react'
import type { SubtitleTrack } from '@FluxWeb/playback/fetchSubtitles'

/**
 * An audio stream a viewer can choose between.
 */
type AudioTrack = {
  index: number
  label: string
}

/**
 * How far the skip buttons jump.
 *
 * Ten seconds is the convention every player has settled on: long enough to
 * clear a moment you missed, short enough to press twice without thinking.
 */
const SKIP_SECONDS = 10

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

type PlayerControlsProps = {
  title: string
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  isShowingStats: boolean
  playbackRate: number
  subtitleTracks: SubtitleTrack[]
  selectedSubtitleId: string
  audioTracks: AudioTrack[]
  selectedAudioIndex: number | null
  isDisabled?: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onSkip: (seconds: number) => void
  onPlaybackRateChange: (rate: number) => void
  onSubtitleChange: (trackId: string) => void
  onAudioChange: (streamIndex: number) => void
  onEditCaptions: () => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onToggleStats: () => void
  renderPreview?: (seconds: number) => ReactNode
}

export type { AudioTrack, PlayerControlsProps }

export default { SKIP_SECONDS, PLAYBACK_RATES }
