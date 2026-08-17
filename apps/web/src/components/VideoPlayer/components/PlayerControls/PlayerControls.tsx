import {
  RiAddLine,
  RiAnticlockwiseLine,
  RiCastLine,
  RiClockwiseLine,
  RiClosedCaptioningFill,
  RiClosedCaptioningLine,
  RiEqualizerLine,
  RiFontSize,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiHeadphoneLine,
  RiPauseFill,
  RiPictureInPicture2Fill,
  RiPictureInPicture2Line,
  RiPlayFill,
  RiPulseLine,
  RiRefreshLine,
  RiSettings3Fill,
  RiSettings3Line,
  RiSpeedLine,
  RiSubtractLine,
  RiTimeLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Slider } from '@FluxUI/Slider';
import { SettingsMenu } from '@FluxUI/SettingsMenu';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { SUBTITLES_OFF } from '@FluxWeb/playback/fetchSubtitles';
import { QUALITY_STEPS } from '@FluxContracts/schemas/QualityStep';
import { CaptionSettings } from '@FluxWeb/components/VideoPlayer/components/CaptionSettings/CaptionSettings';
import { EpisodeMenu } from '@FluxWeb/components/VideoPlayer/components/EpisodeMenu/EpisodeMenu';
import { SKIP_SECONDS, PLAYBACK_RATES } from './PlayerControls.types';
import type { PlayerControlsProps } from './PlayerControls.types';

/**
 * Formats a playback rate the way a viewer reads it rather than the way a float prints, so the menu
 * offers "1.5x" and not "1.5000000000000002x".
 *
 * @param rate - The rate.
 * @returns What the menu shows.
 */
const rateLabel = (rate: number): string => `${rate.toString()}x`;

/**
 * Formats a quality step's bitrate for the menu in megabits, which is the unit a viewer judges a
 * connection in, rather than the kilobits the ladder stores.
 *
 * @param maxVideoBitrateKbps - The step's ceiling, as the ladder holds it.
 * @returns What the menu shows beside the step.
 */
const bitrateDetail = (maxVideoBitrateKbps: number): string =>
  maxVideoBitrateKbps >= 1000
    ? `${(maxVideoBitrateKbps / 1000).toFixed(1)} Mbps`
    : `${maxVideoBitrateKbps.toString()} kbps`;

const SUBTITLE_STEP_SECONDS = 0.25;

