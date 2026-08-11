import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconPictureInPicture,
  IconPlayerTrackNext,
  IconX,
} from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import IconButtonModule from '@FluxUI/IconButton'
import SpinnerModule from '@FluxUI/Spinner'
import VideoSurfaceModule from '@FluxUI/VideoSurface'
import detectDeviceProfileModule from '@FluxWeb/playback/detectDeviceProfile'
import startPlaybackSessionModule from '@FluxWeb/playback/startPlaybackSession'
import attachShakaModule from '@FluxWeb/playback/attachShaka'
import fetchTrickplayModule from '@FluxWeb/playback/fetchTrickplay'
import popOutWithCaptionsModule from '@FluxWeb/playback/popOutWithCaptions'
import captureFrameModule from '@FluxWeb/playback/captureFrame'
import readPlaybackHealthModule from '@FluxWeb/playback/readPlaybackHealth'
import fetchSubtitlesModule from '@FluxWeb/playback/fetchSubtitles'
import captionStyleModule from '@FluxWeb/playback/captionStyle'
import qualityPreferenceModule from '@FluxWeb/playback/qualityPreference'
import fetchSegmentsModule from '@FluxWeb/playback/fetchSegments'
import watchProgressModule from '@FluxWeb/playback/watchProgress'
import playbackPreferencesModule from '@FluxWeb/playback/playbackPreferences'
import describeTrackModule from '@FluxCore/functions/describeTrack'
import listAvailableQualityStepsModule from '@FluxCore/functions/listAvailableQualitySteps'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import TrickplayPreviewModule from './components/TrickplayPreview/TrickplayPreview'
import PlayerControlsModule from './components/PlayerControls/PlayerControls'
import StreamStatsModule from './components/StreamStats/StreamStats'
import CaptionSettingsModule from './components/CaptionSettings/CaptionSettings'
import type { Trickplay } from '@FluxWeb/playback/fetchTrickplay'
import type { PoppedOut } from '@FluxWeb/playback/popOutWithCaptions'
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession'
import type { MediaDetail } from '@FluxContracts/schemas/Library'
import type { SubtitleTrack } from '@FluxWeb/playback/fetchSubtitles'
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment'
import type { PlaybackHealth } from './components/StreamStats/StreamStats.types'
import type { QualityPreference } from '@FluxWeb/playback/qualityPreference'
import type { PlayerState, VideoPlayerProps } from './VideoPlayer.types'

const { Button } = ButtonModule
const { IconButton } = IconButtonModule
const { Spinner } = SpinnerModule
const { VideoSurface } = VideoSurfaceModule
const { detectFromBrowser } = detectDeviceProfileModule
const { startPlaybackSession, stopPlaybackSession } = startPlaybackSessionModule
const { attachShaka } = attachShakaModule
const { fetchTrickplay } = fetchTrickplayModule
const { popOutWithCaptions } = popOutWithCaptionsModule
const { captureFrame } = captureFrameModule
const { readPlaybackHealth, encodedSeconds } = readPlaybackHealthModule
const { fetchSubtitleTracks, subtitleTrackUrl, defaultTrackId, trackForLanguage, SUBTITLES_OFF } =
  fetchSubtitlesModule
const { fetchMediaDetail } = fetchLibraryModule
const { TrickplayPreview } = TrickplayPreviewModule
const { PlayerControls } = PlayerControlsModule
const { StreamStats } = StreamStatsModule
const { CaptionSettings } = CaptionSettingsModule
const { toCueCss, readCaptionStyle, saveCaptionStyle, DEFAULT_CAPTION_STYLE } = captionStyleModule
const { readQualityPreference, saveQualityPreference } = qualityPreferenceModule
const { fetchSegments, skippableAt, describeSkip } = fetchSegmentsModule
const { describeAudioTrack } = describeTrackModule
const { listAvailableQualitySteps } = listAvailableQualityStepsModule
const { reportWatchProgress, REPORT_EVERY_MILLISECONDS } = watchProgressModule
const { readPlaybackPreferences, writePlaybackPreferences } = playbackPreferencesModule

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

