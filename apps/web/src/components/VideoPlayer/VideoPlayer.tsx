import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import SpinnerModule from '@FluxUI/Spinner'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import SeekBarModule from '@FluxUI/SeekBar'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import fetchTrickplayModule from '@FluxWeb/playback/fetchTrickplay'
import TrickplayPreviewModule from './components/TrickplayPreview/TrickplayPreview'
import type { Trickplay } from '@FluxWeb/playback/fetchTrickplay'
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession'
import type { PlayerState, VideoPlayerProps } from './VideoPlayer.types'

const { Button } = ButtonModule
const { Spinner } = SpinnerModule
const { VideoSurface } = VideoSurfaceModule
const { formatDuration } = formatDurationModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession, describeWhy } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule
const { fetchTrickplay } = fetchTrickplayModule
const { SeekBar } = SeekBarModule
const { TrickplayPreview } = TrickplayPreviewModule

/**
 * Plays a library item.
 *
 * Asks the server for a session using a profile built from this browser's real
 * capabilities, then attaches a media engine to the returned manifest. The
 * reason the server chose the treatment it did is always available, because
 * "why is this transcoding?" should not require reading server logs.
 */
/**
 * How much of the current session a player could seek within.
 *
 * A transcode is delivered as a playlist that grows, so this answers what has
 * been encoded so far rather than how long the film is. Read defensively
 * because a media element that has loaded nothing yet reports no ranges at
 * all.
 */
const encodedSeconds = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.seekable

    return ranges.length > 0 ? ranges.end(ranges.length - 1) : 0
  } catch {
    return 0
  }
}

