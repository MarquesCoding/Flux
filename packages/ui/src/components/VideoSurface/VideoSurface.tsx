import { useEffect, useRef } from 'react';
import { cn } from '@FluxUI/cn';
import type { VideoSurfaceProps } from './VideoSurface.types';

/**
 * The video element itself, and nothing else.
 *
 * Deliberately knows nothing about manifests, codecs or sessions: a playback
 * engine attaches to the element through `videoRef`. That keeps FluxUI free of
 * domain concepts per ADR-0013 while still being the only place a raw media
 * element appears.
 *
 * No `controls` attribute. Native controls cannot be themed, differ on every
 * platform, and would sit outside the token layer that themes depend on.
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
  onEnded,
  loops = false,
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
        own.mode = 'showing';
      }
    };

    show();

    element.textTracks.addEventListener('addtrack', show);

    return () => {
      element.textTracks.removeEventListener('addtrack', show);
    };
  }, [videoRef, trackId]);

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