/**
 * The bar over the bottom of the video, and everything reachable from it: the scrubber and its
 * preview, play, skip and volume, and the menus for subtitles, audio, quality, speed, caption
 * appearance and the rest of the season. Holds no state about the viewing itself — every control
 * reports what was pressed and is told afterwards what happened, so that the player remains the one
 * place that knows what is going on.
 *
 * @param title - What is playing.
 * @param isPlaying - Whether it is playing at the moment.
 * @param position - Where the viewer is.
 * @param duration - How long it runs.
 * @param volume - How loud it is.
 * @param isMuted - Whether it is silenced.
 * @param isFullscreen - Whether the player fills the screen.
 * @param isShowingStats - Whether the statistics panel is open.
 * @param playbackRate - How fast it is playing.
 * @param subtitleTracks - The subtitle tracks available.
 * @param selectedSubtitleId - The subtitle track in use, if any.
 * @param audioTracks - The audio tracks available.
 * @param selectedAudioIndex - The audio track in use, if the player has settled on one.
 * @param availableQualitySteps - The rungs of the ladder this session offers.
 * @param selectedQuality - Whether quality is being chosen automatically or pinned to a rung.
 * @param isDisabled - Whether the controls are inert, as they are while a session is starting.
 * @param onTogglePlay - Called to play or pause.
 * @param onSeek - Called with where the viewer scrubbed to.
 * @param onSkip - Called with how far to jump, forwards or back.
 * @param onPlaybackRateChange - Called with the speed they chose.
 * @param onSubtitleChange - Called with the subtitle track they chose.
 * @param onAudioChange - Called with the audio track they chose.
 * @param onQualityChange - Called with the quality they chose.
 * @param episodes - The rest of the season, where there is one.
 * @param playingId - Which of those episodes is on now.
 * @param onSelectEpisode - Called with an episode they chose to play instead.
 * @param watchedFractionFor - How to ask how far through a given episode they are.
 * @param onMenuOpenChange - Called as a menu opens or closes, so the bar is not hidden beneath one.
 * @param isShowingRemaining - Whether the clock counts down to the end or up from the start.
 * @param onToggleTimeDisplay - Called to swap between those two.
 * @param captionStyle - How captions are drawn.
 * @param onCaptionStyleChange - Called with a change to that.
 * @param onCaptionStyleReset - Called to put caption appearance back to its defaults.
 * @param onVolumeChange - Called with the volume they set.
 * @param onToggleMute - Called to silence or unsilence.
 * @param onToggleFullscreen - Called to enter or leave fullscreen.
 * @param onToggleStats - Called to open or close the statistics panel.
 * @param subtitleOffsetSeconds - How far subtitles are nudged from where the file puts them.
 * @param onSubtitleOffsetChange - Called with a nudge to that.
 * @param castState - Whether there is anywhere to cast to, and whether it is in use.
 * @param onCast - Called to cast to another device.
 * @param onPopOut - Called to move the video into a floating window.
 * @param isPoppedOut - Whether it is already in one.
 * @param partyMenu - The watch party control, where this viewing can be one.
 * @param renderPreview - How to draw the frame under the pointer while scrubbing.
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
  isPoppedOut = false,
  castState = 'unavailable',
  onCast,
  onToggleStats,
  subtitleOffsetSeconds = 0,
  onSubtitleOffsetChange,
  renderPreview,
  partyMenu,
}: PlayerControlsProps) => (
  <div className="flux-glass flex flex-col gap-1 rounded-lg px-3 py-2 text-white sm:px-4">
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

      <Button
        variant="bare"
        size="none"
        aria-label={isShowingRemaining ? 'Show the time played' : 'Show the time remaining'}
        onClick={onToggleTimeDisplay}
        className="shrink-0 rounded-md px-1 text-xs tabular-nums hover:bg-white/10 sm:text-sm"
      >
        {isShowingRemaining
          ? `-${formatDuration(Math.max(duration - position, 0))}`
          : formatDuration(position)}{' '}
        <span className="text-white/50">/ {formatDuration(duration)}</span>
      </Button>
    </div>

    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        isIconOnly
        variant="ghost"
        label={`Back ${SKIP_SECONDS.toString()} seconds`}
        onClick={() => {
          onSkip(-SKIP_SECONDS);
        }}
        disabled={isDisabled}
        size="md"
      >
        <RiAnticlockwiseLine size={22} aria-hidden />
      </Button>

      <Button
        isIconOnly
        variant="ghost"
        label={isPlaying ? 'Pause' : 'Play'}
        onClick={onTogglePlay}
        disabled={isDisabled}
        size="md"
      >
        {isPlaying ? <RiPauseFill size={22} aria-hidden /> : <RiPlayFill size={22} aria-hidden />}
      </Button>

      <Button
        isIconOnly
        variant="ghost"
        label={`Forward ${SKIP_SECONDS.toString()} seconds`}
        onClick={() => {
          onSkip(SKIP_SECONDS);
        }}
        disabled={isDisabled}
        size="md"
      >
        <RiClockwiseLine size={22} aria-hidden />
      </Button>

      <span className="flex-1" />

      <div className="group/volume hidden items-center gap-1 sm:flex">
        <Button
          isIconOnly
          variant="ghost"
          label={isMuted ? 'Unmute' : 'Mute'}
          onClick={onToggleMute}
          size="md"
        >
          {isMuted || volume === 0 ? (
            <RiVolumeMuteLine size={20} aria-hidden />
          ) : (
            <RiVolumeUpLine size={20} aria-hidden />
          )}
        </Button>

        <Slider
          label="Volume"
          value={isMuted ? 0 : Math.round(volume * 100)}
          max={100}
          tone="overlay"
          onValueChange={(next) => {
            onVolumeChange(next / 100);
          }}
          className="w-0 overflow-hidden px-0 transition-[width,padding] duration-[var(--duration-fast)] ease-[var(--ease-out)] motion-reduce:transition-none group-hover/volume:w-24 group-hover/volume:px-2 group-focus-within/volume:w-24 group-focus-within/volume:px-2"
        />
      </div>

      {partyMenu}

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

      {subtitleTracks.length === 0 ? null : (
        <Button
          isIconOnly
          variant="ghost"
          label={selectedSubtitleId === SUBTITLES_OFF ? 'Turn subtitles on' : 'Turn subtitles off'}
          isActive={selectedSubtitleId !== SUBTITLES_OFF}
          onClick={() => {
            onSubtitleChange(
              selectedSubtitleId === SUBTITLES_OFF
                ? (subtitleTracks[0]?.id ?? SUBTITLES_OFF)
                : SUBTITLES_OFF,
            );
          }}
          disabled={isDisabled}
          size="md"
        >
          {selectedSubtitleId === SUBTITLES_OFF ? (
            <RiClosedCaptioningLine size={22} aria-hidden />
          ) : (
            <RiClosedCaptioningFill size={22} aria-hidden />
          )}
        </Button>
      )}

      <SettingsMenu
        label="Settings"
        {...(onMenuOpenChange === undefined ? {} : { onOpenChange: onMenuOpenChange })}
        isDisabled={isDisabled}
        trigger={<RiSettings3Line size={20} aria-hidden />}
        triggerWhenOpen={<RiSettings3Fill size={20} aria-hidden />}
        rows={[
          ...(audioTracks.length < 2
            ? []
            : [
                {
                  kind: 'choice' as const,
                  id: 'audio',
                  label: 'Audio track',
                  icon: <RiHeadphoneLine size={18} aria-hidden />,
                  selectedId: (selectedAudioIndex ?? audioTracks[0]?.index ?? 0).toString(),
                  onSelect: (id: string) => {
                    onAudioChange(Number(id));
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
            icon: <RiClosedCaptioningLine size={18} aria-hidden />,
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
                  icon: <RiTimeLine size={18} aria-hidden />,
                  detail:
                    subtitleOffsetSeconds === 0
                      ? 'In time'
                      : `${subtitleOffsetSeconds > 0 ? '+' : ''}${subtitleOffsetSeconds.toFixed(2)}s`,
                  control: (
                    <span className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        variant="ghost"
                        label="Subtitles earlier"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(subtitleOffsetSeconds - SUBTITLE_STEP_SECONDS);
                        }}
                      >
                        <RiSubtractLine size={16} aria-hidden />
                      </Button>

                      <Button
                        isIconOnly
                        variant="ghost"
                        label="Subtitles in time"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(0);
                        }}
                      >
                        <RiRefreshLine size={16} aria-hidden />
                      </Button>

                      <Button
                        isIconOnly
                        variant="ghost"
                        label="Subtitles later"
                        size="sm"
                        onClick={() => {
                          onSubtitleOffsetChange(subtitleOffsetSeconds + SUBTITLE_STEP_SECONDS);
                        }}
                      >
                        <RiAddLine size={16} aria-hidden />
                      </Button>
                    </span>
                  ),
                },
              ]),
          {
            kind: 'panel' as const,
            id: 'appearance',
            label: 'Caption settings',
            icon: <RiFontSize size={18} aria-hidden />,
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
            icon: <RiSpeedLine size={18} aria-hidden />,
            selectedId: playbackRate.toString(),
            onSelect: (id: string) => {
              onPlaybackRateChange(Number(id));
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
                  icon: <RiEqualizerLine size={18} aria-hidden />,
                  selectedId: selectedQuality,
                  onSelect: (id: string) => {
                    onQualityChange(
                      availableQualitySteps.find((step) => step === id) ?? 'original',
                    );
                  },
                  choices: [
                    { id: 'original', label: 'Original' },
                    ...availableQualitySteps.map((id) => {
                      const step = QUALITY_STEPS.find((entry) => entry.id === id);

                      return {
                        id,
                        label: step?.label ?? id,
                        ...(step === undefined
                          ? {}
                          : { detail: bitrateDetail(step.maxVideoBitrateKbps) }),
                      };
                    }),
                  ],
                },
              ]),
          {
            kind: 'toggle' as const,
            id: 'stats',
            label: 'Stats for nerds',
            icon: <RiPulseLine size={18} aria-hidden />,
            isOn: isShowingStats,
            onToggle: onToggleStats,
          },
        ]}
      />

      {onCast === undefined || castState === 'unavailable' ? null : (
        <Button
          isIconOnly
          variant="ghost"
          label={
            castState === 'connected'
              ? 'Playing on another device'
              : 'Play on a device — your browser will ask which'
          }
          isActive={castState === 'connected'}
          disabled={castState === 'connecting'}
          onClick={onCast}
          size="md"
        >
          <RiCastLine size={20} aria-hidden />
        </Button>
      )}

      {onPopOut === undefined ? null : (
        <Button
          isIconOnly
          variant="ghost"
          label="Pop out"
          onClick={onPopOut}
          isActive={isPoppedOut}
          size="md"
        >
          {isPoppedOut ? (
            <RiPictureInPicture2Fill size={20} aria-hidden />
          ) : (
            <RiPictureInPicture2Line size={20} aria-hidden />
          )}
        </Button>
      )}

      <Button
        isIconOnly
        variant="ghost"
        label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        onClick={onToggleFullscreen}
        size="md"
      >
        {isFullscreen ? (
          <RiFullscreenExitLine size={20} aria-hidden />
        ) : (
          <RiFullscreenLine size={20} aria-hidden />
        )}
      </Button>
    </div>
  </div>
);

PlayerControls.displayName = 'PlayerControls';

export { PlayerControls };