/**
 * How far a jump moves.
 *
 * The arrows step a frame at a time, which is for looking at something. This
 * is for getting past it: thirty seconds is a scene, and the buttons on the
 * bar do ten.
 */
const JUMP_SECONDS = 30

/**
 * How close to the end counts as finished.
 *
 * Credits run for minutes, and someone who stops during them has watched the
 * film. Offering to resume it would be offering them the credits.
 */
const FINISHED_WITHIN_SECONDS = 90

const HEALTH_INTERVAL_MILLISECONDS = 500

/**
 * How long a frame lasts until the film says otherwise.
 *
 * Twenty five a second, which is wrong for most things and close enough for
 * all of them: it is only used for the first press, before two frames have
 * gone past to be measured.
 */
const DEFAULT_FRAME_SECONDS = 1 / 25

/**
 * How long to wait before asking a stalled stream again.
 */
const START_RETRY_MILLISECONDS = 1500

/**
 * How many times that is worth doing.
 *
 * A few seconds of trying, and then the picture is somebody else's problem:
 * a player that retries forever is a player that hides a broken file.
 */
const START_ATTEMPTS = 4

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
const VideoPlayer = ({
  media,
  isImmersive = false,
  startSeconds = 0,
  onClose,
  onProgress,
  onEnded,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Keeps the nudges at a stream that has not started from outliving the
  // session they belong to.
  const startTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // How long one frame lasts, measured from the film itself. Nothing in the
  // library reports a frame rate — ffprobe knows, but the browser is the one
  // being asked to land on a frame, so the browser is asked.
  const frameSecondsRef = useRef(DEFAULT_FRAME_SECONDS)
  const [session, setSession] = useState<StartedSession | null>(null)
  const [state, setState] = useState<PlayerState>('starting')
  const [problem, setProblem] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [reportedDuration, setReportedDuration] = useState(0)
  const [trickplay, setTrickplay] = useState<Trickplay | null>(null)
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  // How this device was left, rather than how a fresh element starts. Somebody
  // who turned a film down does not expect the next episode to open at full
  // volume, and somebody watching in silence does not expect to be shouted at.
  const [volume, setVolume] = useState(() => readPlaybackPreferences().volume)
  const [isMuted, setIsMuted] = useState(() => readPlaybackPreferences().isMuted)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isShowingStats, setIsShowingStats] = useState(false)
  const [health, setHealth] = useState<PlaybackHealth>(EMPTY_HEALTH)
  const [isIdle, setIsIdle] = useState(false)
  // Bumped by anything a viewer actually did. Playback position is not that:
  // it changes several times a second, and a timer restarted by it never
  // expires, so the controls would sit there for the whole film.
  const [activity, setActivity] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(SUBTITLES_OFF)
  const [captionStyle, setCaptionStyle] = useState(readCaptionStyle)
  const [isEditingCaptions, setIsEditingCaptions] = useState(false)
  // How far the subtitles have been nudged, and how far that nudge has already
  // been applied to the cues on screen. Both are needed: the cues are moved by
  // the difference, because a track carries its own times and there is nothing
  // to reapply an absolute offset to.
  const [subtitleOffset, setSubtitleOffset] = useState(0)
  const appliedOffsetRef = useRef(0)
  const [segments, setSegments] = useState<MediaSegment[]>([])
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null)
  // What the current session was asked for. A transcode is produced from the
  // point it starts at, so seeking outside what has been encoded means asking
  // for a new one rather than moving within this one.
  const [request, setRequest] = useState<{
    mediaId: string
    startSeconds: number
    audioStreamIndex?: number
    requestedQuality: QualityPreference
    // Whole seconds, always. A position read back from the server is a
    // fraction of one — nobody stops a film on a second boundary — and the
    // contract asks for an integer, so resuming used to be answered with a
    // validation error the player could only report as "playback could not be
    // started".
  }>({
    mediaId: media.id,
    startSeconds: Math.floor(startSeconds),
    requestedQuality: readQualityPreference(),
  })
  // The frame the viewer was looking at when they dragged the scrub bar. Held
  // on screen until the new session produces one of its own, because tearing
  // the old session down blanks the media element and a black rectangle reads
  // as the video having broken rather than as a seek.
  const [heldFrame, setHeldFrame] = useState<string | null>(null)

  // Offered only where the browser has a floating window of its own. Firefox
  // has one it does not expose to a page, and Safari on a phone has none at
  // all, so this is asked rather than assumed.
  const canPopOut = typeof document !== 'undefined' && document.pictureInPictureEnabled === true

  // What is currently floating with its captions drawn in, so it can be put
  // back. Held in a ref rather than in state because nothing on screen
  // depends on it.
  const poppedRef = useRef<PoppedOut | null>(null)
  const [isPoppedOut, setIsPoppedOut] = useState(false)

  const popOut = useCallback(() => {
    const element = videoRef.current

    if (element === null) {
      return
    }

    // Leaving is the same button as entering: a viewer who popped a film out
    // and wants it back has one control, not two.
    if (document.pictureInPictureElement !== null) {
      poppedRef.current?.stop()
      poppedRef.current = null
      setIsPoppedOut(false)

      void document.exitPictureInPicture().catch(() => {
        // Already gone, which is the outcome that was wanted.
      })

      return
    }

    void (async () => {
      // With subtitles on, the film is redrawn into a canvas along with its
      // cues and that is what floats: a browser's own window shows the video
      // and nothing layered over it, so captions would simply disappear.
      const withCaptions = Array.from(element.textTracks).some((track) => track.mode !== 'disabled')
        ? await popOutWithCaptions(element)
        : null

      if (withCaptions !== null) {
        poppedRef.current = withCaptions
        setIsPoppedOut(true)

        return
      }

      await element.requestPictureInPicture().catch(() => {
        // A browser may refuse — no gesture, or a stream it will not float.
        // Nothing to say about it that the viewer can act on.
      })
    })()
  }, [])

  useEffect(
    () => () => {
      poppedRef.current?.stop()
      poppedRef.current = null
    },
    [],
  )

  // Nudging the subtitles moves the cues themselves rather than asking the
  // server for the file again: the browser already holds them, and a viewer
  // pressing a button twice a second should not be waiting on a round trip
  // each time.
  useEffect(() => {
    const element = videoRef.current

    if (element === null) {
      return
    }

    const shift = subtitleOffset - appliedOffsetRef.current

    if (shift === 0) {
      return
    }

    let moved = false

    for (const track of Array.from(element.textTracks)) {
      for (const cue of Array.from(track.cues ?? [])) {
        // Never before the beginning: a cue dragged past zero would stack up
        // on the first frame with every other cue that went with it.
        cue.startTime = Math.max(0, cue.startTime + shift)
        cue.endTime = Math.max(0, cue.endTime + shift)
        moved = true
      }
    }

    if (moved) {
      appliedOffsetRef.current = subtitleOffset
    }
  }, [subtitleOffset, selectedSubtitleId, position])

  // The window can be closed from its own controls as well as from ours, so
  // the page listens rather than assuming it is the only thing that ends this.
  useEffect(() => {
    const onLeave = () => {
      poppedRef.current?.stop()
      poppedRef.current = null
      setIsPoppedOut(false)
    }

    const onEnter = () => {
      setIsPoppedOut(true)
    }

    const element = videoRef.current

    element?.addEventListener('enterpictureinpicture', onEnter)
    element?.addEventListener('leavepictureinpicture', onLeave)
    document.addEventListener('leavepictureinpicture', onLeave)

    return () => {
      element?.removeEventListener('enterpictureinpicture', onEnter)
      element?.removeEventListener('leavepictureinpicture', onLeave)
      document.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [])

  /**
   * Gets a stream running, and keeps trying for as long as that is sensible.
   *
   * A transcode is delivered as a playlist that is still being written, so
   * asking to play it the instant it is attached can find nothing there yet.
   * The element answers that by sitting at nothing rather than by failing,
   * which is the state a viewer used to escape by dragging the scrub bar —
   * seeking made the element ask again, and asking again was all it needed.
   */
  const start = useCallback((element: HTMLVideoElement) => {
    let attempts = 0

    const attempt = () => {
      void element.play().catch(() => {
        // Refused rather than unready: a browser that will not autoplay wants
        // a gesture, and the play button is right there.
      })
    }

    attempt()

    clearInterval(startTimerRef.current ?? undefined)

    startTimerRef.current = setInterval(() => {
      attempts += 1

      if (attempts > START_ATTEMPTS || element.readyState > 0 || !element.paused) {
        clearInterval(startTimerRef.current ?? undefined)
        startTimerRef.current = null

        return
      }

      // Nothing has arrived yet. Asking the element to load again is what a
      // seek was doing by accident.
      element.load()
      attempt()
    }, START_RETRY_MILLISECONDS)
  }, [])

  if (request.mediaId !== media.id) {
    setRequest({
      mediaId: media.id,
      startSeconds: Math.floor(startSeconds),
      requestedQuality: request.requestedQuality,
    })
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
        request.audioStreamIndex,
        request.requestedQuality,
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

          // Navigating to a film is asking to watch it. Nobody arrives at a
          // player and wants a still picture with a play button over it, and
          // a seek is not a request to stop either.
          start(element)
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
      clearInterval(startTimerRef.current ?? undefined)
      startTimerRef.current = null
      void teardown?.()

      if (startedId !== null) {
        void stopPlaybackSession(startedId)
      }
    }
  }, [request, start])

  useEffect(() => {
    // Fetched alongside playback rather than before it. Rendering thumbnails
    // decodes the whole file, which on a long film takes longer than starting
    // the stream; making playback wait for previews would be the wrong trade.
    let abandoned = false

    setTrickplay(null)
    setDetail(null)
    setSubtitleTracks([])
    setSelectedSubtitleId(SUBTITLES_OFF)
    setSegments([])
    setSelectedAudioIndex(null)

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

    void fetchSegments(media.id).then((found) => {
      if (!abandoned) {
        setSegments(found)
      }
    })

    void fetchSubtitleTracks(media.id).then((found) => {
      if (abandoned) {
        return
      }

      setSubtitleTracks(found)

      // What this viewer was last reading, in this file's own terms. A choice
      // made on one episode is a choice about a language, so it survives into
      // the next one rather than lapsing back to nothing every time.
      const remembered = readPlaybackPreferences().subtitleLanguage

      if (remembered === SUBTITLES_OFF) {
        setSelectedSubtitleId(SUBTITLES_OFF)

        return
      }

      const continuing = trackForLanguage(found, remembered)

      setSelectedSubtitleId(continuing === null ? defaultTrackId(found) : continuing.id)
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

    writePlaybackPreferences({ volume, isMuted })
  }, [volume, isMuted])

  useEffect(() => {
    const element = videoRef.current

    if (element !== null) {
      element.playbackRate = playbackRate
    }
    // Reapplied when the session changes: a new media element source resets
    // the rate, and a viewer who chose half speed did not mean until the next
    // seek.
  }, [playbackRate, session])

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
  }, [isPlaying, activity])

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
      setRequest({
        mediaId: request.mediaId,
        startSeconds: Math.floor(seconds),
        requestedQuality: request.requestedQuality,
        ...(request.audioStreamIndex === undefined
          ? {}
          : { audioStreamIndex: request.audioStreamIndex }),
      })
    },
    [request, session],
  )

  useEffect(() => {
    saveCaptionStyle(captionStyle)
  }, [captionStyle])

  const selectedTrack = subtitleTracks.find((track) => track.id === selectedSubtitleId) ?? null

  /**
   * Takes a viewer at their word about subtitles.
   *
   * Their choice is kept as a language, which is the part of it that means
   * anything to the next episode. Turning them off is kept too, and kept
   * distinctly from never having said: one is an instruction, the other is
   * only silence.
   */
  const chooseSubtitle = useCallback(
    (trackId: string) => {
      setSelectedSubtitleId(trackId)

      const chosen = subtitleTracks.find((track) => track.id === trackId) ?? null

      writePlaybackPreferences({
        subtitleLanguage: trackId === SUBTITLES_OFF ? SUBTITLES_OFF : (chosen?.language ?? null),
      })
    },
    [subtitleTracks],
  )

  const availableQualitySteps = detail === null ? [] : listAvailableQualitySteps(detail)
  const skippable = state === 'playing' ? skippableAt(segments, position) : null

  const audioTracks = (detail?.audioStreams ?? []).map((stream, position) => ({
    index: stream.index,
    label: describeAudioTrack(
      {
        index: stream.index,
        codec: stream.codec,
        channels: stream.channels,
        language: stream.language,
        title: stream.title,
        isAtmos: stream.isAtmos,
        isDefault: stream.isDefault,
      },
      position + 1,
    ),
  }))

  // Switching track means a new session, and a viewer who is forty minutes in
  // expects to stay there rather than start again.
  const changeAudio = useCallback(
    (streamIndex: number) => {
      const element = videoRef.current

      if (element !== null) {
        setHeldFrame(captureFrame(element, document.createElement('canvas')))
      }

      setSelectedAudioIndex(streamIndex)
      setRequest({
        mediaId: request.mediaId,
        startSeconds: Math.floor(position),
        audioStreamIndex: streamIndex,
        requestedQuality: request.requestedQuality,
      })
    },
    [request.mediaId, request.requestedQuality, position],
  )

  // A different quality is a different transcode, so — like changing the
  // audio track — it means a new session rather than adjusting this one.
  const changeQuality = useCallback(
    (quality: QualityPreference) => {
      const element = videoRef.current

      if (element !== null) {
        setHeldFrame(captureFrame(element, document.createElement('canvas')))
      }

      saveQualityPreference(quality)
      setRequest({
        mediaId: request.mediaId,
        startSeconds: Math.floor(position),
        requestedQuality: quality,
        ...(request.audioStreamIndex === undefined
          ? {}
          : { audioStreamIndex: request.audioStreamIndex }),
      })
    },
    [request.mediaId, request.audioStreamIndex, position],
  )

  useEffect(() => {
    if (state !== 'playing' || duration <= 0) {
      return
    }

    // Reported on a timer rather than on every position change: a timeupdate
    // fires several times a second, and a bookmark does not need that.
    const report = () => {
      const element = videoRef.current

      if (element === null) {
        return
      }

      const at = request.startSeconds + element.currentTime

      void reportWatchProgress(media.id, {
        positionSeconds: at,
        durationSeconds: duration,
        isFinished: at >= duration - FINISHED_WITHIN_SECONDS,
      })
    }

    const timer = setInterval(report, REPORT_EVERY_MILLISECONDS)

    // Also on the way out, so closing a film records where it was left rather
    // than losing up to a whole interval of it.
    return () => {
      clearInterval(timer)
      report()
    }
  }, [state, duration, media.id, request.startSeconds])

  /**
   * Moves by a single frame of the film.
   *
   * Done to the element rather than through a seek, because one frame is
   * always inside what has already been decoded: asking the server for a new
   * session to move a fortieth of a second would throw away the stream to
   * land on the next picture in it.
   */
  const stepFrame = useCallback((direction: number) => {
    const element = videoRef.current

    if (element === null) {
      return
    }

    // Stepping is something done to a still picture. A frame examined while
    // the film is running has gone by before it can be looked at.
    element.pause()

    const at = element.currentTime + direction * frameSecondsRef.current
    const last = Number.isFinite(element.duration) ? element.duration : at

    element.currentTime = Math.min(Math.max(at, 0), last)
  }, [])

  const skip = useCallback(
    (delta: number) => {
      seek(Math.min(Math.max(position + delta, 0), duration))
    },
    [seek, position, duration],
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

  // What one frame of this film is worth, taken from the film. Two consecutive
  // frames are enough: the gap between the moments they cover is the frame
  // duration, which is the only number that makes an arrow key land on the
  // next picture rather than near it.
  useEffect(() => {
    const element = videoRef.current

    if (element === null || !('requestVideoFrameCallback' in element)) {
      return
    }

    let handle = 0
    let previous: number | null = null

    const measure = (_now: number, metadata: { mediaTime: number }) => {
      if (previous !== null) {
        const gap = metadata.mediaTime - previous

        // A gap of nothing is the same frame reported twice, and a gap of a
        // second is a stall rather than a frame rate.
        if (gap > 0 && gap < 1) {
          frameSecondsRef.current = gap

          return
        }
      }

      previous = metadata.mediaTime
      handle = element.requestVideoFrameCallback(measure)
    }

    handle = element.requestVideoFrameCallback(measure)

    return () => {
      element.cancelVideoFrameCallback(handle)
    }
  }, [session])

  // Focus lands on the film itself when the player opens. The shortcuts listen
  // on the window either way, but focus left behind on whatever was pressed to
  // get here means the browser's own handling of space and the arrows fires
  // first — which is why they appeared to do nothing until the picture had
  // been clicked on.
  useEffect(() => {
    if (isImmersive) {
      stageRef.current?.focus({ preventScroll: true })
    }
  }, [isImmersive, media.id])

  useEffect(() => {
    if (!isImmersive) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // A viewer driving from the keyboard is not idle either, and the pointer
      // never moves to say so.
      setIsIdle(false)
      setActivity((count) => count + 1)

      const target = event.target

      // Anything typed into a field belongs to that field. Space in a search
      // box is a space, not a pause.
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      const shortcuts: Record<string, () => void> = {
        ' ': togglePlay,
        k: togglePlay,
        ArrowLeft: () => {
          stepFrame(-1)
        },
        ArrowRight: () => {
          stepFrame(1)
        },
        j: () => {
          skip(-JUMP_SECONDS)
        },
        l: () => {
          skip(JUMP_SECONDS)
        },
        f: toggleFullscreen,
        m: () => {
          setIsMuted((muted) => !muted)
        },
        c: () => {
          setSelectedSubtitleId((current) =>
            current === SUBTITLES_OFF ? (subtitleTracks[0]?.id ?? SUBTITLES_OFF) : SUBTITLES_OFF,
          )
        },
      }

      const act = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key]

      if (act === undefined) {
        return
      }

      // Space scrolls a page and arrows move a scrollbar. Neither is what
      // someone watching a film meant.
      event.preventDefault()
      act()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isImmersive, togglePlay, stepFrame, toggleFullscreen, subtitleTracks])

  useEffect(() => {
    if (!isImmersive) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isFullscreen) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isImmersive, isFullscreen, onClose])

  return (
    <section className={isImmersive ? 'flex h-full flex-col' : 'flex flex-col gap-3'}>
      <header
        className={
          isImmersive
            ? `absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 text-white transition-opacity ${
                isIdle && !isShowingStats ? 'opacity-0' : 'opacity-100'
              }`
            : 'flex items-center justify-between gap-4'
        }
      >
        <h2 className={isImmersive ? 'text-lg font-medium' : 'text-lg font-medium text-text'}>
          {media.title}
        </h2>

        {/* The same glass as the bar at the bottom, and no word on it: an X
            in the corner of a film needs no label, and the one it had made the
            corner of the picture look like a page. */}
        <IconButton label="Close" onClick={onClose} size="md" className="flux-glass text-white">
          <IconX size={20} aria-hidden />
        </IconButton>
      </header>

      <div
        ref={stageRef}
        // Focusable, and focused on arrival, so the shortcuts work without
        // being clicked on first. A viewer who has just navigated to a film
        // has already said what they want to interact with.
        tabIndex={-1}
        // The pointer goes with the controls: a cursor sitting over a film is
        // as much of an intrusion as a bar of buttons is.
        // `min-h-0` is what keeps the controls on screen. A flex child will
        // not shrink below the size of its content by default, so a tall video
        // grows the stage past the bottom of the window and takes the controls
        // — which sit inside it — with it.
        className={`${
          isImmersive
            ? 'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black'
            : 'relative overflow-hidden rounded-lg bg-black'
        } ${
          isIdle && !isShowingStats && !isEditingCaptions ? 'cursor-none' : 'cursor-default'
        } outline-none`}
        onPointerMove={() => {
          setIsIdle(false)
          setActivity((count) => count + 1)
        }}
        onPointerLeave={() => {
          setIsIdle(isPlaying)
        }}
      >
        <VideoSurface
          label={media.title}
          videoRef={videoRef}
          className={isImmersive ? 'h-full w-full object-contain' : ''}
          {...(selectedTrack === null
            ? {}
            : {
                textTrack: {
                  id: selectedTrack.id,
                  label: selectedTrack.label,
                  language: selectedTrack.language ?? 'und',
                  // Asked for as the stream sees them: a session that began
                  // partway in is a video whose clock starts at zero, and the
                  // cues have to be moved to match it.
                  src: subtitleTrackUrl(media.id, selectedTrack.id, request.startSeconds),
                },
              })}
          onTimeUpdate={(seconds) => {
            const at = request.startSeconds + seconds

            setPosition(at)
            setHeldFrame(null)
            onProgress?.(at, duration)
          }}
          onDurationChange={setReportedDuration}
          onPlayingChange={setIsPlaying}
          onEnded={() => {
            // Watched to the end, said before anything else happens: whoever
            // owns the player may put another episode on, and it should not
            // then be told the previous one stopped partway through.
            onProgress?.(duration, duration)
            onEnded?.()
          }}
        />

        {/* While the film is floating in its own window the page shows that
            rather than the same picture twice. The video itself keeps
            rendering underneath, because the floating copy is drawn from it —
            it is covered, not stopped. */}
        {!isPoppedOut ? null : (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black text-center">
            <IconPictureInPicture size={32} className="text-text-muted" aria-hidden />

            <p className="text-sm text-text-muted">Playing in a floating window</p>

            <Button variant="secondary" size="sm" isPill onClick={popOut}>
              Bring it back
            </Button>
          </div>
        )}

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

        {/* Applied as a stylesheet because ::cue cannot be reached from an
            inline style: the cues live in a shadow tree the page cannot
            address any other way. */}
        <style>{`::cue { ${toCueCss(captionStyle)} }`}</style>

        {isEditingCaptions ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end">
            <CaptionSettings
              style={captionStyle}
              onChange={setCaptionStyle}
              onReset={() => {
                setCaptionStyle(DEFAULT_CAPTION_STYLE)
              }}
              onClose={() => {
                setIsEditingCaptions(false)
              }}
            />
          </div>
        ) : null}

        {/* Under the title rather than opposite it: these are notes about what
            is playing, and they belong beside its name. */}
        {isShowingStats ? (
          <div className="pointer-events-none absolute inset-x-3 top-16 flex justify-start">
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

        {skippable === null ? null : (
          <div className="absolute bottom-24 right-6 z-10">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full px-6 shadow-lg"
              onClick={() => {
                seek(skippable.endSeconds)
              }}
            >
              {describeSkip(skippable)}
              <IconPlayerTrackNext size={18} fill="currentColor" aria-hidden />
            </Button>
          </div>
        )}

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
            playbackRate={playbackRate}
            subtitleTracks={subtitleTracks}
            selectedSubtitleId={selectedSubtitleId}
            audioTracks={audioTracks}
            selectedAudioIndex={selectedAudioIndex}
            availableQualitySteps={availableQualitySteps}
            selectedQuality={request.requestedQuality}
            isDisabled={state !== 'playing'}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSkip={skip}
            onPlaybackRateChange={setPlaybackRate}
            onSubtitleChange={chooseSubtitle}
            onAudioChange={changeAudio}
            onQualityChange={changeQuality}
            onEditCaptions={() => {
              setIsEditingCaptions((editing) => !editing)
            }}
            onVolumeChange={(next) => {
              setVolume(next)
              setIsMuted(next === 0)
            }}
            onToggleMute={() => {
              setIsMuted((muted) => !muted)
            }}
            onToggleFullscreen={toggleFullscreen}
            {...(canPopOut ? { onPopOut: popOut } : {})}
            onToggleStats={() => {
              setIsShowingStats((showing) => !showing)
            }}
            subtitleOffsetSeconds={subtitleOffset}
            onSubtitleOffsetChange={setSubtitleOffset}
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
