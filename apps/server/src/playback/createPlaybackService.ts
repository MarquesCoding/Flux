import negotiatePlaybackModule from '@FluxCore/functions/negotiatePlayback'
import resolveQualityStepModule from '@FluxCore/functions/resolveQualityStep'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'
import planToSessionSpecModule from '@FluxCore/functions/planToSessionSpec'
import PlaybackServiceModule from './PlaybackService'
import type { PlaybackService } from './PlaybackService'
import type { Transcoder, TranscoderCapabilities } from '@FluxServer/transcoder/TranscoderClient'

const { negotiatePlayback } = negotiatePlaybackModule
const { resolveQualityStep } = resolveQualityStepModule
const { describePlaybackMode } = describePlaybackModeModule
const { planToSessionSpec } = planToSessionSpecModule
const {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} = PlaybackServiceModule

/**
 * Subtitle formats that are pictures rather than text.
 *
 * These cannot be converted, so burning them in means compositing a second
 * video stream rather than drawing text.
 */
/**
 * The file the media service names its index.
 */
const TRICKPLAY_INDEX_NAME = 'thumbnails.vtt'

/**
 * The file the media service names a preview clip.
 */
const PREVIEW_NAME = 'preview.mp4'

const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub'])

/**
 * Whether a plan asks for nothing to be changed.
 *
 * Every axis passing through means the file can be sent as it is, which is
 * cheaper than even a remux and puts no load on the media service at all.
 */
/**
 * The audio stream a raw file serve would carry, with no say from Flux.
 *
 * A browser given the file directly plays whichever stream the container
 * itself marks default, or its first. This is that same rule, computed here
 * so a direct serve can be trusted only when it would land on the stream
 * negotiation actually chose.
 */
const naturalAudioStreamIndex = (item: Parameters<typeof negotiatePlayback>[0]): number | null =>
  (item.audioStreams.find((stream) => stream.isDefault) ?? item.audioStreams[0])?.index ?? null

const isDirectPlay = (
  plan: Parameters<typeof describePlaybackMode>[0],
  item: Parameters<typeof negotiatePlayback>[0],
): boolean =>
  plan.container.kind === 'passthrough' &&
  plan.video.kind === 'passthrough' &&
  plan.audio.kind === 'passthrough' &&
  plan.audio.streamIndex === naturalAudioStreamIndex(item) &&
  plan.subtitles.kind !== 'burnIn'

type MediaLookup = {
  findForPlayback: (mediaId: string) => Promise<{
    item: Parameters<typeof negotiatePlayback>[0]
    path: string
    /**
     * The language the item's library forces audio selection toward, when an
     * operator has set one.
     */
    defaultAudioLanguage: string | null
  } | null>
}

type CreatePlaybackServiceOptions = {
  media: MediaLookup
  transcoder: Transcoder
  sessionUrlPrefix: string
  directUrlPrefix: string
  /**
   * Where seek-bar previews are served from.
   *
   * Proxied like segments are, because the media service reads any path it is
   * given and has no authentication of its own.
   */
  trickplayUrlPrefix: string
}

/**
 * Playback backed by the media service.
 *
 * Capabilities are read once and cached: probing them runs a real encode per
 * candidate, which is cheap at startup and wasteful on every play.
 */
