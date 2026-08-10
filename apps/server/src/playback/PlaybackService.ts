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
  /**
   * Renders seek-bar previews for an item, or reuses ones already on disk.
   */
  trickplay: (mediaId: string) => Promise<Trickplay | null>
  readTrickplayFile: (trickplayId: string, name: string) => Promise<SessionFile | null>
  stop: (sessionId: string) => Promise<boolean>
}

/**
 * Seek-bar previews as a client sees them.
 *
 * The URL points at the WebVTT index rather than the images: cue payloads are
 * relative to it, so a player fetches only the sheets covering the part of the
 * timeline being scrubbed.
 */
type Trickplay = {
  id: string
  url: string
  intervalSeconds: number
  tileWidth: number
  tileHeight: number
}

const SEGMENT_SECONDS = 4

/**
 * Seconds between preview thumbnails.
 *
 * Ten is where Jellyfin and Plex sit. Finer sampling multiplies both decode
 * time and sheet size for a difference a viewer dragging a scrub bar cannot
 * perceive.
 */
const TRICKPLAY_INTERVAL_SECONDS = 10

const TRICKPLAY_TILE_WIDTH = 320
const TRICKPLAY_COLUMNS = 10
const TRICKPLAY_ROWS = 10

export type {
  Delivery,
  Explanation,
  PlaybackService,
  RangedFile,
  SessionFile,
  StartOutcome,
  StartedSession,
  Trickplay,
}

export default {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
}
