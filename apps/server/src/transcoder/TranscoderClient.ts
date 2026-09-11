import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';
import { Agent, fetch as undiciFetch } from 'undici';
import { z } from 'zod';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import { TranscodeReuseSchema } from '@ValenceContracts/schemas/TranscodeReuse';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type HttpResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<JsonValue>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type HttpRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type FetchLike = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>;

const ProbeVideoSchema = z.object({
  index: z.number().int(),
  codec: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  range: z.string(),
  rangeBase: z.string().nullable().default(null),
  bitrateKbps: z.number().int().nullable(),
  bitDepth: z.number().int().nullable(),
  level: z.number().int().nullable().default(null),
  frameRate: z.number().nullable().default(null),
  isInterlaced: z.boolean().default(false),
  refFrames: z.number().int().nullable().default(null),
  pixelAspect: z.string().nullable().default(null),
  rotationDegrees: z.number().int().nullable().default(null),
});

const ProbeAudioSchema = z.object({
  index: z.number().int(),
  codec: z.string(),
  channels: z.number().int(),
  sampleRate: z.number().int().nullable().default(null),
  profile: z.string().nullable().default(null),
  language: z.string().nullable(),
  title: z.string().nullable().default(null),
  isDefault: z.boolean().default(false),
  isAtmos: z.boolean(),
});

const ProbeSubtitleSchema = z.object({
  index: z.number().int(),
  format: z.string(),
  language: z.string().nullable(),
  title: z.string().nullable(),
  isDefault: z.boolean(),
  isForced: z.boolean(),
  isImageBased: z.boolean(),
});

const MediaProbeSchema = z.object({
  container: z.string(),
  durationSeconds: z.number(),
  bitrateKbps: z.number().int().nullable(),
  video: ProbeVideoSchema.nullable(),
  canCopySegments: z.boolean().optional(),
  audioStreams: z.array(ProbeAudioSchema),
  chapters: z
    .array(
      z.object({
        title: z.string().nullable(),
        startSeconds: z.number(),
        endSeconds: z.number(),
      }),
    )
    .default([]),
  subtitleStreams: z.array(ProbeSubtitleSchema),
});

const SessionResponseSchema = z.object({
  id: z.string().min(1),
  manifest: z.string().min(1),
  encodesVideo: z.boolean().default(false),
  reuse: TranscodeReuseSchema.default('none'),
});