const createPlaybackService = ({
  media,
  transcoder,
  sessionUrlPrefix,
  directUrlPrefix,
  trickplayUrlPrefix,
}: CreatePlaybackServiceOptions): PlaybackService => {
  let cached: TranscoderCapabilities | null = null

  const capabilities = async (): Promise<TranscoderCapabilities> => {
    if (cached !== null) {
      return cached
    }

    const found = await transcoder.capabilities()

    // An empty answer is not an answer worth keeping. The media service
    // reports what it could verify at the moment it was asked, and a service
    // still starting, or one whose ffmpeg was being replaced underneath it,
    // reports nothing — which would otherwise be cached for the life of the
    // process and turn a passing problem into a permanent one.
    if (found.encoders.length > 0) {
      cached = found
    }

    return found
  }

  return {
    explain: async (mediaId, profile, requestedQuality) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return null
      }

      const qualityClamp = resolveQualityStep(found.item, requestedQuality ?? 'original')
      const plan = negotiatePlayback(found.item, profile, qualityClamp, found.defaultAudioLanguage)

      return { mode: describePlaybackMode(plan), plan }
    },

    start: async (mediaId, profile, startSeconds, audioStreamIndex, requestedQuality) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return { kind: 'notFound' }
      }

      const qualityClamp = resolveQualityStep(found.item, requestedQuality ?? 'original')
      const plan = negotiatePlayback(found.item, profile, qualityClamp, found.defaultAudioLanguage)

      // A viewer who picked a track needs that track selected, which the
      // original file cannot do: it carries every stream and the browser picks
      // the default. Choosing one therefore means transcoding. A library that
      // forces a language behaves the same way whenever the forced track is
      // not what the file would default to on its own.
      if (isDirectPlay(plan, found.item) && audioStreamIndex === undefined) {
        return {
          kind: 'started',
          session: {
            sessionId: `direct-${mediaId}`,
            delivery: { kind: 'direct', url: `${directUrlPrefix}/${mediaId}/file` },
            mode: describePlaybackMode(plan),
            plan,
            warnings: [],
          },
        }
      }

      const outcome = planToSessionSpec({
        plan,
        inputPath: found.path,
        sourceRange: found.item.videoRange,
        imageSubtitleIndexes: found.item.subtitleStreams
          .filter((stream) => IMAGE_SUBTITLE_FORMATS.has(stream.format))
          .map((stream) => stream.index),
        capabilities: await capabilities(),
        startSeconds,
        segmentSeconds: SEGMENT_SECONDS,
        // A viewer's explicit pick wins. Otherwise the session must still be
        // told which stream negotiation chose — leaving this out would let
        // the media service fall back to its own default, undoing a forced
        // library language the moment a session (rather than a direct file
        // serve) is needed.
        ...(audioStreamIndex !== undefined
          ? { audioStreamIndex }
          : plan.audio.streamIndex === null
            ? {}
            : { audioStreamIndex: plan.audio.streamIndex }),
      })

      if (outcome.kind === 'unsupported') {
        return { kind: 'unsupported', reason: outcome.reason }
      }

      try {
        const session = await transcoder.startSession(outcome.spec)

        return {
          kind: 'started',
          session: {
            sessionId: session.id,
            delivery: {
              kind: 'hls',
              manifestUrl: `${sessionUrlPrefix}/${session.id}/index.m3u8`,
            },
            mode: describePlaybackMode(plan),
            plan,
            warnings: outcome.warnings,
          },
        }
      } catch (error) {
        return {
          kind: 'failed',
          reason: error instanceof Error ? error.message : 'The media service failed.',
        }
      }
    },

    readSessionFile: async (sessionId, name) => transcoder.readSessionFile(sessionId, name),

    readDirectFile: async (mediaId, range) => {
      const found = await media.findForPlayback(mediaId)

      return found === null ? null : transcoder.readFile(found.path, range)
    },

    trickplay: async (mediaId) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return null
      }

      const index = await transcoder.requestTrickplay({
        inputPath: found.path,
        intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
        tileWidth: TRICKPLAY_TILE_WIDTH,
        columns: TRICKPLAY_COLUMNS,
        rows: TRICKPLAY_ROWS,
        wait: false,
      })

      // Rendering has been started but has not finished. Saying so, rather
      // than waiting for it, is what lets the film start now and the previews
      // appear when the player next asks.
      if (!index.isReady) {
        return null
      }

      return {
        id: index.id,
        url: `${trickplayUrlPrefix}/${index.id}/${TRICKPLAY_INDEX_NAME}`,
        intervalSeconds: index.intervalSeconds,
        tileWidth: index.tileWidth,
        tileHeight: index.tileHeight,
      }
    },

    readFrame: async (mediaId, seconds, width) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return null
      }

      return transcoder
        .readFrame({ inputPath: found.path, atSeconds: seconds, width })
        .catch(() => null)
    },

    readPreview: async (mediaId) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return null
      }

      // Asked for without waiting: if it has not been made yet this starts it
      // and says so, and the page carries on with the frame it already has.
      const clip = await transcoder
        .requestPreview({ inputPath: found.path, wait: false })
        .catch(() => null)

      if (clip === null || !clip.isReady) {
        return null
      }

      return transcoder.readPreviewFile(clip.id, PREVIEW_NAME)
    },

    readTrickplayFile: (trickplayId, name) => transcoder.readTrickplayFile(trickplayId, name),

    stop: (sessionId) => transcoder.stopSession(sessionId),

    heartbeat: (sessionId, isPlaying) => transcoder.heartbeatSession(sessionId, isPlaying),
  }
}

export type { MediaLookup }

export default { createPlaybackService }
