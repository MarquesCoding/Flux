import { useEffect, useRef, useState } from 'react'
import { IconVolume, IconVolumeOff } from '@tabler/icons-react'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import IconButtonModule from '@FluxUI/IconButton'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import frameUrlModule from '@FluxWeb/playback/frameUrl'
import type { MediaPreviewProps } from './MediaPreview.types'

const { VideoSurface } = VideoSurfaceModule
const { IconButton } = IconButtonModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule
const { frameUrl } = frameUrlModule

/**
 * How long the dialog waits before starting anything.
 *
 * Opening an item to read its runtime should not start a transcode. Someone
 * still looking after a moment is someone who might watch it.
 */
const SETTLE_MILLISECONDS = 1200

/**
 * A muted glimpse of what an item looks like.
 *
 * Starts a real session a little way in, because the first seconds of a film
 * are a distributor's logo. Silent by design: a dialog that starts talking is
 * a dialog people learn to close quickly.
 *
 * Falls back to the backdrop and stays there if anything goes wrong. A preview
 * is decoration, and an item must remain readable without it.
 */
const MediaPreview = ({
  mediaId,
  backdropUrl,
  startFraction = 0.2,
  durationSeconds,
  fills = false,
  settleMilliseconds = SETTLE_MILLISECONDS,
  tint = null,
  hasSound = false,
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const startSeconds = Math.floor(durationSeconds * startFraction)

  useEffect(() => {
    const controller = new AbortController()
    const isAbandoned = () => controller.signal.aborted
    let teardown: (() => Promise<void>) | null = null
    let startedId: string | null = null

    const start = async () => {
      const outcome = await startPlaybackSession(mediaId, detectFromBrowser(), startSeconds)

      if (isAbandoned() || outcome.kind === 'failed') {
        return
      }

      startedId = outcome.session.sessionId

      const element = videoRef.current

      if (element === null) {
        return
      }

      element.muted = true

      try {
        if (outcome.session.delivery.kind === 'direct') {
          element.src = outcome.session.delivery.url
        } else {
          teardown = await attachShaka({
            element,
            manifestUrl: outcome.session.delivery.manifestUrl,
          })
        }

        if (!isAbandoned()) {
          await element.play()
          setIsPlaying(true)
        }
      } catch {
        // The backdrop stays, which is a perfectly good answer.
      }
    }

    const timer = setTimeout(() => {
      void start()
    }, settleMilliseconds)

    return () => {
      controller.abort()
      clearTimeout(timer)
      void teardown?.()

      if (startedId !== null) {
        void stopPlaybackSession(startedId)
      }
    }
  }, [mediaId, startSeconds, settleMilliseconds])

  return (
    <div
      // Tinted rather than black, and tinted before anything has loaded, so
      // the hero has a presence from the first paint instead of appearing as a
      // black band under a page that has already arrived.
      style={tint === null ? {} : { backgroundColor: tint }}
      className={`relative overflow-hidden ${tint === null ? 'bg-black' : ''} ${
        fills ? 'h-full w-full' : 'aspect-video w-full'
      }`}
    >
      {/* The frame the video is about to start on, drawn under it. Handing
          over from this to the playing video moves nothing on screen, where
          cutting from a backdrop to a frame two thirds into the film is a
          visible jump. The backdrop sits under it in turn, for the moment
          before the frame itself arrives. */}
      {backdropUrl === null ? null : (
        <div
          role="presentation"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      {/* An image rather than a background, so its decoding can be waited on:
          a background that appears mid-paint flashes, where this fades in when
          it is actually there. */}
      <img
        src={frameUrl(mediaId, startSeconds)}
        alt=""
        aria-hidden
        onLoad={() => {
          setHasFrame(true)
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          isPlaying || !hasFrame ? 'opacity-0' : 'opacity-100'
        }`}
      />

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`h-full w-full object-cover transition-opacity duration-700 ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Offered only once there is something to listen to. A speaker on a
          still frame is a control that does nothing. */}
      {!hasSound || !isPlaying ? null : (
        <div className="absolute bottom-4 right-4">
          <IconButton
            label={isMuted ? 'Turn sound on' : 'Turn sound off'}
            onClick={() => {
              const element = videoRef.current

              if (element !== null) {
                element.muted = !isMuted
                setIsMuted(!isMuted)
              }
            }}
            className="bg-black/50 text-white backdrop-blur"
          >
            {isMuted ? (
              <IconVolumeOff size={18} aria-hidden />
            ) : (
              <IconVolume size={18} aria-hidden />
            )}
          </IconButton>
        </div>
      )}

      {fills ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface to-transparent" />
      )}
    </div>
  )
}

MediaPreview.displayName = 'MediaPreview'

export default { MediaPreview }
