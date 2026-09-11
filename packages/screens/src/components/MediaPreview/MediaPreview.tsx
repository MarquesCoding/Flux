import { Icon } from '@ValenceUI/Icon';
import { PauseIcon, PlayIcon, VolumeHighIcon, VolumeOffIcon } from '@hugeicons/core-free-icons';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { VideoSurface } from '@ValenceUI/VideoSurface';
import { frameUrl } from '@ValenceClient/playback/frameUrl';
import { readLights } from '@ValenceScreens/library/readLights';
import { readPreviewState } from '@ValenceClient/playback/readPreviewState';
import { readSoundPreference, saveSoundPreference } from '@ValenceClient/playback/soundPreference';
import { fadeAudioOut } from '@ValenceScreens/playback/fadeAudioOut';
import { rampVolume } from '@ValenceScreens/playback/rampVolume';
import { claimSound } from '@ValenceScreens/playback/soundOwner';
import type { MediaPreviewProps, PreviewAbsence } from './MediaPreview.types';

const SETTLE_MILLISECONDS = 2600;

/**
 * Builds the address an item's preview clip is served from — the short clip rendered when the
 * library was scanned, which is what plays under a pointer resting on a card.
 *
 * @param mediaId - The item.
 * @returns The address to load.
 */
const previewUrl = (mediaId: string): string => `/api/media/${mediaId}/preview`;

const PREVIEW_PENDING = 'Preview is being made — check back shortly';

const PREVIEW_ABSENT = 'No preview available';

const LOOK_EVERY_MILLISECONDS = 200;

const FADE_MILLISECONDS = 700;

const SETTLE_BACK_MILLISECONDS = 700;

/**
 * Plays a few seconds of an item where a poster would otherwise sit, once a pointer has rested long
 * enough to mean it. Starts muted and silent by default, since a grid where every card can make a
 * noise is a grid nobody can browse.
 *
 * @param mediaId - The item to preview.
 * @param backdropUrl - What to show before the clip has loaded.
 * @param durationSeconds - How long the item is, for choosing where to start.
 * @param fills - Whether the clip fills its space or fits inside it.
 * @param settleMilliseconds - How long a pointer must rest before it plays.
 * @param startFraction - How far into the item to start.
 * @param hasSound - Whether it may be unmuted at all. It still starts silent either way, and only
 *   carries a viewer's remembered choice where this is set.
 * @param controlsAtTop - Whether the controls sit in the top corner rather than the bottom one, for a
 *   preview filling a screen that has nothing else up there.
 * @param isHeld - Whether the clip should hold where it is rather than playing on. A hero standing
 *   behind a dialog would otherwise run its clip out while nobody could see it, and come back to a
 *   still it has no reason to leave. Letting go waits a moment and turns the sound back up rather
 *   than snapping straight into motion, so a dialog closing settles rather than startles.
 * @param repeats - Whether it starts again at the end.
 * @param onEnded - Told when the clip finishes.
 * @param onPlayingChange - Told when it starts or stops.
 * @param onPalette - Told the colours on screen, so the page can be lit by them.
 */
