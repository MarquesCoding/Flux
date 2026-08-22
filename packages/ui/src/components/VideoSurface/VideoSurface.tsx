import { useEffect, useRef } from 'react';
import { cn } from '@FluxUI/cn';
import type { VideoSurfaceProps } from './VideoSurface.types';

/**
 * The one place a `<video>` element is written. Owns the element and its events and nothing else —
 * no controls, no chrome, no session handling — so the player above it can be rebuilt without the
 * picture ever being torn down and remounted.
 *
 * @param src - What to play.
 * @param label - What is playing, read out to anybody who cannot see it.
 * @param videoRef - A handle on the element, for the player that drives it.
 * @param poster - A frame to show before playback starts.
 * @param textTrack - The subtitle track to attach, where one is selected.
 * @param isDrawnElsewhere - Whether somebody above is drawing the subtitles. The track is still
 *   attached and still loaded, because a picture-in-picture window has no text tracks of its own and
 *   reads its lines from these — it is only the drawing that is somebody else's.
 * @param onTimeUpdate - Told the position as it moves.
 * @param onDurationChange - Told the length once the file says what it is.
 * @param onPlayingChange - Told when playback starts or stops.
 * @param onBufferingChange - Told when the picture is waiting for data and when it has some again.
 * @param onEnded - Told when the file reaches its end.
 * @param loops - Whether to start again at the end, for a preview rather than a film.
 * @param className - Extra classes for the caller's own layout.
 */
const VideoSurface = ({
  label,
  videoRef,
  poster,
  className,
  textTrack,
  onTimeUpdate,
  onDurationChange,
  onPlayingChange,
  onBufferingChange,
  onEnded,
  loops = false,
  isDrawnElsewhere = false,
}: VideoSurfaceProps) => {
  const trackId = textTrack?.id ?? null;
  const trackRef = useRef<HTMLTrackElement>(null);
  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    const show = () => {
      for (const track of Array.from(element.textTracks)) {
        track.mode = 'disabled';
      }

      const own = trackRef.current?.track;

      if (own !== undefined && trackId !== null) {
        own.mode = isDrawnElsewhere ? 'hidden' : 'showing';
      }
    };

    show();

    element.textTracks.addEventListener('addtrack', show);

    return () => {
      element.textTracks.removeEventListener('addtrack', show);
    };
  }, [videoRef, trackId, isDrawnElsewhere]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      playsInline
      loop={loops}
      {...(poster === undefined ? {} : { poster })}
      className={cn('w-full bg-black', className)}
      onTimeUpdate={(event) => {
        onTimeUpdate?.(event.currentTarget.currentTime);
      }}
      onDurationChange={(event) => {
        onDurationChange?.(event.currentTarget.duration);
      }}
      onEnded={() => {
        onPlayingChange?.(false);
        onEnded?.();
      }}
      onPlay={() => {
        onPlayingChange?.(true);
      }}
      onPause={() => {
        onPlayingChange?.(false);
      }}
      onWaiting={() => {
        onBufferingChange?.(true);
      }}
      onSeeking={() => {
        onBufferingChange?.(true);
      }}
      onStalled={() => {
        onBufferingChange?.(true);
      }}
      onPlaying={() => {
        onBufferingChange?.(false);
      }}
      onCanPlay={() => {
        onBufferingChange?.(false);
      }}
      onSeeked={() => {
        onBufferingChange?.(false);
      }}
    >
      {textTrack === undefined ? null : (
        <track
          key={textTrack.id}
          ref={trackRef}
          kind="subtitles"
          default
          src={textTrack.src}
          label={textTrack.label}
          srcLang={textTrack.language}
        />
      )}
    </video>
  );
};

VideoSurface.displayName = 'VideoSurface';

export { VideoSurface };
