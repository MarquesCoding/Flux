import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile'
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan'
import type { PlaybackMode } from '@FluxContracts/functions/describePlaybackMode'

type Explanation = {
  mode: PlaybackMode
  plan: PlaybackPlan
}

type StartedSession = Explanation & {
  sessionId: string
  manifestUrl: string
}

type StartOutcome =
  | { kind: 'started'; session: StartedSession }
  | { kind: 'notFound' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'failed'; reason: string }

type SessionFile = {
  body: ArrayBuffer
  contentType: string
}

/**
 * Playback as the HTTP layer sees it.
 *
 * Segment delivery goes through the server rather than exposing the media
 * service directly: the media service listens on a private socket, has no
 * authentication of its own, and would happily transcode any path it is given.
 */
type PlaybackService = {
  explain: (mediaId: string, profile: DeviceProfile) => Promise<Explanation | null>
  start: (mediaId: string, profile: DeviceProfile, startSeconds: number) => Promise<StartOutcome>
  readSessionFile: (sessionId: string, name: string) => Promise<SessionFile | null>
  stop: (sessionId: string) => Promise<boolean>
}

const SEGMENT_SECONDS = 4

export type { Explanation, PlaybackService, SessionFile, StartOutcome, StartedSession }

export default { SEGMENT_SECONDS }
