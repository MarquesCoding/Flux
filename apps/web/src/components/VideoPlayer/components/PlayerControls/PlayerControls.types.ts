import type { ReactNode } from 'react'
import type { SubtitleTrack } from '@FluxWeb/playback/fetchSubtitles'
import type { QualityPreference } from '@FluxWeb/playback/qualityPreference'
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep'

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
  availableQualitySteps: QualityStepId[]
  selectedQuality: QualityPreference
  isDisabled?: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onSkip: (seconds: number) => void
  onPlaybackRateChange: (rate: number) => void
  onSubtitleChange: (trackId: string) => void
  onAudioChange: (streamIndex: number) => void
  onQualityChange: (quality: QualityPreference) => void
  onEditCaptions: () => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onToggleStats: () => void
  /**
   * How far the subtitles have been nudged, in seconds.
   *
   * Positive means later. A file's cues are often a second or two out from
   * the release they were written for, and no amount of care at import time
   * fixes a mismatch that only exists between two particular files.
   */
  subtitleOffsetSeconds?: number
  onSubtitleOffsetChange?: (seconds: number) => void
  /**
   * Pops the video into the browser's own floating window.
   *
   * Absent where the browser has no such window, so the control is not shown
   * at all rather than shown and inert.
   */
  onPopOut?: () => void
  renderPreview?: (seconds: number) => ReactNode
}

export type { AudioTrack, PlayerControlsProps }

export default { SKIP_SECONDS, PLAYBACK_RATES }
