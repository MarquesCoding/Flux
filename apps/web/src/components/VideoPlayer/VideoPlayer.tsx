import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  RiAlertLine,
  RiCastLine,
  RiCloseLine,
  RiPictureInPicture2Line,
  RiSkipForwardFill,
} from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Spinner } from '@FluxUI/Spinner';
import { VideoSurface } from '@FluxUI/VideoSurface';
import { detectFromBrowser } from '@FluxWeb/playback/detectDeviceProfile';
import { detectFromNavigator } from '@FluxWeb/playback/detectClientLabel';
import { readClientId } from '@FluxWeb/presence/clientIdentity';
import { onPresenceEvent } from '@FluxWeb/presence/presenceEvents';
import {
  startPlaybackSession,
  stopPlaybackSession,
  stopWatching,
  heartbeatPlaybackSession,
  sendPresenceHeartbeat,
} from '@FluxWeb/playback/startPlaybackSession';
import { attachShaka, CRITICAL } from '@FluxWeb/playback/attachShaka';
import {
  describePlaybackFailure,
  PlaybackEngineErrorSchema,
} from '@FluxWeb/playback/describePlaybackFailure';
import {
  watchCastState,
  isReachableOrigin,
  promptForDevice,
  absoluteStreamUrl,
} from '@FluxWeb/playback/castPlayback';
import { handOverToDevice } from '@FluxWeb/playback/handOverToDevice';
import { loadCastSender, castStateOf, castStream } from '@FluxWeb/playback/castSender';
import { fetchTrickplay } from '@FluxWeb/playback/fetchTrickplay';
import { popOutWithCaptions } from '@FluxWeb/playback/popOutWithCaptions';
import { captureFrame } from '@FluxWeb/playback/captureFrame';
import { readPlaybackHealth } from '@FluxWeb/playback/readPlaybackHealth';
import {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  defaultTrackId,
  trackForLanguage,
  SUBTITLES_OFF,
} from '@FluxWeb/playback/fetchSubtitles';
import {
  toCueCss,
  readCaptionStyle,
  saveCaptionStyle,
  DEFAULT_CAPTION_STYLE,
} from '@FluxWeb/playback/captionStyle';
import { readQualityPreference, saveQualityPreference } from '@FluxWeb/playback/qualityPreference';
import { fetchSegments, skippableAt, describeSkip } from '@FluxWeb/playback/fetchSegments';
import { reportWatchProgress, REPORT_EVERY_MILLISECONDS } from '@FluxWeb/playback/watchProgress';
import {
  readPlaybackPreferences,
  writePlaybackPreferences,
} from '@FluxWeb/playback/playbackPreferences';
import { liftCues, CUE_LINE_CLEAR, CUE_LINE_ABOVE_CONTROLS } from '@FluxWeb/playback/liftCues';
import { describeAudioTrack } from '@FluxCore/functions/describeTrack';
import { listAvailableQualitySteps } from '@FluxCore/functions/listAvailableQualitySteps';
import { fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
import { TrickplayPreview } from './components/TrickplayPreview/TrickplayPreview';
import { PlayerControls } from './components/PlayerControls/PlayerControls';
import { StreamStats } from './components/StreamStats/StreamStats';
import { AdminMessageOverlay } from './components/AdminMessageOverlay/AdminMessageOverlay';
import type { Trickplay } from '@FluxWeb/playback/fetchTrickplay';
import type { PoppedOut } from '@FluxWeb/playback/popOutWithCaptions';
import type { CastState } from '@FluxWeb/playback/castPlayback.types';
import type { CastContext } from '@FluxWeb/playback/castSender.types';
import type { StartedSession } from '@FluxWeb/playback/startPlaybackSession';
import type { MediaDetail } from '@FluxContracts/schemas/Library';
import type { SubtitleTrack } from '@FluxWeb/playback/fetchSubtitles';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';
import type { PlaybackHealth } from './components/StreamStats/StreamStats.types';
import type { QualityPreference } from '@FluxWeb/playback/qualityPreference';
import type { PlayerState, VideoPlayerProps } from './VideoPlayer.types';

/**
 * An element that may be able to go full screen.
 *
 * Declared optional because the DOM types promise a fullscreen API that not
 * every browser ships.
 */
type FullscreenTarget = {
  requestFullscreen?: () => Promise<void>;
};

type FullscreenOwner = {
  exitFullscreen?: () => Promise<void>;
};

const IDLE_MILLISECONDS = 2500;

/**
 * How long the casting note stays up before taking itself away.
 *
 * Long enough to read twice, since it explains something to go and do rather
 * than merely reporting. It answers a press that has already happened, so
 * there is nothing to dismiss and nobody waiting on it — left up it becomes
 * part of the picture, and the next press has no way to say anything new.
 */
const CAST_NOTE_MILLISECONDS = 6000;

/**
 * How far a jump moves.
 *
 * The arrows step a frame at a time, which is for looking at something. This
 * is for getting past it: thirty seconds is a scene, and the buttons on the
 * bar do ten.
 */
const JUMP_SECONDS = 30;

/**
 * How close to the end counts as finished.
 *
 * Credits run for minutes, and someone who stops during them has watched the
 * film. Offering to resume it would be offering them the credits.
 */
const FINISHED_WITHIN_SECONDS = 90;

const HEALTH_INTERVAL_MILLISECONDS = 500;

/**
 * How often the player tells the server a session is still wanted.
 *
 * Sent regardless of pause state — the server's idle timeout allows three
 * missed heartbeats, so this has to be well under a third of that to give a
 * genuine hiccup room to recover before a session is reaped.
 */
const HEARTBEAT_INTERVAL_MILLISECONDS = 30_000;

/**
 * How often presence is told where this tab actually is in the film.
 *
 * Much faster than the liveness heartbeat above: that one only has to arrive
 * before the idle reaper's patience runs out, but an admin watching a
 * progress bar notices anything slower than about a second, and a scrub
 * jumps the position outside the normal rate of change entirely.
 */
const PRESENCE_HEALTH_INTERVAL_MILLISECONDS = 1000;

/**
 * How long to let a change settle before asking for the cue again.
 *
 * Long enough that dragging a slider is one redraw at the end rather than
 * thirty on the way, short enough that letting go and looking at the result
 * feels like the same action.
 */
const REDRAW_AFTER_MILLISECONDS = 150;

/**
 * How long a frame lasts until the film says otherwise.
 *
 * Twenty five a second, which is wrong for most things and close enough for
 * all of them: it is only used for the first press, before two frames have
 * gone past to be measured.
 */
const DEFAULT_FRAME_SECONDS = 1 / 25;

/**
 * How long to wait before asking a stalled stream again.
 */
const START_RETRY_MILLISECONDS = 1500;

/**
 * How many times that is worth doing.
 *
 * A few seconds of trying, and then the picture is somebody else's problem:
 * a player that retries forever is a player that hides a broken file.
 */
const START_ATTEMPTS = 4;

/**
 * Stops a session that nobody is waiting for any more.
 *
 * The effect's cleanup stops whatever `startedId` holds, but a session started
 * while the viewer was already seeking away was not in that variable when the
 * cleanup ran — it did not exist yet, because the request was still in flight.
 * Returning without this leaves the server transcoding the rest of the film
 * for nobody until its idle timer collects the session ninety seconds later,
 * and quick scrubbing leaves one behind per seek.
 */
const abandonStartedSession = (sessionId: string) => {
  void stopPlaybackSession(sessionId);
};

const EMPTY_HEALTH: PlaybackHealth = {
  positionSeconds: 0,
  bufferedAheadSeconds: 0,
  encodedSeconds: 0,
  droppedFrames: null,
  decodedFrames: null,
  presentedWidth: 0,
  presentedHeight: 0,
};

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
  episodes = [],
  onSelectEpisode,
  watchedFractionFor,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const startTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameSecondsRef = useRef(DEFAULT_FRAME_SECONDS);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [state, setState] = useState<PlayerState>('starting');
  const [problem, setProblem] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<{
    kind: 'stopped' | 'paused';
    reason: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [reportedDuration, setReportedDuration] = useState(0);
  const [trickplay, setTrickplay] = useState<Trickplay | null>(null);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [volume, setVolume] = useState(() => readPlaybackPreferences().volume);
  const [isMuted, setIsMuted] = useState(() => readPlaybackPreferences().isMuted);
  const [isShowingRemaining, setIsShowingRemaining] = useState(
    () => readPlaybackPreferences().showsRemaining,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShowingStats, setIsShowingStats] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [health, setHealth] = useState<PlaybackHealth>(EMPTY_HEALTH);
  const [isIdle, setIsIdle] = useState(false);
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const [activity, setActivity] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(SUBTITLES_OFF);
  const [captionStyle, setCaptionStyle] = useState(readCaptionStyle);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const appliedOffsetRef = useRef(0);
  const [segments, setSegments] = useState<MediaSegment[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null);
  const [request, setRequest] = useState<{
    mediaId: string;
    startSeconds: number;
    audioStreamIndex?: number;
    requestedQuality: QualityPreference;
  }>({
    mediaId: media.id,
    startSeconds: Math.floor(startSeconds),
    requestedQuality: readQualityPreference(),
  });
  const [heldFrame, setHeldFrame] = useState<{ url: string; isItemChange: boolean } | null>(null);

  const canPopOut = typeof document !== 'undefined' && document.pictureInPictureEnabled === true;

  const poppedRef = useRef<PoppedOut | null>(null);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [castState, setCastState] = useState<CastState>('unavailable');
  const [castNote, setCastNote] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (castNote === null) {
      return;
    }

    const goes = setTimeout(() => {
      setCastNote(null);
    }, CAST_NOTE_MILLISECONDS);

    return () => {
      clearTimeout(goes);
    };
  }, [castNote]);
  const releaseRef = useRef<(() => Promise<void>) | null>(null);
  const castContextRef = useRef<CastContext | null>(null);

  const popOut = useCallback(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    if (document.pictureInPictureElement !== null) {
      poppedRef.current?.stop();
      poppedRef.current = null;
      setIsPoppedOut(false);

      void document.exitPictureInPicture().catch(() => {});

      return;
    }

    void (async () => {
      const withCaptions = Array.from(element.textTracks).some((track) => track.mode !== 'disabled')
        ? await popOutWithCaptions(element)
        : null;

      if (withCaptions !== null) {
        poppedRef.current = withCaptions;
        setIsPoppedOut(true);

        return;
      }

      await element.requestPictureInPicture().catch(() => {});
    })();
  }, []);

  useEffect(
    () => () => {
      poppedRef.current?.stop();
      poppedRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    const shift = subtitleOffset - appliedOffsetRef.current;

    if (shift === 0) {
      return;
    }

    let moved = false;

    for (const track of Array.from(element.textTracks)) {
      for (const cue of Array.from(track.cues ?? [])) {
        cue.startTime = Math.max(0, cue.startTime + shift);
        cue.endTime = Math.max(0, cue.endTime + shift);
        moved = true;
      }
    }

    if (moved) {
      appliedOffsetRef.current = subtitleOffset;
    }
  }, [subtitleOffset, selectedSubtitleId, position]);

  useEffect(() => {
    let isAbandoned = false;

    void loadCastSender().then((context) => {
      if (isAbandoned || context === null) {
        return;
      }

      castContextRef.current = context;

      const said = () => {
        const state = castStateOf(context);

        setCastState(
          state === 'CONNECTED' ? 'connected' : state === 'CONNECTING' ? 'connecting' : 'available',
        );
      };

      const framework = window.cast?.framework;

      if (framework !== undefined) {
        context.addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, said);
      }

      said();
    });

    return () => {
      isAbandoned = true;
    };
  }, []);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    return watchCastState(element, setCastState);
  }, []);

  useEffect(() => {
    if (castState !== 'connected') {
      return;
    }

    const element = videoRef.current;

    if (element === null || session === null) {
      return;
    }

    const address =
      session.delivery.kind === 'direct' ? session.delivery.url : session.delivery.manifestUrl;

    const context = castContextRef.current;

    if (context !== null) {
      const whole = absoluteStreamUrl(address, window.location.origin);

      if (whole !== null) {
        void castStream(context, {
          url: whole,
          title: media.title,
          startSeconds: element.currentTime,
        }).then((accepted) => {
          if (accepted) {
            element.pause();

            return;
          }

          setCastNote('That device would not take this stream.');
        });
      }

      return;
    }

    void handOverToDevice({
      element,
      url: address,
      origin: window.location.origin,
      ...(releaseRef.current === null
        ? {}
        : {
            release: async () => {
              await releaseRef.current?.();
              releaseRef.current = null;
            },
          }),
    });
  }, [castState, session]);

  const wasCastingRef = useRef(false);

  useEffect(() => {
    if (castState === 'connected') {
      wasCastingRef.current = true;

      return;
    }

    if (!wasCastingRef.current || castState === 'connecting') {
      return;
    }

    wasCastingRef.current = false;

    const element = videoRef.current;

    if (element === null || session === null || session.delivery.kind !== 'hls') {
      return;
    }

    const at = element.currentTime;

    void attachShaka({ element, manifestUrl: session.delivery.manifestUrl }).then((teardown) => {
      releaseRef.current = teardown;
      element.currentTime = at;
      start(element);
    });
  }, [castState, session]);

  useEffect(
    () => () => {
      void releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const onLeave = () => {
      poppedRef.current?.stop();
      poppedRef.current = null;
      setIsPoppedOut(false);
    };

    const onEnter = () => {
      setIsPoppedOut(true);
    };

    const element = videoRef.current;

    element?.addEventListener('enterpictureinpicture', onEnter);
    element?.addEventListener('leavepictureinpicture', onLeave);
    document.addEventListener('leavepictureinpicture', onLeave);

    return () => {
      element?.removeEventListener('enterpictureinpicture', onEnter);
      element?.removeEventListener('leavepictureinpicture', onLeave);
      document.removeEventListener('leavepictureinpicture', onLeave);

      poppedRef.current?.stop();
      poppedRef.current = null;

      if (document.pictureInPictureEnabled === true && document.pictureInPictureElement !== null) {
        void document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

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
    let attempts = 0;

    const attempt = () => {
      void element.play().catch(() => {});
    };

    attempt();

    clearInterval(startTimerRef.current ?? undefined);

    startTimerRef.current = setInterval(() => {
      attempts += 1;

      if (attempts > START_ATTEMPTS || element.readyState > 0 || !element.paused) {
        clearInterval(startTimerRef.current ?? undefined);
        startTimerRef.current = null;

        return;
      }

      element.load();
      attempt();
    }, START_RETRY_MILLISECONDS);
  }, []);

  /**
   * Keeps whatever is on screen on screen.
   *
   * Tearing a session down blanks the media element, so without this the
   * picture goes black between one stream and the next — which reads as the
   * player breaking rather than as a seek, or as the following episode.
   */
  const hold = useCallback((element: HTMLVideoElement | null, isItemChange = false) => {
    const url = element === null ? null : captureFrame(element, document.createElement('canvas'));

    if (url !== null) {
      setHeldFrame({ url, isItemChange });
    }
  }, []);

  useLayoutEffect(() => {
    const element = videoRef.current;

    if (element !== null && element.readyState > 1) {
      hold(element, true);
    }
  }, [media.id, hold]);

  if (request.mediaId !== media.id) {
    setRequest({
      mediaId: media.id,
      startSeconds: Math.floor(startSeconds),
      requestedQuality: request.requestedQuality,
    });
  }

  /**
   * Tells presence whether this tab is playing, and what it can measure
   * about the stream right now.
   *
   * Shared by the periodic heartbeat and the immediate one sent on every
   * play/pause and session change, so a track or quality change — which
   * tears the old session down and starts a new one — never leaves the
   * admin's progress bar without a position for up to a whole heartbeat
   * interval.
   */
  const reportPresenceHeartbeat = useCallback(
    (clientId: string) => {
      const current = videoRef.current;
      const playing = current !== null && !current.paused;

      if (current === null) {
        void sendPresenceHeartbeat(clientId, playing);

        return;
      }

      const measured = readPlaybackHealth(current);
      const totalDuration =
        media.durationSeconds > 0
          ? media.durationSeconds
          : Number.isFinite(current.duration)
            ? current.duration
            : 0;

      void sendPresenceHeartbeat(clientId, playing, {
        positionSeconds: measured.positionSeconds,
        durationSeconds: totalDuration,
        bufferedAheadSeconds: measured.bufferedAheadSeconds,
        presentedWidth: measured.presentedWidth,
        presentedHeight: measured.presentedHeight,
      });
    },
    [media.durationSeconds],
  );

  useEffect(() => {
    setSession(null);
    setState('starting');
    setProblem(null);
    setIsPlaying(false);
    setPosition(request.startSeconds);
    setReportedDuration(0);

    const controller = new AbortController();
    const isAbandoned = () => controller.signal.aborted;
    let teardown: (() => Promise<void>) | null = null;
    let startedId: string | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let presenceHealthInterval: ReturnType<typeof setInterval> | null = null;
    const clientId = readClientId();

    const onPageHide = () => {
      if (startedId !== null) {
        void fetch(`/api/playback/session/${startedId}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => undefined);
      }

      void stopWatching(clientId, true);
    };

    window.addEventListener('pagehide', onPageHide);

    const run = async () => {
      const outcome = await startPlaybackSession(
        request.mediaId,
        detectFromBrowser(detectFromNavigator()),
        clientId,
        request.startSeconds,
        request.audioStreamIndex,
        request.requestedQuality,
      );

      if (outcome.kind === 'failed') {
        if (!isAbandoned()) {
          setProblem(outcome.reason);
          setState('failed');
        }

        return;
      }

      startedId = outcome.session.sessionId;

      if (isAbandoned()) {
        abandonStartedSession(startedId);

        return;
      }
      setSession(outcome.session);

      const sessionId = startedId;
      const isHls = outcome.session.delivery.kind !== 'direct';

      heartbeatInterval = setInterval(() => {
        if (isHls) {
          const current = videoRef.current;
          const playing = current !== null && !current.paused;

          void heartbeatPlaybackSession(sessionId, playing);
        }
      }, HEARTBEAT_INTERVAL_MILLISECONDS);

      presenceHealthInterval = setInterval(() => {
        reportPresenceHeartbeat(clientId);
      }, PRESENCE_HEALTH_INTERVAL_MILLISECONDS);

      const element = videoRef.current;

      if (element === null) {
        return;
      }

      try {
        if (outcome.session.delivery.kind === 'direct') {
          element.src = outcome.session.delivery.url;
        } else {
          teardown = await attachShaka({
            element,
            manifestUrl: outcome.session.delivery.manifestUrl,
            onFault: (fault) => {
              if (fault.severity < CRITICAL || isAbandoned()) {
                return;
              }

              setProblem(describePlaybackFailure(fault.category));
              setState('failed');
            },
          });

          releaseRef.current = teardown;
        }

        if (request.startSeconds > 0) {
          element.currentTime = request.startSeconds;
        }

        if (!isAbandoned()) {
          setState('playing');

          start(element);
        }
      } catch (error) {
        if (!isAbandoned()) {
          const engine = PlaybackEngineErrorSchema.safeParse(error);

          setProblem(describePlaybackFailure(engine.success ? engine.data.category : null));
          setState('failed');
        }
      }
    };

    void run();

    return () => {
      controller.abort();
      window.removeEventListener('pagehide', onPageHide);
      clearInterval(startTimerRef.current ?? undefined);
      startTimerRef.current = null;
      clearInterval(heartbeatInterval ?? undefined);
      clearInterval(presenceHealthInterval ?? undefined);
      void teardown?.();
      releaseRef.current = null;

      if (startedId !== null) {
        void stopPlaybackSession(startedId);
      }
    };
  }, [request, start]);

  useEffect(
    () =>
      onPresenceEvent((event) => {
        const element = videoRef.current;

        if (event.kind === 'stopped') {
          element?.pause();
          setAdminMessage({ kind: 'stopped', reason: event.reason });

          return;
        }

        if (event.kind === 'paused') {
          element?.pause();
          setAdminMessage({ kind: 'paused', reason: event.reason });

          return;
        }

        setAdminMessage((current) => (current?.kind === 'paused' ? null : current));
        void element?.play();
      }),
    [],
  );

  useEffect(() => {
    if (session === null) {
      return;
    }

    void sendPresenceHeartbeat(readClientId(), isPlaying);
  }, [isPlaying, session]);

  useEffect(
    () => () => {
      void stopWatching(readClientId());
    },
    [],
  );

  useEffect(() => {
    let abandoned = false;

    setTrickplay(null);
    setDetail(null);
    setSubtitleTracks([]);
    setSelectedSubtitleId(SUBTITLES_OFF);
    setSegments([]);
    setSelectedAudioIndex(null);

    void fetchTrickplay(media.id).then((found) => {
      if (!abandoned) {
        setTrickplay(found);
      }
    });

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found);
      }
    });

    void fetchSegments(media.id).then((found) => {
      if (!abandoned) {
        setSegments(found);
      }
    });

    void fetchSubtitleTracks(media.id).then((found) => {
      if (abandoned) {
        return;
      }

      setSubtitleTracks(found);

      const remembered = readPlaybackPreferences().subtitleLanguage;

      if (remembered === SUBTITLES_OFF) {
        setSelectedSubtitleId(SUBTITLES_OFF);

        return;
      }

      const continuing = trackForLanguage(found, remembered);

      setSelectedSubtitleId(continuing === null ? defaultTrackId(found) : continuing.id);
    });

    return () => {
      abandoned = true;
    };
  }, [media.id]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onChange);

    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    const element = videoRef.current;

    if (element !== null) {
      element.volume = volume;
      element.muted = isMuted;
    }

    writePlaybackPreferences({ volume, isMuted });
  }, [volume, isMuted]);

  useEffect(() => {
    const element = videoRef.current;

    if (element !== null) {
      element.playbackRate = playbackRate;
    }
  }, [playbackRate, session]);

  useEffect(() => {
    if (!isShowingStats) {
      return;
    }

    const sample = () => {
      const element = videoRef.current;

      if (element !== null) {
        setHealth(readPlaybackHealth(element));
      }
    };

    sample();

    const timer = setInterval(sample, HEALTH_INTERVAL_MILLISECONDS);

    return () => {
      clearInterval(timer);
    };
  }, [isShowingStats]);

  useEffect(() => {
    if (!isPlaying) {
      setIsIdle(false);

      return;
    }

    const timer = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [isPlaying, activity]);

  const duration = media.durationSeconds > 0 ? media.durationSeconds : reportedDuration;

  const togglePlay = useCallback(() => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    if (element.paused) {
      void element.play();

      return;
    }

    element.pause();
  }, []);

  /**
   * Moves to a moment in the film.
   *
   * A seek is a seek. The playlist describes the whole film, so the timeline
   * the element is on is the film's own and every position on it is one the
   * element can be told to go to — the service decides whether that means
   * serving what it has or starting the transcode there.
   *
   * This used to branch on whether the target was inside what had been
   * encoded, and start a new session for anywhere else, which is what made
   * seeking cost a transcode of the rest of the film.
   */
  const seek = useCallback((seconds: number) => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    setPosition(seconds);

    element.currentTime = seconds;
  }, []);

  useEffect(() => {
    saveCaptionStyle(captionStyle);
  }, [captionStyle]);

  const selectedTrack = subtitleTracks.find((track) => track.id === selectedSubtitleId) ?? null;

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
      setSelectedSubtitleId(trackId);

      const chosen = subtitleTracks.find((track) => track.id === trackId) ?? null;

      writePlaybackPreferences({
        subtitleLanguage: trackId === SUBTITLES_OFF ? SUBTITLES_OFF : (chosen?.language ?? null),
      });
    },
    [subtitleTracks],
  );

  const availableQualitySteps = detail === null ? [] : listAvailableQualitySteps(detail);
  const skippable = state === 'playing' ? skippableAt(segments, position) : null;

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
  }));

  const changeAudio = useCallback(
    (streamIndex: number) => {
      const element = videoRef.current;

      hold(element);

      setSelectedAudioIndex(streamIndex);
      setRequest({
        mediaId: request.mediaId,
        startSeconds: Math.floor(position),
        audioStreamIndex: streamIndex,
        requestedQuality: request.requestedQuality,
      });
    },
    [request.mediaId, request.requestedQuality, position],
  );

  const changeQuality = useCallback(
    (quality: QualityPreference) => {
      const element = videoRef.current;

      hold(element);

      saveQualityPreference(quality);
      setRequest({
        mediaId: request.mediaId,
        startSeconds: Math.floor(position),
        requestedQuality: quality,
        ...(request.audioStreamIndex === undefined
          ? {}
          : { audioStreamIndex: request.audioStreamIndex }),
      });
    },
    [request.mediaId, request.audioStreamIndex, position],
  );

  useEffect(() => {
    if (state !== 'playing' || duration <= 0) {
      return;
    }

    const report = () => {
      const element = videoRef.current;

      if (element === null) {
        return;
      }

      const at = element.currentTime;

      void reportWatchProgress(media.id, {
        positionSeconds: at,
        durationSeconds: duration,
        isFinished: at >= duration - FINISHED_WITHIN_SECONDS,
      });
    };

    const timer = setInterval(report, REPORT_EVERY_MILLISECONDS);

    return () => {
      clearInterval(timer);
      report();
    };
  }, [state, duration, media.id]);

  /**
   * Moves by a single frame of the film.
   *
   * Done to the element rather than through a seek, because one frame is
   * always inside what has already been decoded: asking the server for a new
   * session to move a fortieth of a second would throw away the stream to
   * land on the next picture in it.
   */
  const stepFrame = useCallback((direction: number) => {
    const element = videoRef.current;

    if (element === null) {
      return;
    }

    element.pause();

    const at = element.currentTime + direction * frameSecondsRef.current;
    const last = Number.isFinite(element.duration) ? element.duration : at;

    element.currentTime = Math.min(Math.max(at, 0), last);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      seek(Math.min(Math.max(position + delta, 0), duration));
    },
    [seek, position, duration],
  );

  /**
   * The jump keys read the current skip through this rather than closing over
   * it.
   *
   * `skip` is rebuilt whenever the position changes, which is several times a
   * second while a film plays. The keyboard listener is registered once, so
   * whichever `skip` existed when it was registered is the one it keeps —
   * carrying a `position` of nought, from before anything had played. An hour
   * in, `l` jumped to 0:30 rather than 1:00:30.
   *
   * A ref rather than a dependency: naming `skip` in the effect's array would
   * fix the staleness by tearing the listener down and re-adding it on every
   * position change, several times a second, for the whole film.
   */
  const skipRef = useRef(skip);

  skipRef.current = skip;

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;

    if (stage === null) {
      return;
    }

    const owner: FullscreenOwner = document;
    const target: FullscreenTarget = stage;

    if (isFullscreen) {
      void owner.exitFullscreen?.();

      return;
    }

    void target.requestFullscreen?.();
  }, [isFullscreen]);

  const isBarUp = !isIdle || isShowingStats || isMenuOpen;
  const isBarUpRef = useRef(isBarUp);
  const cuesRef = useRef<{ stop: () => void; apply: () => void } | null>(null);

  isBarUpRef.current = isBarUp;

  useEffect(() => {
    const element = videoRef.current;

    if (element === null || selectedSubtitleId === SUBTITLES_OFF) {
      return;
    }

    const lifted = liftCues(element, () =>
      isBarUpRef.current ? CUE_LINE_ABOVE_CONTROLS : CUE_LINE_CLEAR,
    );

    cuesRef.current = lifted;

    return () => {
      cuesRef.current = null;
      lifted.stop();
    };
  }, [selectedSubtitleId, session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cuesRef.current?.apply();
    }, REDRAW_AFTER_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [isBarUp, captionStyle]);

  useEffect(() => {
    const element = videoRef.current;

    if (element === null || !('requestVideoFrameCallback' in element)) {
      return;
    }

    let handle = 0;
    let previous: number | null = null;

    const measure = (_now: number, metadata: { mediaTime: number }) => {
      if (previous !== null) {
        const gap = metadata.mediaTime - previous;

        if (gap > 0 && gap < 1) {
          frameSecondsRef.current = gap;

          return;
        }
      }

      previous = metadata.mediaTime;
      handle = element.requestVideoFrameCallback(measure);
    };

    handle = element.requestVideoFrameCallback(measure);

    return () => {
      element.cancelVideoFrameCallback(handle);
    };
  }, [session]);

  useEffect(() => {
    if (isImmersive) {
      stageRef.current?.focus({ preventScroll: true });
    }
  }, [isImmersive, media.id]);

  useEffect(() => {
    if (!isImmersive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      setIsIdle(false);
      setActivity((count) => count + 1);

      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const shortcuts: Record<string, () => void> = {
        ' ': togglePlay,
        k: togglePlay,
        ArrowLeft: () => {
          stepFrame(-1);
        },
        ArrowRight: () => {
          stepFrame(1);
        },
        j: () => {
          skipRef.current(-JUMP_SECONDS);
        },
        l: () => {
          skipRef.current(JUMP_SECONDS);
        },
        f: toggleFullscreen,
        m: () => {
          setIsMuted((muted) => !muted);
        },
        c: () => {
          setSelectedSubtitleId((current) =>
            current === SUBTITLES_OFF ? (subtitleTracks[0]?.id ?? SUBTITLES_OFF) : SUBTITLES_OFF,
          );
        },
      };

      const act = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key];

      if (act === undefined) {
        return;
      }

      event.preventDefault();
      act();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isImmersive, togglePlay, stepFrame, toggleFullscreen, subtitleTracks]);

  useEffect(() => {
    if (!isImmersive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isFullscreen) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isImmersive, isFullscreen, onClose]);

  return (
    <section
      className={isImmersive ? 'relative flex h-full flex-col' : 'flex flex-col gap-3'}
      onPointerMove={(event) => {
        const last = pointRef.current;

        if (last !== null && last.x === event.clientX && last.y === event.clientY) {
          return;
        }

        pointRef.current = { x: event.clientX, y: event.clientY };

        setIsIdle(false);
        setActivity((count) => count + 1);
      }}
      onPointerLeave={() => {
        pointRef.current = null;
        setIsIdle(isPlaying);
      }}
    >
      <header
        className={
          isImmersive
            ? `absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 text-white transition-transform duration-500 ease-out ${
                isBarUp ? 'translate-y-0' : '-translate-y-full'
              }`
            : 'flex items-center justify-between gap-4'
        }
      >
        <h2 className={isImmersive ? 'text-lg font-medium' : 'text-lg font-medium text-text'}>
          {media.title}
        </h2>

        <Button isIconOnly variant="overlay" label="Close" onClick={onClose} size="md">
          <RiCloseLine size={20} aria-hidden />
        </Button>
      </header>

      <div
        ref={stageRef}
        tabIndex={-1}
        className={`${
          isImmersive
            ? 'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black'
            : 'relative overflow-hidden rounded-lg bg-black'
        } ${isIdle && !isShowingStats && !isMenuOpen ? 'cursor-none' : 'cursor-default'} outline-none`}
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
                  src: subtitleTrackUrl(media.id, selectedTrack.id),
                },
              })}
          onTimeUpdate={(seconds) => {
            const at = seconds;

            setPosition(at);
            setHeldFrame(null);
            onProgress?.(at, duration);
          }}
          onDurationChange={setReportedDuration}
          onPlayingChange={setIsPlaying}
          onEnded={() => {
            onProgress?.(duration, duration);
            onEnded?.();
          }}
        />

        {!isPoppedOut ? null : (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black text-center">
            <RiPictureInPicture2Line size={32} className="text-text-muted" aria-hidden />

            <p className="text-sm text-text-muted">Playing in a floating window</p>

            <Button variant="secondary" size="sm" isPill onClick={popOut}>
              Bring it back
            </Button>
          </div>
        )}

        {adminMessage === null ? null : (
          <AdminMessageOverlay
            kind={adminMessage.kind}
            reason={adminMessage.reason}
            onDismiss={() => {
              const wasStopped = adminMessage.kind === 'stopped';

              setAdminMessage(null);

              if (wasStopped) {
                onClose();
              }
            }}
          />
        )}

        <AnimatePresence>
          {castNote === null ? null : (
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
              transition={{ duration: prefersReducedMotion === true ? 0 : 0.22, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4"
            >
              <p className="flux-glass max-w-md rounded-2xl px-4 py-2 text-center text-sm text-white">
                {castNote}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {castState !== 'connected' ? null : (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black text-center">
            <RiCastLine size={32} className="text-text-muted" aria-hidden />

            <p className="text-sm text-text-muted">Playing on another device</p>

            <p className="max-w-xs text-xs text-text-muted/70">
              The controls below still work. Stopping the cast from the device brings it back here.
            </p>
          </div>
        )}

        {heldFrame === null ? null : (
          <div
            role="presentation"
            className="pointer-events-none absolute inset-0 bg-black bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heldFrame.url})` }}
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
              label={
                heldFrame === null
                  ? 'Preparing playback'
                  : heldFrame.isItemChange
                    ? 'Loading the next episode'
                    : 'Changing the stream'
              }
              size={heldFrame === null ? 'lg' : 'sm'}
            />
          </div>
        ) : null}

        <style>{`::cue { ${toCueCss(captionStyle)} }`}</style>

        {isShowingStats ? (
          <div className="pointer-events-none absolute inset-x-3 top-16 flex justify-start">
            <StreamStats
              media={media}
              session={session}
              detail={detail}
              health={health}
              sessionStartSeconds={request.startSeconds}
              onClose={() => {
                setIsShowingStats(false);
              }}
            />
          </div>
        ) : null}

        {skippable === null ? null : (
          <div className="absolute bottom-24 right-6 z-10">
            <Button
              size="lg"
              variant="secondary"
              isPill
              className="px-6 shadow-lg"
              onClick={() => {
                seek(skippable.endSeconds);
              }}
            >
              {describeSkip(skippable)}
              <RiSkipForwardFill size={18} aria-hidden />
            </Button>
          </div>
        )}

        <div
          className={`absolute inset-x-3 bottom-3 transition-transform duration-500 ease-out ${
            isBarUp ? 'translate-y-0' : 'translate-y-[calc(100%_+_1.5rem)]'
          }`}
        >
          <PlayerControls
            title={media.title}
            playingId={media.id}
            episodes={episodes}
            {...(onSelectEpisode === undefined ? {} : { onSelectEpisode })}
            {...(watchedFractionFor === undefined ? {} : { watchedFractionFor })}
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
            onMenuOpenChange={setIsMenuOpen}
            isShowingRemaining={isShowingRemaining}
            onToggleTimeDisplay={() => {
              setIsShowingRemaining((showing) => {
                writePlaybackPreferences({ showsRemaining: !showing });

                return !showing;
              });
            }}
            captionStyle={captionStyle}
            onCaptionStyleChange={setCaptionStyle}
            onCaptionStyleReset={() => {
              setCaptionStyle(DEFAULT_CAPTION_STYLE);
            }}
            onVolumeChange={(next) => {
              setVolume(next);
              setIsMuted(next === 0);
            }}
            onToggleMute={() => {
              setIsMuted((muted) => !muted);
            }}
            onToggleFullscreen={toggleFullscreen}
            castState={castState}
            onCast={() => {
              const element = videoRef.current;

              if (element === null) {
                return;
              }

              if (!isReachableOrigin(window.location.origin)) {
                setCastNote(
                  'Open Flux at its address on the network rather than as localhost, so a device has somewhere to fetch from.',
                );

                return;
              }

              setCastNote(null);

              const context = castContextRef.current;

              if (context !== null) {
                void context.requestSession().catch(() => {});

                return;
              }

              void promptForDevice(element).then((outcome) => {
                if (outcome === 'shown' || outcome === 'dismissed') {
                  return;
                }

                setCastNote(
                  window.location.protocol === 'https:'
                    ? 'This browser offered no device. Safari casts to AirPlay receivers; Chrome needs the extension that backs casting.'
                    : 'This browser only casts over a secure connection. Serve Flux over HTTPS, or use Safari, which will cast from here as it is.',
                );
              });
            }}
            {...(canPopOut ? { onPopOut: popOut } : {})}
            isPoppedOut={isPoppedOut}
            onToggleStats={() => {
              setIsShowingStats((showing) => !showing);
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
              <RiAlertLine size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
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
  );
};

VideoPlayer.displayName = 'VideoPlayer';

export { VideoPlayer };
