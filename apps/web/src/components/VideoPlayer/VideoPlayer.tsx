import { useCallback, useEffect, useRef, useState } from 'react'
import { IconAlertTriangle, IconX } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import SpinnerModule from '@FluxUI/Spinner'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import fetchTrickplayModule from '@FluxWeb/playback/fetchTrickplay'
import captureFrameModule from '@FluxWeb/playback/captureFrame'
import readPlaybackHealthModule from '@FluxWeb/playback/readPlaybackHealth'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import TrickplayPreviewModule from './components/TrickplayPreview/TrickplayPreview'
import PlayerControlsModule from './components/PlayerControls/PlayerControls'
import StreamStatsModule from './components/StreamStats/StreamStats'
import type { Trickplay } from '@FluxWeb/playback/fetchTrickplay'
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession'
import type { MediaDetail } from '@FluxContracts/schemas/Library'
import type { PlaybackHealth } from './components/StreamStats/StreamStats.types'
import type { PlayerState, VideoPlayerProps } from './VideoPlayer.types'

const { Button } = ButtonModule
const { Spinner } = SpinnerModule
const { VideoSurface } = VideoSurfaceModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule
const { fetchTrickplay } = fetchTrickplayModule
const { captureFrame } = captureFrameModule
const { readPlaybackHealth, encodedSeconds } = readPlaybackHealthModule
const { fetchMediaDetail } = fetchLibraryModule
const { TrickplayPreview } = TrickplayPreviewModule
const { PlayerControls } = PlayerControlsModule
const { StreamStats } = StreamStatsModule

/**
 * An element that may be able to go full screen.
 *
 * Declared optional because the DOM types promise a fullscreen API that not
 * every browser ships.
 */
type FullscreenTarget = {
  requestFullscreen?: () => Promise<void>
}

type FullscreenOwner = {
  exitFullscreen?: () => Promise<void>
}

const IDLE_MILLISECONDS = 2500

const HEALTH_INTERVAL_MILLISECONDS = 500

