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

type MediaLookup = {
  findForPlayback: (
    mediaId: string,
  ) => Promise<{ item: Parameters<typeof negotiatePlayback>[0]; path: string } | null>
}

type CreatePlaybackServiceOptions = {
  media: MediaLookup
  transcoder: Transcoder
  sessionUrlPrefix: string
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

      const outcome = planToSessionSpec({
        plan,
        inputPath: found.path,
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
            manifestUrl: `${sessionUrlPrefix}/${session.id}/index.m3u8`,
            mode: describePlaybackMode(plan),
            plan,
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

    stop: (sessionId) => transcoder.stopSession(sessionId),
  }
}

export type { MediaLookup }

export default { createPlaybackService }
