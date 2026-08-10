import cnModule from '@FluxUI/cn'
import type { VideoSurfaceProps } from './VideoSurface.types'

const { cn } = cnModule

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
  onTimeUpdate,
  onDurationChange,
  onPlayingChange,
}: VideoSurfaceProps) => {
  return (
    <video
      ref={videoRef}
      aria-label={label}
      playsInline
      {...(poster === undefined ? {} : { poster })}
      className={cn('w-full bg-black', className)}
      onTimeUpdate={(event) => {
        onTimeUpdate?.(event.currentTarget.currentTime)
      }}
      onDurationChange={(event) => {
        onDurationChange?.(event.currentTarget.duration)
      }}
      onPlay={() => {
        onPlayingChange?.(true)
      }}
      onPause={() => {
        onPlayingChange?.(false)
      }}
    />
  )
}

VideoSurface.displayName = 'VideoSurface'

export default { VideoSurface }
