import { useEffect, useRef, useState } from 'react'
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import IconButtonModule from '@FluxUI/IconButton'
import frameUrlModule from '@FluxWeb/playback/frameUrl'
import type { MediaPreviewProps } from './MediaPreview.types'

const { VideoSurface } = VideoSurfaceModule
const { IconButton } = IconButtonModule
const { frameUrl } = frameUrlModule

/**
 * How long the page waits before starting anything.
 *
 * Opening an item to read its runtime should not start it playing. Someone
 * still looking after a moment is someone who might watch it.
 */
const SETTLE_MILLISECONDS = 1200

/**
 * Where an item's preview clip is served from.
 */
const previewUrl = (mediaId: string): string => `/api/media/${mediaId}/preview`

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
  tint = null,
  hasSound = false,
  onEnded,
  onPlayingChange,
}: MediaPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  // Whether the clip has finished. Together with whether it has started, this
  // is the only thing that decides which of the two pictures is on top —
  // pausing is not one of them, because a paused video is still a frame of the
  // film and covering it with a still is covering a picture with a picture.
  const [hasEnded, setHasEnded] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [isMuted, setIsMuted] = useState(!hasSound)
  // Whether the clip has ever run. The controls appear once it has and stay,
  // because a pause button that vanishes the moment it is pressed is a pause
  // button nobody can undo.
  const [hasStarted, setHasStarted] = useState(false)

  /**
   * Whether the frame is the thing being shown.
   *
   * Before the clip has produced anything, and again once it has run out.
   * Deliberately not tied to whether it is playing at this instant: that flag
   * flickers with every pause, stall and buffer, and each flicker used to
   * throw the still back over a picture that was perfectly good.
   */
  const isShowingFrame = !hasStarted || hasEnded
  const startSeconds = Math.floor(durationSeconds * startFraction)

  useEffect(() => {
    const element = videoRef.current

    if (element === null) {
      return
    }

    let abandoned = false

    const play = async () => {
      // Sound where it was asked for. Opening an item is a deliberate act, so
      // a browser usually allows it; where one does not, the preview falls
      // back to silence rather than refusing to play at all.
      element.muted = !hasSound
      element.src = previewUrl(mediaId)

      try {
        await element.play()
      } catch {
        if (abandoned || !hasSound) {
          return
        }

        element.muted = true
        setIsMuted(true)

        await element.play().catch(() => {
          // The still frame is a perfectly good answer.
        })
      }
    }

    const timer = setTimeout(() => {
      void play()
    }, settleMilliseconds)

    return () => {
      abandoned = true
      clearTimeout(timer)
      setIsPlaying(false)
      setHasStarted(false)
      setHasEnded(false)
      element.removeAttribute('src')
      element.load()
    }
  }, [mediaId, settleMilliseconds, hasSound])

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
      {/* The backdrop sits underneath, for the moment before the frame
          itself arrives. */}
      {backdropUrl === null ? null : (
        <div
          role="presentation"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      {/* The frame the clip begins on, drawn under it. Handing over from this
          to the playing clip moves nothing on screen, and returning to it when
          the clip ends means a rotation leaves on a picture. An image rather
          than a background, so its decoding can be waited on. */}
      <img
        src={frameUrl(mediaId, startSeconds)}
        alt=""
        aria-hidden
        onLoad={() => {
          setHasFrame(true)
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame && hasFrame ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <VideoSurface
        label="Preview"
        videoRef={videoRef}
        className={`h-full w-full object-cover transition-opacity duration-700 ${
          isShowingFrame ? 'opacity-0' : 'opacity-100'
        }`}
        // Whether something is playing is the element's own business, not a
        // flag kept beside it. Tracking it separately meant the two could
        // disagree — and when they did, the still came back over a clip that
        // was still running, which is the one state that must be impossible.
        onPlayingChange={(playing) => {
          setIsPlaying(playing)

          if (playing) {
            setHasStarted(true)
            setHasEnded(false)
          }

          onPlayingChange?.(playing)
        }}
        onEnded={() => {
          // Back to the frame first, and only then is whoever owns this told:
          // a rotation that begins while the video is on screen is a cut, and
          // one that begins from the frame is a dissolve.
          setHasEnded(true)
          onEnded?.()
        }}
      />

      {/* Offered only once there is something to control. A preview that
          cannot be stopped is a page that will not stop talking. */}
      {!hasSound || !hasStarted ? null : (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
          <IconButton
            label={isPlaying ? 'Pause the preview' : 'Play the preview'}
            onClick={() => {
              const element = videoRef.current

              if (element === null) {
                return
              }

              if (element.paused) {
                void element.play().catch(() => {
                  // Refused, which the still frame already reflects.
                })
              } else {
                element.pause()
              }
            }}
            className="bg-black/50 text-white backdrop-blur"
          >
            {isPlaying ? (
              <IconPlayerPauseFilled size={18} aria-hidden />
            ) : (
              <IconPlayerPlayFilled size={18} aria-hidden />
            )}
          </IconButton>

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