const VideoPlayer = ({ media, onClose }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [session, setSession] = useState<StartedSession | null>(null)
  const [state, setState] = useState<PlayerState>('starting')
  const [problem, setProblem] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [reportedDuration, setReportedDuration] = useState(0)
  const [showReasons, setShowReasons] = useState(false)
  const [trickplay, setTrickplay] = useState<Trickplay | null>(null)
  // What the current session was asked for. A transcode is produced from the
  // point it starts at, so seeking outside what has been encoded means asking
  // for a new one rather than moving within this one.
  const [request, setRequest] = useState({ mediaId: media.id, startSeconds: 0 })

  if (request.mediaId !== media.id) {
    setRequest({ mediaId: media.id, startSeconds: 0 })
  }

  useEffect(() => {
    // Read through a function so the checker cannot narrow it. The effect may
    // be cleaned up while an await is in flight, so every guard after an await
    // is live; narrowing would mark them dead and the lint would demand their
    // removal.
    // Every piece of state below describes the item that was playing a moment
    // ago. Left alone it would be shown against the new one until the server
    // answers, which reads as the player getting the film wrong.
    setSession(null)
    setState('starting')
    setProblem(null)
    setIsPlaying(false)
    setPosition(request.startSeconds)
    setReportedDuration(0)
    setShowReasons(false)

    const controller = new AbortController()
    const isAbandoned = () => controller.signal.aborted
    let teardown: (() => Promise<void>) | null = null
    let startedId: string | null = null

    const run = async () => {
      const outcome = await startPlaybackSession(
        request.mediaId,
        detectFromBrowser(),
        request.startSeconds,
      )

      if (isAbandoned()) {
        return
      }

      if (outcome.kind === 'failed') {
        setProblem(outcome.reason)
        setState('failed')

        return
      }

      startedId = outcome.session.sessionId
      setSession(outcome.session)

      const element = videoRef.current

      if (element === null) {
        return
      }

      try {
        // Direct play needs no media engine at all: the browser can read the
        // original file over byte ranges. Loading Shaka for it would download
        // a decoder to do nothing.
        if (outcome.session.delivery.kind === 'direct') {
          element.src = outcome.session.delivery.url
        } else {
          teardown = await attachShaka({
            element,
            manifestUrl: outcome.session.delivery.manifestUrl,
          })
        }

        if (!isAbandoned()) {
          setState('playing')

          // A session started partway through exists because someone dragged
          // the scrub bar. Making them press play again after every seek
          // would be its own kind of broken.
          if (request.startSeconds > 0) {
            void element.play()
          }
        }
      } catch {
        if (!isAbandoned()) {
          setProblem('This browser could not play the stream.')
          setState('failed')
        }
      }
    }

    void run()

    return () => {
      controller.abort()
      void teardown?.()

      if (startedId !== null) {
        void stopPlaybackSession(startedId)
      }
    }
  }, [request])

  useEffect(() => {
    // Fetched alongside playback rather than before it. Rendering thumbnails
    // decodes the whole file, which on a long film takes longer than starting
    // the stream; making playback wait for previews would be the wrong trade.
    let abandoned = false

    setTrickplay(null)

    void fetchTrickplay(media.id).then((found) => {
      if (!abandoned) {
        setTrickplay(found)
      }
    })

    return () => {
      abandoned = true
    }
  }, [media.id])

  // A transcode is delivered as a playlist that grows while ffmpeg encodes, so
  // the media element only knows about the part produced so far. The library
  // already knows how long the film is, and that is what a viewer should see.
  const duration = media.durationSeconds > 0 ? media.durationSeconds : reportedDuration

  const seek = useCallback(
    (seconds: number) => {
      const element = videoRef.current

      if (element === null) {
        return
      }

      setPosition(seconds)

      // Direct play serves the original file over byte ranges, so the whole
      // film is reachable and the browser does the work.
      if (session?.delivery.kind === 'direct') {
        element.currentTime = seconds

        return
      }

      const withinSession = seconds - request.startSeconds

      if (withinSession >= 0 && withinSession <= encodedSeconds(element)) {
        element.currentTime = withinSession

        return
      }

      setRequest({ mediaId: request.mediaId, startSeconds: Math.floor(seconds) })
    },
    [request, session],
  )

  const toggle = useCallback(() => {
    const element = videoRef.current

    if (element === null) {
      return
    }

    if (element.paused) {
      void element.play()

      return
    }

    element.pause()
  }, [])

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-text">{media.title}</h2>

        <Button variant="ghost" size="sm" onClick={onClose}>
          <IconX size={16} aria-hidden />
          Close
        </Button>
      </header>

      <div className="relative overflow-hidden rounded-lg bg-black">
        <VideoSurface
          label={media.title}
          videoRef={videoRef}
          onTimeUpdate={(seconds) => {
            setPosition(request.startSeconds + seconds)
          }}
          onDurationChange={setReportedDuration}
          onPlayingChange={setIsPlaying}
        />

        {state === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label="Preparing playback" size="lg" />
          </div>
        ) : null}
      </div>

      {session === null || session.warnings.length === 0 ? null : (
        <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm text-text-muted">
          {session.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      )}

      {state === 'failed' ? (
        <p role="alert" className="text-sm text-danger">
          {problem ?? 'Playback failed.'}
        </p>
      ) : null}

      <SeekBar
        label={`Seek through ${media.title}`}
        position={position}
        duration={duration}
        onSeek={seek}
        {...(trickplay === null
          ? {}
          : {
              renderPreview: (seconds: number) => (
                <TrickplayPreview trickplay={trickplay} seconds={seconds} />
              ),
            })}
      />

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={toggle} disabled={state !== 'playing'}>
          {isPlaying ? (
            <IconPlayerPause size={16} aria-hidden />
          ) : (
            <IconPlayerPlay size={16} aria-hidden />
          )}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        <span className="text-sm tabular-nums text-text-muted">
          {formatDuration(position)} / {formatDuration(duration)}
        </span>

        {session === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowReasons((shown) => !shown)
            }}
          >
            <IconInfoCircle size={16} aria-hidden />
            {session.mode}
          </Button>
        )}
      </div>

      {showReasons && session !== null ? (
        <ul className="flex flex-col gap-1 rounded-md bg-surface-raised p-3 text-sm text-text-muted">
          {describeWhy(session.plan).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

VideoPlayer.displayName = 'VideoPlayer'

export default { VideoPlayer }
