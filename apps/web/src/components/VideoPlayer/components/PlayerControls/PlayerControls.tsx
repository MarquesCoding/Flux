import {
  IconAdjustmentsHorizontal,
  IconBadgeCc,
  IconChartDots,
  IconClock,
  IconGauge,
  IconHeadphones,
  IconSettings,
  IconTypography,
  IconMaximize,
  IconMinus,
  IconPictureInPicture,
  IconMinimize,
  IconPlus,
  IconRefresh,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotate,
  IconRotateClockwise,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import SliderModule from '@FluxUI/Slider'
import SettingsMenuModule from '@FluxUI/SettingsMenu'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchSubtitlesModule from '@FluxWeb/playback/fetchSubtitles'
import QualityStepModule from '@FluxContracts/schemas/QualityStep'
import CaptionSettingsModule from '@FluxWeb/components/VideoPlayer/components/CaptionSettings/CaptionSettings'
import EpisodeMenuModule from '@FluxWeb/components/VideoPlayer/components/EpisodeMenu/EpisodeMenu'
import PlayerControlsTypes from './PlayerControls.types'
import type { PlayerControlsProps } from './PlayerControls.types'

const { IconButton } = IconButtonModule
const { Slider } = SliderModule
const { SettingsMenu } = SettingsMenuModule
const { CaptionSettings } = CaptionSettingsModule
const { EpisodeMenu } = EpisodeMenuModule
const { formatDuration } = formatDurationModule
const { SKIP_SECONDS, PLAYBACK_RATES } = PlayerControlsTypes
const { SUBTITLES_OFF } = fetchSubtitlesModule
const { QUALITY_STEPS } = QualityStepModule

/**
 * Formats a rate the way a viewer reads it, not the way a float prints.
 */
const rateLabel = (rate: number): string => `${rate.toString()}x`

/**
 * Formats a step's bitrate for the menu, the way a viewer judges it rather
 * than the way the ladder stores it.
 */
const bitrateDetail = (maxVideoBitrateKbps: number): string =>
  maxVideoBitrateKbps >= 1000
    ? `${(maxVideoBitrateKbps / 1000).toFixed(1)} Mbps`
    : `${maxVideoBitrateKbps.toString()} kbps`

/**
 * How far one press moves the subtitles.
 *
 * A quarter of a second is about the smallest gap anybody can see, and small
 * enough that overshooting costs one press back.
 */
const SUBTITLE_STEP_SECONDS = 0.25

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
  availableQualitySteps,
  selectedQuality,
  isDisabled = false,
  onTogglePlay,
  onSeek,
  onSkip,
  onPlaybackRateChange,
  onSubtitleChange,
  onAudioChange,
  onQualityChange,
  playingId,
  episodes = [],
  onSelectEpisode,
  watchedFractionFor,
  onMenuOpenChange,
  isShowingRemaining,
  onToggleTimeDisplay,
  captionStyle,
  onCaptionStyleChange,
  onCaptionStyleReset,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onPopOut,
  onToggleStats,
  subtitleOffsetSeconds = 0,
  onSubtitleOffsetChange,
  renderPreview,
}: PlayerControlsProps) => (
  <div className="flux-glass flex flex-col gap-1 rounded-2xl px-3 py-2 text-white sm:px-4">
    {/* The scrub bar gets a line of its own on every size. Squeezing it in
        beside ten controls leaves a phone with a bar too short to aim at. */}
    <div className="flex items-center gap-3">
      <Slider
        label={`Seek through ${title}`}
        value={position}
        max={duration}
        onValueChange={onSeek}
        tone="overlay"
        className="min-w-0 flex-1"
        {...(renderPreview === undefined ? {} : { renderPreview })}
      />

      {/* The clock is a control. Everybody wants one of two numbers from it —
          how far in they are, or how much is left — and which one depends on
          whether they are enjoying it or deciding whether there is time. */}
      <button
        type="button"
        aria-label={isShowingRemaining ? 'Show the time played' : 'Show the time remaining'}
        onClick={onToggleTimeDisplay}
        className="shrink-0 rounded-md px-1 text-xs tabular-nums transition-colors hover:bg-white/10 sm:text-sm"
      >
        {isShowingRemaining
          ? `-${formatDuration(Math.max(duration - position, 0))}`
          : formatDuration(position)}{' '}
        <span className="text-white/50">/ {formatDuration(duration)}</span>
      </button>
    </div>

    <div className="flex items-center gap-1 sm:gap-2">
      <IconButton
        label={`Back ${SKIP_SECONDS.toString()} seconds`}
        onClick={() => {
          onSkip(-SKIP_SECONDS)
        }}
        disabled={isDisabled}
        size="md"
      >
        {/* Mirrored: the arrow has to curl back the way the film is going,
            and the icon as drawn points the other way. */}
        <IconRotateClockwise size={22} aria-hidden className="-scale-x-100" />
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
        <IconRotate size={22} aria-hidden className="-scale-x-100" />
      </IconButton>

      <span className="flex-1" />

      <div className="group/volume hidden items-center gap-1 sm:flex">
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
          // The clip is what lets it slide open, and it is also what cut the
          // handle in half at either end: the handle is centred on the track,
          // so half of it sits outside. The padding gives that half back — but
          // only once open, since padding on a closed control is a sliver of
          // handle sitting next to the speaker.
          className="w-0 overflow-hidden px-0 transition-all group-hover/volume:w-24 group-hover/volume:px-2 group-focus-within/volume:w-24 group-focus-within/volume:px-2"
        />
      </div>

      {onSelectEpisode === undefined ? null : (
        <EpisodeMenu
          {...(onMenuOpenChange === undefined ? {} : { onOpenChange: onMenuOpenChange })}
          episodes={episodes}
          playingId={playingId}
          onSelect={onSelectEpisode}
          isDisabled={isDisabled}
          {...(watchedFractionFor === undefined ? {} : { watchedFractionFor })}
        />
      )}

      {/* Subtitles keep a button of their own. Turning them on is the one
          setting somebody changes mid-sentence, and a panel to open first is
          a panel between them and the line they missed. */}
      {subtitleTracks.length === 0 ? null : (
        <IconButton
          label={selectedSubtitleId === SUBTITLES_OFF ? 'Turn subtitles on' : 'Turn subtitles off'}
          isActive={selectedSubtitleId !== SUBTITLES_OFF}
          onClick={() => {
            onSubtitleChange(
              selectedSubtitleId === SUBTITLES_OFF
                ? (subtitleTracks[0]?.id ?? SUBTITLES_OFF)
                : SUBTITLES_OFF,
            )
          }}
          disabled={isDisabled}
          size="md"
        >
          <IconBadgeCc size={22} aria-hidden />
        </IconButton>
      )}

      {/* Everything about what is playing, behind one control. A bar with a
          button per setting asks a viewer to learn a row of icons; a bar with
          one asks them to open it and read, which is what somebody changing a
          setting is doing anyway. */}
      <SettingsMenu
        label="Settings"
        {...(onMenuOpenChange === undefined ? {} : { onOpenChange: onMenuOpenChange })}
        isDisabled={isDisabled}
        trigger={<IconSettings size={20} aria-hidden />}
        rows={[
          ...(audioTracks.length < 2
            ? []
            : [
                {
                  kind: 'choice' as const,
                  id: 'audio',
                  label: 'Audio track',
                  icon: <IconHeadphones size={18} aria-hidden />,
                  selectedId: (selectedAudioIndex ?? audioTracks[0]?.index ?? 0).toString(),
                  onSelect: (id: string) => {
                    onAudioChange(Number(id))
                  },
                  choices: audioTracks.map((track) => ({
                    id: track.index.toString(),
                    label: track.label,
                  })),
                },
              ]),
          {
            kind: 'choice' as const,
            id: 'subtitles',
            label: 'Subtitles/CC',
            icon: <IconBadgeCc size={18} aria-hidden />,
            selectedId: selectedSubtitleId,
            onSelect: onSubtitleChange,
            choices: [
              { id: SUBTITLES_OFF, label: 'Off' },
              ...subtitleTracks.map((track) => ({
                id: track.id,
                label: track.label,
                ...(track.format === '' ? {} : { detail: track.format.toUpperCase() }),
              })),
            ],
          },
          ...(selectedSubtitleId === SUBTITLES_OFF || onSubtitleOffsetChange === undefined
            ? []
            : [
                {
                  kind: 'custom' as const,
                  id: 'timing',
                  label: 'Subtitle timing',
                  icon: <IconClock size={18} aria-hidden />,
                  detail:
                    subtitleOffsetSeconds === 0
                      ? 'In time'
                      : `${subtitleOffsetSeconds > 0 ? '+' : ''}${subtitleOffsetSeconds.toFixed(2)}s`,
                  control: (
                    <span className="flex items-center gap-1">
                      <IconButton
                        label="Subtitles earlier"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(subtitleOffsetSeconds - SUBTITLE_STEP_SECONDS)
                        }}
                      >
                        <IconMinus size={16} aria-hidden />
                      </IconButton>

                      <IconButton
                        label="Subtitles in time"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(0)
                        }}
                      >
                        <IconRefresh size={16} aria-hidden />
                      </IconButton>

                      <IconButton
                        label="Subtitles later"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(subtitleOffsetSeconds + SUBTITLE_STEP_SECONDS)
                        }}
                      >
                        <IconPlus size={16} aria-hidden />
                      </IconButton>
                    </span>
                  ),
                },
              ]),
          {
            kind: 'panel' as const,
            id: 'appearance',
            label: 'Caption settings',
            icon: <IconTypography size={18} aria-hidden />,
            content: (
              <CaptionSettings
                style={captionStyle}
                onChange={onCaptionStyleChange}
                onReset={onCaptionStyleReset}
              />
            ),
          },
          {
            kind: 'choice' as const,
            id: 'speed',
            label: 'Playback speed',
            icon: <IconGauge size={18} aria-hidden />,
            selectedId: playbackRate.toString(),
            onSelect: (id: string) => {
              onPlaybackRateChange(Number(id))
            },
            choices: PLAYBACK_RATES.map((rate) => ({
              id: rate.toString(),
              label: rate === 1 ? 'Normal' : rateLabel(rate),
            })),
          },
          ...(availableQualitySteps.length === 0
            ? []
            : [
                {
                  kind: 'choice' as const,
                  id: 'quality',
                  label: 'Quality',
                  icon: <IconAdjustmentsHorizontal size={18} aria-hidden />,
                  selectedId: selectedQuality,
                  onSelect: (id: string) => {
                    onQualityChange(availableQualitySteps.find((step) => step === id) ?? 'original')
                  },
                  choices: [
                    { id: 'original', label: 'Original' },
                    ...availableQualitySteps.map((id) => {
                      const step = QUALITY_STEPS.find((entry) => entry.id === id)

                      return {
                        id,
                        label: step?.label ?? id,
                        ...(step === undefined
                          ? {}
                          : { detail: bitrateDetail(step.maxVideoBitrateKbps) }),
                      }
                    }),
                  ],
                },
              ]),
          {
            kind: 'toggle' as const,
            id: 'stats',
            label: 'Stats for nerds',
            icon: <IconChartDots size={18} aria-hidden />,
            isOn: isShowingStats,
            onToggle: onToggleStats,
          },
        ]}
      />

      {onPopOut === undefined ? null : (
        <IconButton label="Pop out" onClick={onPopOut} size="md">
          <IconPictureInPicture size={20} aria-hidden />
        </IconButton>
      )}

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
  </div>
)

PlayerControls.displayName = 'PlayerControls'

export default { PlayerControls }
