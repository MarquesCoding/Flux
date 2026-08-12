import { useEffect, useRef, useState } from 'react';
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { VideoSurface } from '@FluxUI/VideoSurface';
import { frameUrl } from '@FluxWeb/playback/frameUrl';
import { readLights } from '@FluxWeb/library/readLights';
import {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  previewTrack,
} from '@FluxWeb/playback/fetchSubtitles';
import { liftCues } from '@FluxWeb/playback/liftCues';
import type { MediaPreviewProps } from './MediaPreview.types';

/**
 * How long the page waits before starting anything.
 *
 * Opening an item to read its runtime should not start it playing. Someone
 * still looking after a moment is someone who might watch it.
 *
 * Long enough to read a title and a line of the synopsis first. At half this
 * the picture changed under the words while they were still being read, which
 * makes the page feel like it is racing whoever opened it.
 */
const SETTLE_MILLISECONDS = 2600;

/**
 * Where an item's preview clip is served from.
 */
const previewUrl = (mediaId: string): string => `/api/media/${mediaId}/preview`;

/**
 * How far down the picture a subtitle sits, as a percentage.
 *
 * Low enough to read as subtitles rather than as a caption across the middle,
 * and high enough to clear the fade along the bottom edge. A preview is
 * blended into the page there, so a cue on the last line is drawn underneath
 * the very gradient that hides it.
 */
const CUE_LINE = 80;

/**
 * How often to look at what is showing.
 *
 * The cost is a draw of a twenty-four pixel square and a read of it, which is
 * small enough to do several times a second and still be nothing next to
 * painting the clip itself. Looking often is what lets the room follow a scene;
 * it is not what decides how fast the room changes.
 */
const LOOK_EVERY_MILLISECONDS = 200;

/**
 * A glimpse of what an item looks like.
 *
 * The clip is a file made when the item was imported, not a stream produced on
 * demand. That is the whole difference between a page that can show several
 * previews at once and one that cannot: a transcode is a limited resource
 * belonging to whoever is actually watching something, while a file is just a
 * file.
 *
 * It opens on the frame the clip begins with, dissolves into the clip, and
 * dissolves back to that frame when the clip ends — so a hero that rotates
 * leaves on a still picture rather than cutting away mid-shot.
 *
 * Falls back to the frame, and then to the backdrop, and stays there if
 * anything goes wrong: a preview is decoration, and an item must remain
 * readable without one.
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
  repeats,
  onEnded,
  onPlayingChange,
  onPalette,
  actions,
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [, setHasFrame] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [subtitles, setSubtitles] = useState<{ id: string; language: string } | null>(null);

  /**
   * Whether the frame is the thing being shown.
   *
   * Before the clip has produced anything, and again once it has run out.
   * Deliberately not tied to whether it is playing at this instant: that flag
   * flickers with every pause, stall and buffer, and each flicker used to
   * throw the still back over a picture that was perfectly good.
   */
  const loops = repeats ?? onEnded === undefined;

  const isShowingFrame = !hasStarted || hasEnded;
  const startSeconds = Math.floor(durationSeconds * startFraction);

  useEffect(() => {
    if (!hasSubtitles) {
      return;
    }

    let abandoned = false;

    void fetchSubtitleTracks(mediaId).then((tracks) => {
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

    const play = async () => {
      element.muted = true;
      element.src = previewUrl(mediaId);

      await element.play().catch(() => {});
    };

    const timer = setTimeout(() => {
      void play();
    }, settleMilliseconds);

    return () => {
      clearTimeout(timer);
      setIsPlaying(false);
      setHasStarted(false);
      setHasEnded(false);
      setIsMuted(true);
      element.removeAttribute('src');
      element.load();
    };
  }, [mediaId, settleMilliseconds]);

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

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`flux-preview h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame ? 'opacity-0' : 'opacity-100'
        }`}
        onPlayingChange={(playing) => {
          setIsPlaying(playing);

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
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
          {actions}

          {!hasSound || !hasStarted ? null : (
            <>
              <Button
                isIconOnly
                variant="ghost"
                label={isPlaying ? 'Pause the preview' : 'Play the preview'}
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
                className="bg-black/50 text-white backdrop-blur"
              >
                {isPlaying ? (
                  <IconPlayerPauseFilled size={18} aria-hidden />
                ) : (
                  <IconPlayerPlayFilled size={18} aria-hidden />
                )}
              </Button>

              <Button
                isIconOnly
                variant="ghost"
                label={isMuted ? 'Turn sound on' : 'Turn sound off'}
                onClick={() => {
                  const element = videoRef.current;

                  if (element !== null) {
                    element.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="bg-black/50 text-white backdrop-blur"
              >
                {isMuted ? (
                  <IconVolumeOff size={18} aria-hidden />
                ) : (
                  <IconVolume size={18} aria-hidden />
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