const MediaPreview = ({
  mediaId,
  backdropUrl,
  startFraction = 0.2,
  durationSeconds,
  fills = false,
  settleMilliseconds = SETTLE_MILLISECONDS,
  hasSound = false,
  controlsAtTop = false,
  isHeld = false,
  repeats,
  onEnded,
  onPlayingChange,
  onPalette,
  actions,
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasHeld = useRef(false);
  const isFallingQuiet = useRef(false);
  const stillRef = useRef<HTMLImageElement>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [, setHasFrame] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [mayBeHeard, setMayBeHeard] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [absence, setAbsence] = useState<PreviewAbsence>(null);

  const loops = repeats ?? onEnded === undefined;

  const isShowingFrame = !hasStarted || hasEnded || absence !== null;
  const startSeconds = Math.floor(durationSeconds * startFraction);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    let abandoned = false;

    const clip = previewUrl(mediaId);

    const play = async () => {
      const state = await readPreviewState(clip);

      if (abandoned) {
        return;
      }

      if (state !== 'ready') {
        setAbsence(state);

        return;
      }

      setAbsence(null);
      isFallingQuiet.current = false;
      element.muted = true;
      element.volume = 1;
      element.src = clip;

      element.addEventListener(
        'play',
        () => {
          if (!element.isConnected || !hasSound || readSoundPreference() === 'muted') {
            return;
          }

          setIsMuted(false);
        },
        { once: true },
      );

      await element.play().catch(() => {});
    };

    const timer = setTimeout(() => {
      void play();
    }, settleMilliseconds);

    return () => {
      abandoned = true;
      clearTimeout(timer);
      setHasStarted(false);
      setHasEnded(false);
      setIsMuted(true);
      setAbsence(null);

      void fadeAudioOut(element, FADE_MILLISECONDS).then(() => {
        if (element.src.endsWith(clip)) {
          element.removeAttribute('src');
          element.load();
        }
      });
    };
  }, [mediaId, settleMilliseconds, hasSound]);

  useEffect(() => {
    if (!hasSound) {
      return;
    }

    return claimSound(setMayBeHeard);
  }, [hasSound]);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null || !hasStarted || hasEnded) {
      return;
    }

    if (isHeld) {
      wasHeld.current = true;
      element.pause();

      return;
    }

    if (!wasHeld.current) {
      return;
    }

    wasHeld.current = false;

    const timer = setTimeout(() => {
      isFallingQuiet.current = false;
      element.volume = 0;

      void element
        .play()
        .then(() => rampVolume(element, 1, FADE_MILLISECONDS))
        .catch(() => {});
    }, SETTLE_BACK_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [isHeld, hasStarted, hasEnded]);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    element.muted = isMuted || !mayBeHeard;
  }, [isMuted, mayBeHeard]);

  useEffect(() => {
    if (onPalette === undefined) {
      return;
    }

    const look = () => {
      const element = videoRef.current;
      const still = stillRef.current;

      const found =
        element !== null && !isShowingFrame && element.readyState > 1
          ? readLights(element)
          : still !== null && still.complete
            ? readLights(still)
            : [];

      if (found.length > 0) {
        onPalette(found);
      }
    };

    look();

    const timer = setInterval(look, LOOK_EVERY_MILLISECONDS);

    return () => {
      clearInterval(timer);
    };
  }, [onPalette, isShowingFrame, mediaId]);

  return (
    <div
      className={`relative overflow-hidden bg-shade ${
        fills ? 'h-full w-full' : 'aspect-video w-full'
      }`}
    >
      <img
        ref={stillRef}
        crossOrigin="anonymous"
        src={backdropUrl ?? frameUrl(mediaId, startSeconds)}
        alt=""
        aria-hidden
        onLoad={() => {
          setHasFrame(true);
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {absence === null ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-4">
          <p className="rounded-md bg-shade/65 px-2.5 py-1.5 text-xs font-medium text-on-scrim/85 backdrop-blur-sm">
            {absence === 'pending' ? PREVIEW_PENDING : PREVIEW_ABSENT}
          </p>
        </div>
      )}

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`valence-preview h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame ? 'opacity-0' : 'opacity-100'
        }`}
        onTimeUpdate={(seconds) => {
          const element = videoRef.current;

          if (element === null || loops || isFallingQuiet.current) {
            return;
          }

          const left = element.duration - seconds;

          if (Number.isNaN(left) || left > FADE_MILLISECONDS / 1000) {
            return;
          }

          if (element.muted || element.volume === 0) {
            return;
          }

          isFallingQuiet.current = true;

          void rampVolume(element, 0, Math.max(left, 0) * 1000);
        }}
        onPlayingChange={(playing) => {
          if (playing) {
            setHasStarted(true);
            setHasEnded(false);
          }

          setIsPaused(!playing);
          onPlayingChange?.(playing);
        }}
        loops={loops}
        onEnded={() => {
          if (loops) {
            const element = videoRef.current;

            if (element !== null) {
              element.currentTime = 0;

              void element.play().catch(() => {});
            }

            return;
          }

          setHasEnded(true);
          onEnded?.();
        }}
      />

      {actions === undefined && !hasStarted ? null : (
        <div
          className={`absolute right-4 z-10 flex items-center gap-2 ${
            controlsAtTop ? 'top-4' : 'bottom-4'
          }`}
        >
          {actions}

          {!hasStarted ? null : (
            <Button
              isIconOnly
              variant="ghost"
              label={isPaused ? 'Play the preview' : 'Pause the preview'}
              onClick={() => {
                const element = videoRef.current;

                if (element === null) {
                  return;
                }

                if (element.paused) {
                  void element.play().catch(() => {});
                } else {
                  element.pause();
                }
              }}
              className="bg-shade/50 text-on-scrim backdrop-blur"
            >
              {isPaused ? <Icon of={PlayIcon} size={18} /> : <Icon of={PauseIcon} size={18} />}
            </Button>
          )}

          {!hasSound || !hasStarted ? null : (
            <>
              <Button
                isIconOnly
                variant="ghost"
                label={isMuted ? 'Turn sound on' : 'Turn sound off'}
                onClick={() => {
                  const element = videoRef.current;

                  if (element === null) {
                    return;
                  }

                  const isSilenced = !isMuted;

                  element.volume = 1;
                  setIsMuted(isSilenced);
                  saveSoundPreference(isSilenced ? 'muted' : 'audible');
                }}
                className="bg-shade/50 text-on-scrim backdrop-blur"
              >
                {isMuted ? (
                  <Icon of={VolumeOffIcon} size={18} />
                ) : (
                  <Icon of={VolumeHighIcon} size={18} />
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {fills ? null : (
        <div className="valence-artwork-blend--raised pointer-events-none absolute inset-x-0 bottom-0 h-32" />
      )}
    </div>
  );
};

MediaPreview.displayName = 'MediaPreview';

export { MediaPreview };
