import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile'
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan'
import type { PlaybackMode } from '@FluxContracts/functions/describePlaybackMode'

type Explanation = {
  mode: PlaybackMode
  plan: PlaybackPlan
}

/**
 * How the bytes reach the client.
 *
 * Direct play is the cheapest delivery there is: the original file over byte
 * ranges, with no transcode, no remux and no segment cache. Modelling it as a
 * separate delivery rather than a flag keeps the client from having to guess.
 */
type Delivery = { kind: 'hls'; manifestUrl: string } | { kind: 'direct'; url: string }

type StartedSession = Explanation & {
  sessionId: string
  delivery: Delivery
  /// Things the viewer should know that are not failures, such as a server
  /// that cannot tone map the HDR source it is about to convert.
  warnings: string[]
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

/// A byte range answer from the media service.
type RangedFile = {
  body: ArrayBuffer
  contentType: string
  status: number
  contentRange: string | null
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
  readDirectFile: (mediaId: string, range: string | null) => Promise<RangedFile | null>
  stop: (sessionId: string) => Promise<boolean>
}

const SEGMENT_SECONDS = 4

export type {
  Delivery,
  Explanation,
  PlaybackService,
  RangedFile,
  SessionFile,
  StartOutcome,
  StartedSession,
}

export default { SEGMENT_SECONDS }
