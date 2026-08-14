import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';
import type { PlaybackMode } from '@FluxContracts/functions/describePlaybackMode';
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep';
type Explanation = {
  mode: PlaybackMode;
  plan: PlaybackPlan;
};

/**
 * How the bytes reach the client.
 *
 * Direct play is the cheapest delivery there is: the original file over byte
 * ranges, with no transcode, no remux and no segment cache. Modelling it as a
 * separate delivery rather than a flag keeps the client from having to guess.
 */
type Delivery = { kind: 'hls'; manifestUrl: string } | { kind: 'direct'; url: string };

type StartedSession = Explanation & {
  sessionId: string;
  delivery: Delivery;
  warnings: string[];
};

type StartOutcome =
  | { kind: 'started'; session: StartedSession }
  | { kind: 'notFound' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'failed'; reason: string };

type SessionFile = {
  body: ArrayBuffer;
  contentType: string;
};

/**
 * A media file on its way to a viewer, forwarded as it arrives.
 *
 * Whole media and preview clips both come through here, and both are large
 * enough that collecting one before sending it costs its own size in memory.
 * The status and range headers are the media service's answer, passed on
 * unchanged.
 */
type RangedFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  status: number;
  contentRange: string | null;
  contentLength: string | null;
};

/**
 * What came back when a card asked for an item's preview clip.
 *
 * `pending` says the media service is rendering one right now. It is a
 * different answer from `absent`, and a card shows a different thing for each:
 * one is worth coming back for, the other is not.
 */
type PreviewRead = { kind: 'ready'; file: RangedFile } | { kind: 'pending' } | { kind: 'absent' };

/**
 * Playback as the HTTP layer sees it.
 *
 * Segment delivery goes through the server rather than exposing the media
 * service directly: the media service listens on a private socket, has no
 * authentication of its own, and would happily transcode any path it is given.
 */
type PlaybackService = {
  explain: (
    mediaId: string,
    profile: DeviceProfile,
    requestedQuality?: QualityStepId,
  ) => Promise<Explanation | null>;
  /**
   * Begins playback, saying which device asked.
   *
   * The device does not change what is made — two devices asking for the same
   * thing share one transcode — only whose resume point it becomes. A caller
   * with no device to name costs only that the transcode is kept for nobody.
   */
  start: (
    mediaId: string,
    profile: DeviceProfile,
    startSeconds: number,
    audioStreamIndex?: number,
    requestedQuality?: QualityStepId,
    deviceId?: string,
  ) => Promise<StartOutcome>;
  readSessionFile: (sessionId: string, name: string) => Promise<SessionFile | null>;
  readDirectFile: (mediaId: string, range: string | null) => Promise<RangedFile | null>;
  /**
   * Renders seek-bar previews for an item, or reuses ones already on disk.
   */
  trickplay: (mediaId: string) => Promise<Trickplay | null>;
  /**
   * Reads one frame of an item as a picture.
   */
  readFrame: (mediaId: string, seconds: number, width: number) => Promise<ArrayBuffer | null>;
  /**
   * The short clip a library page plays for an item.
   *
   * `pending` and `absent` are kept apart rather than both reading as nothing
   * to play. A card that cannot tell them apart has to guess, and it guessed
   * wrong: a machine quietly rendering a clip looked exactly like one that had
   * failed. The clip is deliberately not waited for — a viewer should not sit
   * through minutes of encoding for decoration — so that window always exists
   * and is worth naming.
   */
  readPreview: (mediaId: string, range: string | null) => Promise<PreviewRead>;
  readTrickplayFile: (trickplayId: string, name: string) => Promise<SessionFile | null>;
  stop: (sessionId: string) => Promise<boolean>;
  /**
   * Tells playback a session is still wanted, and whether it is currently
   * playing or paused.
   *
   * `false` means the server no longer knows this session — the caller
   * should stop sending heartbeats for it.
   */
  heartbeat: (sessionId: string, isPlaying: boolean) => Promise<boolean>;
};

/**
 * Seek-bar previews as a client sees them.
 *
 * The URL points at the WebVTT index rather than the images: cue payloads are
 * relative to it, so a player fetches only the sheets covering the part of the
 * timeline being scrubbed.
 */
type Trickplay = {
  id: string;
  url: string;
  intervalSeconds: number;
  tileWidth: number;
  tileHeight: number;
};

const SEGMENT_SECONDS = 4;

/**
 * Seconds between preview thumbnails.
 *
 * Ten is where Jellyfin and Plex sit. Finer sampling multiplies both decode
 * time and sheet size for a difference a viewer dragging a scrub bar cannot
 * perceive.
 */
const TRICKPLAY_INTERVAL_SECONDS = 10;

const TRICKPLAY_TILE_WIDTH = 320;
const TRICKPLAY_COLUMNS = 10;
const TRICKPLAY_ROWS = 10;

export type {
  Delivery,
  Explanation,
  PlaybackService,
  PreviewRead,
  RangedFile,
  SessionFile,
  StartOutcome,
  StartedSession,
  Trickplay,
};

export {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
};
