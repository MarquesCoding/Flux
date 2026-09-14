import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';
import type { PlaybackPlan } from '@ValenceContracts/schemas/PlaybackPlan';
import type { PlaybackMode } from '@ValenceContracts/functions/describePlaybackMode';
import type { QualityStepId } from '@ValenceContracts/schemas/QualityStep';
import type { TranscodeReuse } from '@ValenceContracts/schemas/TranscodeReuse';
type Explanation = {
  mode: PlaybackMode;
  plan: PlaybackPlan;
};

type Delivery = { kind: 'hls'; manifestUrl: string } | { kind: 'direct'; url: string };

type StartedSession = Explanation & {
  sessionId: string;
  delivery: Delivery;
  warnings: string[];
  reuse: TranscodeReuse | null;
};

type StartOutcome =
  | { kind: 'started'; session: StartedSession }
  | { kind: 'notFound' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'failed'; reason: string };

type SessionFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentRange: string | null;
  contentLength: string | null;
};

type StoredFile = {
  body: ArrayBuffer;
  contentType: string;
};

type RangedFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  status: number;
  contentRange: string | null;
  contentLength: string | null;
};

type PreviewRead = { kind: 'ready'; file: RangedFile } | { kind: 'pending' } | { kind: 'absent' };

type PlaybackService = {
  explain: (
    mediaId: string,
    profile: DeviceProfile,
    requestedQuality?: QualityStepId,
  ) => Promise<Explanation | null>;
  start: (
    mediaId: string,
    profile: DeviceProfile,
    startSeconds: number,
    audioStreamIndex?: number,
    requestedQuality?: QualityStepId,
    deviceId?: string,
    subtitleStreamIndex?: number,
  ) => Promise<StartOutcome>;
  readSessionFile: (sessionId: string, name: string) => Promise<SessionFile | null>;
  readDirectFile: (mediaId: string, range: string | null) => Promise<RangedFile | null>;
  trickplay: (mediaId: string) => Promise<Trickplay | null>;
  readFrame: (mediaId: string, seconds: number, width: number) => Promise<ArrayBuffer | null>;
  readPreview: (mediaId: string, range: string | null) => Promise<PreviewRead>;
  readTrickplayFile: (trickplayId: string, name: string) => Promise<StoredFile | null>;
  stop: (sessionId: string, deviceId?: string) => Promise<boolean>;
  heartbeat: (sessionId: string, isPlaying: boolean) => Promise<boolean>;
};

type Trickplay = {
  id: string;
  url: string;
  intervalSeconds: number;
  tileWidth: number;
  tileHeight: number;
};

const SEGMENT_SECONDS = 4;

const TRICKPLAY_INTERVAL_SECONDS = 10;

const TRICKPLAY_TILE_WIDTH = 320;
const TRICKPLAY_COLUMNS = 10;
const TRICKPLAY_ROWS = 10;

export type { Delivery, PlaybackService, PreviewRead, StartOutcome, StartedSession, Trickplay };

export {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
};
