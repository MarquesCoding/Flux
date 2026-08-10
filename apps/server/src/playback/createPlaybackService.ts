import negotiatePlaybackModule from '@FluxCore/functions/negotiatePlayback'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'
import planToSessionSpecModule from '@FluxCore/functions/planToSessionSpec'
import PlaybackServiceModule from './PlaybackService'
import type { PlaybackService } from './PlaybackService'
import type { Transcoder, TranscoderCapabilities } from '@FluxServer/transcoder/TranscoderClient'

const { negotiatePlayback } = negotiatePlaybackModule
const { describePlaybackMode } = describePlaybackModeModule
const { planToSessionSpec } = planToSessionSpecModule
const { SEGMENT_SECONDS } = PlaybackServiceModule

/**
 * Subtitle formats that are pictures rather than text.
 *
 * These cannot be converted, so burning them in means compositing a second
 * video stream rather than drawing text.
 */
const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub'])

/**
 * Whether a plan asks for nothing to be changed.
 *
 * Every axis passing through means the file can be sent as it is, which is
 * cheaper than even a remux and puts no load on the media service at all.
 */
const isDirectPlay = (plan: Parameters<typeof describePlaybackMode>[0]): boolean =>
  plan.container.kind === 'passthrough' &&
  plan.video.kind === 'passthrough' &&
  plan.audio.kind === 'passthrough' &&
  plan.subtitles.kind !== 'burnIn'

type MediaLookup = {
  findForPlayback: (
    mediaId: string,
  ) => Promise<{ item: Parameters<typeof negotiatePlayback>[0]; path: string } | null>
}

type CreatePlaybackServiceOptions = {
  media: MediaLookup
  transcoder: Transcoder
  sessionUrlPrefix: string
  directUrlPrefix: string
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
}: CreatePlaybackServiceOptions): PlaybackService => {
  let cached: TranscoderCapabilities | null = null

  const capabilities = async (): Promise<TranscoderCapabilities> => {
    cached ??= await transcoder.capabilities()

    return cached
  }

  return {
    explain: async (mediaId, profile) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return null
      }

      const plan = negotiatePlayback(found.item, profile)

      return { mode: describePlaybackMode(plan), plan }
    },

    start: async (mediaId, profile, startSeconds) => {
      const found = await media.findForPlayback(mediaId)

      if (found === null) {
        return { kind: 'notFound' }
      }

      const plan = negotiatePlayback(found.item, profile)

      if (isDirectPlay(plan)) {
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

    stop: (sessionId) => transcoder.stopSession(sessionId),
  }
}

export type { MediaLookup }

export default { createPlaybackService }
