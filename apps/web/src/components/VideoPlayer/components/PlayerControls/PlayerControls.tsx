import {
  IconAdjustmentsHorizontal,
  IconBadgeCc,
  IconMaximize,
  IconMinimize,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotate,
  IconRotateClockwise,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import SliderModule from '@FluxUI/Slider'
import OptionMenuModule from '@FluxUI/OptionMenu'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchSubtitlesModule from '@FluxWeb/playback/fetchSubtitles'
import PlayerControlsTypes from './PlayerControls.types'
import type { PlayerControlsProps } from './PlayerControls.types'

const { IconButton } = IconButtonModule
const { Slider } = SliderModule
const { OptionMenu } = OptionMenuModule
const { formatDuration } = formatDurationModule
const { SKIP_SECONDS, PLAYBACK_RATES } = PlayerControlsTypes
const { SUBTITLES_OFF } = fetchSubtitlesModule

/**
 * Formats a rate the way a viewer reads it, not the way a float prints.
 */
const rateLabel = (rate: number): string => `${rate.toString()}x`

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
  playbackRate,
  subtitleTracks,
  selectedSubtitleId,
  audioTracks,
  selectedAudioIndex,
  isDisabled = false,
  onTogglePlay,
  onSeek,
  onSkip,
  onPlaybackRateChange,
  onSubtitleChange,
  onAudioChange,
  onEditCaptions,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleStats,
  renderPreview,
}: PlayerControlsProps) => (
  <div className="flex items-center gap-3 rounded-xl bg-black/45 px-3 py-2 text-white backdrop-blur-md">
    <IconButton
      label={`Back ${SKIP_SECONDS.toString()} seconds`}
      onClick={() => {
        onSkip(-SKIP_SECONDS)
      }}
      disabled={isDisabled}
      size="md"
    >
      <IconRotate size={22} aria-hidden />
    </IconButton>

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

    <IconButton
      label={`Forward ${SKIP_SECONDS.toString()} seconds`}
      onClick={() => {
        onSkip(SKIP_SECONDS)
      }}
      disabled={isDisabled}
      size="md"
    >
      <IconRotateClockwise size={22} aria-hidden />
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

    <OptionMenu
      label="Subtitles"
      isDisabled={false}
      trigger={
        <IconBadgeCc
          size={22}
          className={selectedSubtitleId === SUBTITLES_OFF ? 'opacity-60' : ''}
          aria-hidden
        />
      }
      groups={[
        ...(audioTracks.length < 2
          ? []
          : [
              {
                name: 'Audio',
                selectedId: (selectedAudioIndex ?? audioTracks[0]?.index ?? 0).toString(),
                onSelect: (id: string) => {
                  onAudioChange(Number(id))
                },
                options: audioTracks.map((track) => ({
                  id: track.index.toString(),
                  label: track.label,
                })),
              },
            ]),
        {
          name: 'Subtitles/CC',
          selectedId: selectedSubtitleId,
          onSelect: onSubtitleChange,
          options: [
            { id: SUBTITLES_OFF, label: 'Off' },
            ...subtitleTracks.map((track) => ({
              id: track.id,
              label: track.label,
              ...(track.format === '' ? {} : { detail: track.format.toUpperCase() }),
            })),
          ],
        },
        {
          name: 'Appearance',
          selectedId: '',
          onSelect: onEditCaptions,
          options: [{ id: 'style', label: 'Caption settings…' }],
        },
      ]}
    />

    <OptionMenu
      label="Playback speed"
      trigger={<span className="text-sm font-medium">{rateLabel(playbackRate)}</span>}
      groups={[
        {
          name: 'Playback Speed',
          selectedId: playbackRate.toString(),
          onSelect: (id) => {
            onPlaybackRateChange(Number(id))
          },
          options: PLAYBACK_RATES.map((rate) => ({
            id: rate.toString(),
            label: rateLabel(rate),
          })),
        },
      ]}
    />

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
