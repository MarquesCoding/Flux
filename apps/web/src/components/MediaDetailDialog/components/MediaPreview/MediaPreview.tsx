import { useEffect, useRef, useState } from 'react'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import type { MediaPreviewProps } from './MediaPreview.types'

const { VideoSurface } = VideoSurfaceModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule

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
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const isAbandoned = () => controller.signal.aborted
    let teardown: (() => Promise<void>) | null = null
    let startedId: string | null = null

    const start = async () => {
      const outcome = await startPlaybackSession(
        mediaId,
        detectFromBrowser(),
        Math.floor(durationSeconds * startFraction),
      )

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
    }, SETTLE_MILLISECONDS)

    return () => {
      controller.abort()
      clearTimeout(timer)
      void teardown?.()

      if (startedId !== null) {
        void stopPlaybackSession(startedId)
      }
    }
  }, [mediaId, durationSeconds, startFraction])

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {backdropUrl === null ? null : (
        <div
          role="presentation"
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
            isPlaying ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`h-full w-full object-cover transition-opacity duration-700 ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface to-transparent" />
    </div>
  )
}

MediaPreview.displayName = 'MediaPreview'

export default { MediaPreview }