const EMPTY_HEALTH: PlaybackHealth = {
  positionSeconds: 0,
  bufferedAheadSeconds: 0,
  encodedSeconds: 0,
  droppedFrames: null,
  decodedFrames: null,
  presentedWidth: 0,
  presentedHeight: 0,
}

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
  const stageRef = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<StartedSession | null>(null)
  const [state, setState] = useState<PlayerState>('starting')
  const [problem, setProblem] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [reportedDuration, setReportedDuration] = useState(0)
  const [trickplay, setTrickplay] = useState<Trickplay | null>(null)
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isShowingStats, setIsShowingStats] = useState(false)
  const [health, setHealth] = useState<PlaybackHealth>(EMPTY_HEALTH)
  const [isIdle, setIsIdle] = useState(false)
  // What the current session was asked for. A transcode is produced from the
  // point it starts at, so seeking outside what has been encoded means asking
  // for a new one rather than moving within this one.
  const [request, setRequest] = useState({ mediaId: media.id, startSeconds: 0 })
  // The frame the viewer was looking at when they dragged the scrub bar. Held
  // on screen until the new session produces one of its own, because tearing
  // the old session down blanks the media element and a black rectangle reads
  // as the video having broken rather than as a seek.
  const [heldFrame, setHeldFrame] = useState<string | null>(null)

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

    if (request.startSeconds === 0) {
      setHeldFrame(null)
    }

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
    setDetail(null)

    void fetchTrickplay(media.id).then((found) => {
      if (!abandoned) {
        setTrickplay(found)
      }
    })

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found)
      }
    })

    return () => {
      abandoned = true
    }
  }, [media.id])

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onChange)

    return () => {
      document.removeEventListener('fullscreenchange', onChange)
    }
  }, [])

  useEffect(() => {
    const element = videoRef.current

    if (element !== null) {
      element.volume = volume
      element.muted = isMuted
    }
  }, [volume, isMuted])

  useEffect(() => {
    if (!isShowingStats) {
      return
    }

    const sample = () => {
      const element = videoRef.current

      if (element !== null) {
        setHealth(readPlaybackHealth(element, request.startSeconds))
      }
    }

    sample()

    const timer = setInterval(sample, HEALTH_INTERVAL_MILLISECONDS)

    return () => {
      clearInterval(timer)
    }
  }, [isShowingStats, request.startSeconds])

  useEffect(() => {
    if (!isPlaying) {
      setIsIdle(false)

      return
    }

    const timer = setTimeout(() => {
      setIsIdle(true)
    }, IDLE_MILLISECONDS)

    return () => {
      clearTimeout(timer)
    }
  }, [isPlaying, position])

  // A transcode is delivered as a playlist that grows while ffmpeg encodes, so
  // the media element only knows about the part produced so far. The library
  // already knows how long the film is, and that is what a viewer should see.
  const duration = media.durationSeconds > 0 ? media.durationSeconds : reportedDuration

  const togglePlay = useCallback(() => {
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

      setHeldFrame(captureFrame(element, document.createElement('canvas')))
      setRequest({ mediaId: request.mediaId, startSeconds: Math.floor(seconds) })
    },
    [request, session],
  )

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current

    if (stage === null) {
      return
    }

    // Driven by what the player last heard from the fullscreenchange event
    // rather than by reading the document: browsers disagree on whether an
    // element that is not full screen reads as null or as absent.
    //
    // Read through types that admit the API might be missing. The DOM types
    // promise a fullscreen API that not every browser actually ships.
    const owner: FullscreenOwner = document
    const target: FullscreenTarget = stage

    if (isFullscreen) {
      void owner.exitFullscreen?.()

      return
    }

    void target.requestFullscreen?.()
  }, [isFullscreen])

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-text">{media.title}</h2>

        <Button variant="ghost" size="sm" onClick={onClose}>
          <IconX size={16} aria-hidden />
          Close
        </Button>
      </header>

      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-lg bg-black"
        onPointerMove={() => {
          setIsIdle(false)
        }}
        onPointerLeave={() => {
          setIsIdle(isPlaying)
        }}
      >
        <VideoSurface
          label={media.title}
          videoRef={videoRef}
          onTimeUpdate={(seconds) => {
            setPosition(request.startSeconds + seconds)
            setHeldFrame(null)
          }}
          onDurationChange={setReportedDuration}
          onPlayingChange={setIsPlaying}
        />

        {heldFrame === null ? null : (
          <div
            role="presentation"
            className="pointer-events-none absolute inset-0 bg-black bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heldFrame})` }}
          />
        )}

        {state === 'starting' ? (
          <div
            className={
              heldFrame === null
                ? 'pointer-events-none absolute inset-0 flex items-center justify-center'
                : 'pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white'
            }
          >
            <Spinner
              label={heldFrame === null ? 'Preparing playback' : 'Seeking'}
              size={heldFrame === null ? 'lg' : 'sm'}
            />
          </div>
        ) : null}

        {isShowingStats ? (
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex justify-end">
            <StreamStats
              media={media}
              session={session}
              detail={detail}
              health={health}
              sessionStartSeconds={request.startSeconds}
              onClose={() => {
                setIsShowingStats(false)
              }}
            />
          </div>
        ) : null}

        <div
          className={`absolute inset-x-3 bottom-3 transition-opacity ${
            isIdle && !isShowingStats ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <PlayerControls
            title={media.title}
            isPlaying={isPlaying}
            position={position}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isShowingStats={isShowingStats}
            isDisabled={state !== 'playing'}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onVolumeChange={(next) => {
              setVolume(next)
              setIsMuted(next === 0)
            }}
            onToggleMute={() => {
              setIsMuted((muted) => !muted)
            }}
            onToggleFullscreen={toggleFullscreen}
            onToggleStats={() => {
              setIsShowingStats((showing) => !showing)
            }}
            {...(trickplay === null
              ? {}
              : {
                  renderPreview: (seconds: number) => (
                    <TrickplayPreview trickplay={trickplay} seconds={seconds} />
                  ),
                })}
          />
        </div>
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
    </section>
  )
}

VideoPlayer.displayName = 'VideoPlayer'

export default { VideoPlayer }
