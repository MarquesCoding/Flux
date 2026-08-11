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
 */
const SETTLE_MILLISECONDS = 1200;

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
  // Whether the clip has finished. Together with whether it has started, this
  // is the only thing that decides which of the two pictures is on top —
  // pausing is not one of them, because a paused video is still a frame of the
  // film and covering it with a still is covering a picture with a picture.
  const [hasEnded, setHasEnded] = useState(false);
  // Whether the picture has arrived. Kept so nothing can flash a half drawn
  // image, but never a reason to hide the still: an item whose artwork is
  // slow should show black, not a video that is not ready either.
  const [, setHasFrame] = useState(false);
  // Silent until somebody asks otherwise. Opening an item is a deliberate act
  // but it is not a request to be talked at, and a dialog that starts making
  // noise over whatever else is playing is a dialog people close.
  const [isMuted, setIsMuted] = useState(true);
  // Whether the clip has ever run. The controls appear once it has and stay,
  // because a pause button that vanishes the moment it is pressed is a pause
  // button nobody can undo.
  const [hasStarted, setHasStarted] = useState(false);
  // The track to draw over the clip, once it is known. A preview of a film in
  // a language somebody does not speak is a preview of nothing, so the
  // subtitles a viewer would get if they pressed play are the subtitles they
  // get while deciding whether to.
  const [subtitles, setSubtitles] = useState<{ id: string; language: string } | null>(null);

  /**
   * Whether the frame is the thing being shown.
   *
   * Before the clip has produced anything, and again once it has run out.
   * Deliberately not tied to whether it is playing at this instant: that flag
   * flickers with every pause, stall and buffer, and each flicker used to
   * throw the still back over a picture that was perfectly good.
   */
  // Nobody waiting for the clip to finish means nothing to hand over to, so
  // it runs again rather than falling back to a still. A hero passes a
  // handler because it rotates; a dialog and a hovered card have nowhere to
  // go, and dropping them back to a photograph after twenty four seconds
  // reads as the preview breaking.
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
      // Muted, which is also the only way a browser will let a page start a
      // video by itself. Sound is a thing to be turned on.
      element.muted = true;
      element.src = previewUrl(mediaId);

      await element.play().catch(() => {
        // The still frame is a perfectly good answer.
      });
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

  // Cues sit where the picture is, not where the page fades it out. A preview
  // is masked into the surface along its bottom edge, and a subtitle placed on
  // the last line lands inside that fade — technically drawn, practically
  // invisible.
  useEffect(() => {
    const element = videoRef.current;

    if (element === null || subtitles === null) {
      return;
    }

    return liftCues(element, () => CUE_LINE).stop;
  }, [subtitles]);

  // The light the page is under, read from whatever this is showing: the clip
  // as it runs, and the still while it is not. Read corner by corner, so what
  // lands on the left of the page came from the left of the picture.
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
      // Black under whatever is being shown, so a still that has not arrived
      // yet is a dark frame rather than a hole through to the page.
      className={`relative overflow-hidden bg-black ${
        fills ? 'h-full w-full' : 'aspect-video w-full'
      }`}
    >
      {/* The item's own artwork, which is what it should look like when it is
          not playing. A frame pulled out of the file is the fallback for an
          item a catalogue has never heard of — good enough to stand in, but
          not what anybody chose to represent the thing. */}
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
        // Whether something is playing is the element's own business, not a
        // flag kept beside it. Tracking it separately meant the two could
        // disagree — and when they did, the still came back over a clip that
        // was still running, which is the one state that must be impossible.
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
                // Shifted to where the clip starts, since a preview begins a
                // fifth of the way into the film and the cues count from its
                // beginning.
                src: subtitleTrackUrl(mediaId, subtitles.id, startSeconds),
              },
            })}
        loops={loops}
        onEnded={() => {
          // Started again here as well as by the element's own loop: a clip
          // that stops where nothing is waiting for it has nowhere to hand
          // over to, and falling back to a photograph reads as the preview
          // breaking rather than as it finishing.
          if (loops) {
            const element = videoRef.current;

            if (element !== null) {
              element.currentTime = 0;

              void element.play().catch(() => {
                // Refused; the frame underneath is a fair answer.
              });
            }

            return;
          }

          // Back to the frame first, and only then is whoever owns this told:
          // a rotation that begins while the video is on screen is a cut, and
          // one that begins from the frame is a dissolve. Not everything that
          // plays once has somebody waiting — a page about one item simply
          // goes back to being a page about one item.
          setHasEnded(true);
          onEnded?.();
        }}
      />

      {/* Offered only once there is something to control. A preview that
          cannot be stopped is a page that will not stop talking. Anything the
          caller wants said about the item itself sits in the same cluster:
          these are all things done to what is on screen, and a second cluster
          somewhere else is a second place to look. */}
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
                    void element.play().catch(() => {
                      // Refused, which the still frame already reflects.
                    });
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
