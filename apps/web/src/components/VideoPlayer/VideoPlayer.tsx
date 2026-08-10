import { useCallback, useEffect, useRef, useState } from 'react'
import { IconInfoCircle, IconPlayerPause, IconPlayerPlay, IconX } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import SpinnerModule from '@FluxUI/Spinner'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession'
import type { PlayerState, VideoPlayerProps } from './VideoPlayer.types'

const { Button } = ButtonModule
const { Spinner } = SpinnerModule
const { VideoSurface } = VideoSurfaceModule
const { formatDuration } = formatDurationModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession, describeWhy } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule

/**
 * Plays a library item.
 *
 * Asks the server for a session using a profile built from this browser's real
 * capabilities, then attaches a media engine to the returned manifest. The
 * reason the server chose the treatment it did is always available, because
 * "why is this transcoding?" should not require reading server logs.
 */
const VideoPlayer = ({ media, onClose }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [session, setSession] = useState<StartedSession | null>(null)
  const [state, setState] = useState<PlayerState>('starting')
  const [problem, setProblem] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showReasons, setShowReasons] = useState(false)

  useEffect(() => {
    // Read through a function so the checker cannot narrow it. The effect may
    // be cleaned up while an await is in flight, so every guard after an await
    // is live; narrowing would mark them dead and the lint would demand their
    // removal.
    const controller = new AbortController()
    const isAbandoned = () => controller.signal.aborted
    let teardown: (() => Promise<void>) | null = null
    let startedId: string | null = null

    const run = async () => {
      const outcome = await startPlaybackSession(media.id, detectFromBrowser())

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
        teardown = await attachShaka({ element, manifestUrl: outcome.session.manifestUrl })

        if (!isAbandoned()) {
          setState('playing')
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
  }, [media.id])

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
          onTimeUpdate={setPosition}
          onDurationChange={setDuration}
          onPlayingChange={setIsPlaying}
        />

        {state === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label="Preparing playback" size="lg" />
          </div>
        ) : null}
      </div>

      {state === 'failed' ? (
        <p role="alert" className="text-sm text-danger">
          {problem ?? 'Playback failed.'}
        </p>
      ) : null}

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