const CapabilitiesSchema = z.object({
  ffmpegVersion: z.string(),
  probeVersion: z.number().int().nonnegative().default(0),
  ffmpegSupported: z.boolean().default(true),
  encoders: z.array(
    z.object({
      codec: z.string(),
      encoder: z.string(),
      accel: z.string(),
      verified: z.boolean(),
    }),
  ),
  hardwareAccels: z.array(z.string()),
  hardwareScalers: z.array(z.string()).default([]),
  hardwareOverlays: z.array(z.string()).default([]),
  hardwareToneMaps: z.array(z.string()).default([]),
  rejected: z
    .array(
      z.object({
        codec: z.string().default(''),
        encoder: z.string(),
        accel: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  toneMapping: z.enum(['zscale', 'libplacebo', 'unavailable']).default('unavailable'),
  canBurnTextSubtitles: z.boolean().default(false),
  canBurnImageSubtitles: z.boolean().default(false),
  concurrentRenders: z.number().int().nonnegative().default(0),
  chains: z
    .array(
      z.object({
        accel: z.string(),
        shape: z.enum(['preview', 'sheet', 'transcode']),
        bitDepth: z.number().int(),
        works: z.boolean(),
        reason: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

const FingerprintSchema = z.object({
  framesPerSecond: z.number().positive(),
  startSeconds: z.number().nonnegative(),
  hashes: z.array(z.number()),
});

const SubtitleTrackSchema = z.object({ content: z.string() });

const ForgetReportSchema = z.object({ forgotten: z.boolean() });

const StopReportSchema = z.object({ stopped: z.boolean() });

const DownloadFileSchema = z.object({
  id: z.string(),
  isReady: z.boolean(),
  progress: z.number().int().min(0).max(100),
  bytesPerSecond: z.number().int().nonnegative().nullable().optional(),
  file: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
});

const SweepReportSchema = z.object({
  removed: z.number().int().nonnegative(),
  freedBytes: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  tooNew: z.number().int().nonnegative(),
});

const ArtefactUseSchema = z.object({
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

const CacheUseSchema = z.object({
  previews: ArtefactUseSchema,
  trickplay: ArtefactUseSchema,
  sessions: ArtefactUseSchema,
  atMs: z.number().int().nonnegative(),
});

type CacheUse = z.infer<typeof CacheUseSchema>;

const PreviewClipSchema = z.object({
  id: z.string(),
  url: z.string(),
  isReady: z.boolean(),
});

const TrickplayIndexSchema = z.object({
  id: z.string(),
  intervalSeconds: z.number(),
  tileWidth: z.number(),
  tileHeight: z.number(),
  columns: z.number(),
  rows: z.number(),
  sheets: z.array(z.string()),
  index: z.string(),
  isReady: z.boolean(),
});

type MediaProbe = z.infer<typeof MediaProbeSchema>;
type Fingerprint = z.infer<typeof FingerprintSchema>;
type SweepReport = z.infer<typeof SweepReportSchema>;

type PreviewSweepSubject = {
  inputPath: string;
  generation: number;
  quality: PreviewQuality;
  audioStreamIndex?: number;
};

type FingerprintRequest = {
  inputPath: string;
  startSeconds: number;
  durationSeconds: number;
  owner?: string;
};
type TrickplayIndex = z.infer<typeof TrickplayIndexSchema>;

type TrickplayRequest = {
  inputPath: string;
  generation: number;
  intervalSeconds: number;
  tileWidth: number;
  columns: number;
  rows: number;
  wait?: boolean;
  hardwareAccel?: string;
  owner?: string;
};
type SessionResponse = z.infer<typeof SessionResponseSchema>;
type TranscoderCapabilities = z.infer<typeof CapabilitiesSchema>;

type DownloadRequest = {
  spec: SessionSpec;
  durationSeconds: number;
  audioStreamIndexes: number[];
  subtitleStreamIndexes: number[];
  generation: number;
};

type DownloadFile = z.infer<typeof DownloadFileSchema>;

type SessionSpec = {
  inputPath: string;
  startSeconds: number;
  segmentSeconds: number;
  hardwareAccel: string;
  video:
    | { kind: 'copy' }
    | {
        kind: 'encode';
        encoder: string;
        maxBitrateKbps: number;
        maxWidth: number;
        maxHeight: number;
      };
  audio:
    | { kind: 'copy' }
    | { kind: 'encode'; encoder: string; channels: number; maxBitrateKbps: number };
  sourceSize?: [number, number];
  sourceVideoCodec?: string;
  container?: 'fmp4' | 'mpegts';
};

type Transcoder = {
  isReachable: () => Promise<boolean>;
  probe: (path: string) => Promise<MediaProbe>;
  startSession: (spec: SessionSpec, deviceId?: string) => Promise<SessionResponse>;
  readSessionFile: (sessionId: string, name: string) => Promise<TranscoderStreamedFile | null>;
  readFile: (path: string, range: string | null) => Promise<TranscoderStreamedFile | null>;
  fingerprint: (request: FingerprintRequest) => Promise<Fingerprint>;
  readSubtitle: (request: { inputPath: string; streamIndex: number }) => Promise<string>;
  readMonitor: () => Promise<JsonValue>;
  openMonitorStream: () => Promise<ReadableStream<Uint8Array> | null>;
  readFrame: (request: {
    inputPath: string;
    atSeconds: number;
    width: number;
  }) => Promise<ArrayBuffer>;
  requestPreview: (request: {
    inputPath: string;
    generation: number;
    quality: PreviewQuality;
    wait?: boolean;
    audioStreamIndex?: number;
    hardwareAccel?: string;
    owner?: string;
  }) => Promise<{ id: string; url: string; isReady: boolean }>;
  readPreviewFile: (
    id: string,
    name: string,
    range: string | null,
  ) => Promise<TranscoderStreamedFile | null>;
  requestDownload: (request: DownloadRequest) => Promise<DownloadFile>;
  readDownloadFile: (
    id: string,
    name: string,
    range: string | null,
  ) => Promise<TranscoderStreamedFile | null>;
  forgetDownload: (id: string) => Promise<boolean>;
  stopDownload: (id: string) => Promise<boolean>;
  requestTrickplay: (request: TrickplayRequest) => Promise<TrickplayIndex>;
  sweepPreviews: (keep: PreviewSweepSubject[]) => Promise<SweepReport>;
  sweepTrickplay: (keep: TrickplayRequest[]) => Promise<SweepReport>;
  measureCache: () => Promise<CacheUse | null>;
  forgetPreview: (request: PreviewSweepSubject) => Promise<boolean>;
  forgetTrickplay: (request: TrickplayRequest) => Promise<boolean>;
  readTrickplayFile: (id: string, name: string) => Promise<TranscoderFile | null>;
  stopSession: (id: string, deviceId?: string) => Promise<boolean>;
  heartbeatSession: (id: string, isPlaying: boolean) => Promise<boolean>;
  capabilities: () => Promise<TranscoderCapabilities>;
};

type TranscoderFile = {
  body: ArrayBuffer;
  contentType: string;
};

type TranscoderRangedFile = TranscoderFile & {
  status: number;
  contentRange: string | null;
};

type TranscoderStreamedFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  status: number;
  contentRange: string | null;
  contentLength: string | null;
};

type StreamFetchLike = (url: string, init?: HttpRequestInit) => Promise<StreamedResponse>;

type CreateTranscoderClientOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
  streamFetchImpl?: StreamFetchLike;
};

const UNIX_PREFIX = 'unix:';

/**
 * Splits a socket address into the socket to connect to and the URL to ask for over it, since a
 * request over a Unix socket still needs a host and a path that mean nothing to anybody.
 *
 * @param baseUrl - The configured address.
 * @returns The socket path and the URL to request, or null where it is an ordinary address.
 */
const readSocketPath = (baseUrl: string): string | null =>
  baseUrl.startsWith(UNIX_PREFIX) ? baseUrl.slice(UNIX_PREFIX.length) : null;

const narrow = <TBody>(response: {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<TBody>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): HttpResponse => ({
  ok: response.ok,
  status: response.status,
  headers: { get: (name) => response.headers.get(name) },
  json: async () => JsonValueSchema.parse(await response.json()),
  arrayBuffer: () => response.arrayBuffer(),
});

/**
 * The ordinary network fetch, narrowed to what Valence uses.
 */
const httpFetch: FetchLike = async (url, init) => narrow(await fetch(url, init));

const REQUEST_TIMEOUT_MILLISECONDS = 60_000;

const NO_TIMEOUT = 0;

const HEALTH_TIMEOUT_MILLISECONDS = 5_000;

const createSocketFetch = (
  socketPath: string,
  timeout = REQUEST_TIMEOUT_MILLISECONDS,
): FetchLike => {
  const agent = new Agent({
    connect: { socketPath },
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });

  return async (url, init) => narrow(await undiciFetch(url, { ...init, dispatcher: agent }));
};

type StreamedResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array> | null;
};

/**
 * Opens a response whose body is read as it arrives.
 */
const createStreamFetch = (socketPath: string | null): StreamFetchLike => {
  if (socketPath === null) {
    return async (url, init) => fetch(url, init);
  }

  const agent = new Agent({ connect: { socketPath } });

  return async (url, init) => undiciFetch(url, { ...init, dispatcher: agent });
};

class TranscoderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TranscoderError';
  }
}

/**
 * Talks to the Rust media service over HTTP.
 */
const createTranscoderClient = ({
  baseUrl,
  fetchImpl,
  streamFetchImpl,
}: CreateTranscoderClientOptions): Transcoder => {
  const socketPath = readSocketPath(baseUrl);
  const origin = socketPath === null ? baseUrl : 'http://transcoder.local';
  const call2 = fetchImpl ?? (socketPath === null ? httpFetch : createSocketFetch(socketPath));

  const callSlowly =
    fetchImpl ?? (socketPath === null ? httpFetch : createSocketFetch(socketPath, NO_TIMEOUT));
  const call = async (path: string, init?: HttpRequestInit): Promise<HttpResponse> => {
    const response = await call2(`${origin}${path}`, init);

    if (!response.ok) {
      throw new TranscoderError(`The media service rejected ${path}.`, response.status);
    }

    return response;
  };

  const streamFrom = streamFetchImpl ?? createStreamFetch(socketPath);

  /**
   * Opens a file on the media service and hands back the body still arriving.
   */
  const openStream = async (
    url: string,
    range: string | null,
    fallbackContentType: string,
  ): Promise<TranscoderStreamedFile | null> => {
    const response = await streamFrom(url, range === null ? {} : { headers: { range } });

    if (!response.ok || response.body === null) {
      return null;
    }

    return {
      body: response.body,
      contentType: response.headers.get('content-type') ?? fallbackContentType,
      status: response.status,
      contentRange: response.headers.get('content-range'),
      contentLength: response.headers.get('content-length'),
    };
  };

  const postJson = (path: string, body: object): Promise<HttpResponse> =>
    call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  /**
   * Asks for something that is rendered rather than read, and waits for as long as it takes.
   *
   * No clock at all. A preview is an encode and a sheet is a thumbnail a minute across a whole film,
   * both queued behind whatever else is being drawn, so any number picked here would be a guess at
   * how long a stranger's film takes to work through — and being wrong about it reports work that is
   * progressing normally as a failure, and leaves the item looking broken.
   *
   * Nothing is given up by waiting. The connection is the liveness signal: a media service that dies
   * closes the socket and the request fails at once, which is the case a timeout was protecting
   * against. Work that fails still fails, because ffmpeg says so.
   *
   * @param path - What to ask for.
   * @param body - The request.
   * @returns What the media service answered.
   */
  const postRender = async (path: string, body: object): Promise<HttpResponse> => {
    const response = await callSlowly(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new TranscoderError(`The media service rejected ${path}.`, response.status);
    }

    return response;
  };

  return {
    isReachable: async () => {
      const response = await Promise.race([
        call2(`${origin}/health`).catch(() => null),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            resolve(null);
          }, HEALTH_TIMEOUT_MILLISECONDS).unref();
        }),
      ]);

      return response !== null && response.ok;
    },

    probe: async (path) =>
      MediaProbeSchema.parse(await (await postJson('/probe', { path })).json()),

    startSession: async (spec, deviceId) =>
      SessionResponseSchema.parse(
        await (
          await postJson('/sessions', deviceId === undefined ? spec : { ...spec, deviceId })
        ).json(),
      ),

    readSessionFile: async (sessionId, name) =>
      openStream(
        `${origin}/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(name)}`,
        null,
        'application/octet-stream',
      ),

    readFile: async (path, range) =>
      openStream(
        `${origin}/file?path=${encodeURIComponent(path)}`,
        range,
        'application/octet-stream',
      ),

    fingerprint: async (request) =>
      FingerprintSchema.parse(await (await postJson('/fingerprint', request)).json()),

    readFrame: async (request) => (await postJson('/frame', request)).arrayBuffer(),

    requestPreview: async (request) =>
      PreviewClipSchema.parse(await (await postRender('/previews', request)).json()),

    readPreviewFile: async (id, name, range) =>
      openStream(
        `${origin}/previews/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
        range,
        'video/mp4',
      ),

    sweepPreviews: async (keep) =>
      SweepReportSchema.parse(await (await postJson('/previews/sweep', { keep })).json()),

    sweepTrickplay: async (keep) =>
      SweepReportSchema.parse(await (await postJson('/trickplay/sweep', { keep })).json()),

    measureCache: async () => {
      const answered = await postJson('/cache/measure', {}).catch(() => null);

      if (answered === null) {
        return null;
      }

      const parsed = CacheUseSchema.safeParse(await answered.json().catch(() => null));

      return parsed.success ? parsed.data : null;
    },

    forgetPreview: async (request) =>
      ForgetReportSchema.parse(await (await postJson('/previews/forget', request)).json())
        .forgotten,

    forgetTrickplay: async (request) =>
      ForgetReportSchema.parse(await (await postJson('/trickplay/forget', request)).json())
        .forgotten,

    readMonitor: async () => (await call('/monitor')).json(),

    openMonitorStream: async () => {
      const response = await streamFrom(`${origin}/monitor/stream`).catch(() => null);

      return response === null || !response.ok ? null : response.body;
    },

    readSubtitle: async (request) =>
      SubtitleTrackSchema.parse(await (await postJson('/subtitles', request)).json()).content,

    requestDownload: async (request) =>
      DownloadFileSchema.parse(await (await postJson('/downloads', request)).json()),

    readDownloadFile: async (id, name, range) =>
      openStream(
        `${origin}/downloads/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
        range,
        'video/mp4',
      ),

    forgetDownload: async (id) =>
      ForgetReportSchema.parse(await (await postJson('/downloads/forget', { id })).json())
        .forgotten,

    stopDownload: async (id) =>
      StopReportSchema.parse(await (await postJson('/downloads/stop', { id })).json()).stopped,

    requestTrickplay: async (request) =>
      TrickplayIndexSchema.parse(await (await postRender('/trickplay', request)).json()),

    readTrickplayFile: async (id, name) => {
      const response = await call2(
        `${origin}/trickplay/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
      );

      if (!response.ok) {
        return null;
      }

      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },

    stopSession: async (id, deviceId) => {
      const asked = deviceId === undefined ? '' : `?deviceId=${encodeURIComponent(deviceId)}`;
      const response = await call2(`${origin}/sessions/${id}${asked}`, { method: 'DELETE' });

      return response.ok;
    },

    heartbeatSession: async (id, isPlaying) => {
      const response = await call2(`${origin}/sessions/${encodeURIComponent(id)}/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isPlaying }),
      });

      return response.ok;
    },

    capabilities: async () => CapabilitiesSchema.parse(await (await call('/capabilities')).json()),
  };
};

export type {
  FetchLike,
  HttpResponse,
  MediaProbe,
  SessionResponse,
  DownloadFile,
  DownloadRequest,
  SessionSpec,
  Transcoder,
  TranscoderCapabilities,
  TrickplayIndex,
  TrickplayRequest,
  Fingerprint,
  FingerprintRequest,
  TranscoderFile,
  TranscoderRangedFile,
  PreviewSweepSubject,
  SweepReport,
  CacheUse,
};

export { createTranscoderClient, readSocketPath, TranscoderError, MediaProbeSchema };
