import { Icon } from '@FluxUI/Icon';
import { VolumeHighIcon, VolumeMute01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { VideoSurface } from '@FluxUI/VideoSurface';
import { frameUrl } from '@FluxClient/playback/frameUrl';
import { readLights } from '@FluxScreens/library/readLights';
import {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  previewTrack,
} from '@FluxClient/playback/fetchSubtitles';
import { liftCues } from '@FluxScreens/playback/liftCues';
import { readPreviewState } from '@FluxClient/playback/readPreviewState';
import { readSoundPreference, saveSoundPreference } from '@FluxClient/playback/soundPreference';
import { fadeAudioOut } from '@FluxScreens/playback/fadeAudioOut';
import { claimSound } from '@FluxScreens/playback/soundOwner';
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

const CUE_LINE = 80;

const PREVIEW_PENDING = 'Preview is being made — check back shortly';

const PREVIEW_ABSENT = 'No preview available';

const LOOK_EVERY_MILLISECONDS = 200;

const FADE_MILLISECONDS = 700;

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
 * @param hasSubtitles - Whether it carries forced subtitles.
 * @param controlsAtTop - Whether the controls sit in the top corner rather than the bottom one, for a
 *   preview filling a screen that has nothing else up there.
 * @param isHeld - Whether the clip should hold where it is rather than playing on. A hero standing
 *   behind a dialog would otherwise run its clip out while nobody could see it, and come back to a
 *   still it has no reason to leave.
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
  hasSubtitles = false,
  controlsAtTop = false,
  isHeld = false,
  repeats,
  onEnded,
  onPlayingChange,
  onPalette,
  actions,
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [, setHasFrame] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [mayBeHeard, setMayBeHeard] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [absence, setAbsence] = useState<PreviewAbsence>(null);
  const [subtitles, setSubtitles] = useState<{ id: string; language: string } | null>(null);

  const loops = repeats ?? onEnded === undefined;

  const isShowingFrame = !hasStarted || hasEnded || absence !== null;
  const startSeconds = Math.floor(durationSeconds * startFraction);

  useEffect(() => {
    if (!hasSubtitles) {
      return;
    }

    let abandoned = false;

    void fetchSubtitleTracks(mediaId)
      .catch(() => [])
      .then((tracks) => {
        const chosen = previewTrack(tracks, navigator.language);

        if (!abandoned && chosen !== null) {
          setSubtitles({ id: chosen.id, language: chosen.language ?? 'und' });
        }
      });

    return () => {
      abandoned = true;
    };
  }, [mediaId, hasSubtitles]);

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
      element.muted = true;
      element.volume = 1;
      element.src = clip;

      await element.play().catch(() => {});

      if (!element.isConnected || !hasSound || readSoundPreference() === 'muted') {
        return;
      }

      setIsMuted(false);
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
      element.pause();

      return;
    }

    void element.play().catch(() => {});
  }, [isHeld, hasStarted, hasEnded]);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    element.muted = isMuted || !mayBeHeard;
  }, [isMuted, mayBeHeard]);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null || subtitles === null) {
      return;
    }

    return liftCues(element, () => CUE_LINE).stop;
  }, [subtitles]);

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
      className={`relative overflow-hidden bg-black ${
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
          <p className="rounded-md bg-black/65 px-2.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-sm">
            {absence === 'pending' ? PREVIEW_PENDING : PREVIEW_ABSENT}
          </p>
        </div>
      )}

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`flux-preview h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame ? 'opacity-0' : 'opacity-100'
        }`}
        onPlayingChange={(playing) => {
          if (playing) {
            setHasStarted(true);
            setHasEnded(false);
          }

          onPlayingChange?.(playing);
        }}
        {...(subtitles === null
          ? {}
          : {
              textTrack: {
                id: subtitles.id,
                label: 'Subtitles',
                language: subtitles.language,
                src: subtitleTrackUrl(mediaId, subtitles.id, startSeconds),
              },
            })}
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

      {actions === undefined && (!hasSound || !hasStarted) ? null : (
        <div
          className={`absolute right-4 z-10 flex items-center gap-2 ${
            controlsAtTop ? 'top-4' : 'bottom-4'
          }`}
        >
          {actions}

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
                className="bg-black/50 text-white backdrop-blur"
              >
                {isMuted ? (
                  <Icon of={VolumeMute01Icon} size={18} />
                ) : (
                  <Icon of={VolumeHighIcon} size={18} />
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {fills ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface to-transparent" />
      )}
    </div>
  );
};

MediaPreview.displayName = 'MediaPreview';

export { MediaPreview };
