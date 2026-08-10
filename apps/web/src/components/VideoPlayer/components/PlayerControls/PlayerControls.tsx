import {
  IconAdjustmentsHorizontal,
  IconMaximize,
  IconMinimize,
  IconPlayerPause,
  IconPlayerPlay,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import SliderModule from '@FluxUI/Slider'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import type { PlayerControlsProps } from './PlayerControls.types'

const { IconButton } = IconButtonModule
const { Slider } = SliderModule
const { formatDuration } = formatDurationModule

/**
 * The bar that sits over the bottom of the video.
 *
 * Every control here is stateless: it reports what was pressed and draws what
 * it is told. Playback state belongs to the player, which owns the media
 * element the state actually lives in.
 */
const PlayerControls = ({
  title,
  isPlaying,
  position,
  duration,
  volume,
  isMuted,
  isFullscreen,
  isShowingStats,
  isDisabled = false,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleStats,
  renderPreview,
}: PlayerControlsProps) => (
  <div className="flex items-center gap-3 rounded-xl bg-black/45 px-3 py-2 text-white backdrop-blur-md">
    <IconButton
      label={isPlaying ? 'Pause' : 'Play'}
      onClick={onTogglePlay}
      disabled={isDisabled}
      size="md"
    >
      {isPlaying ? (
        <IconPlayerPause size={22} fill="currentColor" aria-hidden />
      ) : (
        <IconPlayerPlay size={22} fill="currentColor" aria-hidden />
      )}
    </IconButton>

    <Slider
      label={`Seek through ${title}`}
      value={position}
      max={duration}
      onValueChange={onSeek}
      tone="overlay"
      className="min-w-0 flex-1"
      {...(renderPreview === undefined ? {} : { renderPreview })}
    />

    <span className="shrink-0 text-sm tabular-nums">
      {formatDuration(position)} <span className="text-white/60">/ {formatDuration(duration)}</span>
    </span>

    <div className="group/volume flex items-center gap-1">
      <IconButton label={isMuted ? 'Unmute' : 'Mute'} onClick={onToggleMute} size="md">
        {isMuted || volume === 0 ? (
          <IconVolumeOff size={20} aria-hidden />
        ) : (
          <IconVolume size={20} aria-hidden />
        )}
      </IconButton>

      <Slider
        label="Volume"
        value={isMuted ? 0 : Math.round(volume * 100)}
        max={100}
        tone="overlay"
        onValueChange={(next) => {
          onVolumeChange(next / 100)
        }}
        className="w-0 overflow-hidden transition-all group-hover/volume:w-20 group-focus-within/volume:w-20"
      />
    </div>

    <IconButton label="Stats for nerds" isActive={isShowingStats} onClick={onToggleStats} size="md">
      <IconAdjustmentsHorizontal size={20} aria-hidden />
    </IconButton>

    <IconButton
      label={isFullscreen ? 'Exit full screen' : 'Full screen'}
      onClick={onToggleFullscreen}
      size="md"
    >
      {isFullscreen ? (
        <IconMinimize size={20} aria-hidden />
      ) : (
        <IconMaximize size={20} aria-hidden />
      )}
    </IconButton>
  </div>
)

PlayerControls.displayName = 'PlayerControls'

export default { PlayerControls }
