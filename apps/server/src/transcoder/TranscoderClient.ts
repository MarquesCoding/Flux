import { Agent, fetch as undiciFetch } from 'undici';
import { z } from 'zod';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

/**
 * The part of a response Flux uses.
 *
 * Structural rather than the global `Response`, because a Unix socket request
 * goes through undici and returns undici's own type. Both satisfy this, so no
 * assertion is needed to treat them alike.
 */
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
  bitrateKbps: z.number().int().nullable(),
  bitDepth: z.number().int().nullable(),
});

const ProbeAudioSchema = z.object({
  index: z.number().int(),
  codec: z.string(),
  channels: z.number().int(),
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

/**
 * What the media service reports about a file.
 *
 * Mirrors the Rust `MediaProbe`. Validated here rather than trusted, because a
 * version mismatch between the two halves of the server should fail loudly at
 * the boundary instead of producing a half-populated library row.
 */
const MediaProbeSchema = z.object({
  container: z.string(),
  durationSeconds: z.number(),
  bitrateKbps: z.number().int().nullable(),
  video: ProbeVideoSchema.nullable(),
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
});

const CapabilitiesSchema = z.object({
  ffmpegVersion: z.string(),
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
});

const FingerprintSchema = z.object({
  framesPerSecond: z.number().positive(),
  startSeconds: z.number().nonnegative(),
  hashes: z.array(z.number()),
});

const SubtitleTrackSchema = z.object({ content: z.string() });

/**
 * What a sweep did, as the media service reports it.
 *
 * `tooNew` is not a failure. A directory modified in the last hour is left
 * alone whatever its name, because an artefact halfway through being written
 * looks exactly like an abandoned one.
 */
/**
 * Whether a forget found anything to remove.
 */
const ForgetReportSchema = z.object({ forgotten: z.boolean() });

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

/**
 * A preview clip a sweep should keep, as the request that addresses it.
 */
type PreviewSweepSubject = {
  inputPath: string;
  generation: number;
  audioStreamIndex?: number;
};

type FingerprintRequest = {
  inputPath: string;
  startSeconds: number;
  durationSeconds: number;
};
type TrickplayIndex = z.infer<typeof TrickplayIndexSchema>;

type TrickplayRequest = {
  inputPath: string;
  /**
   * How many times the file's library has been reset.
   *
   * Required for the same reason as on a preview: it addresses the sheets, and
   * a caller that omitted it would redraw a feature film's worth of them on
   * every hover instead of once.
   */
  generation: number;
  intervalSeconds: number;
  tileWidth: number;
  columns: number;
  rows: number;
  /**
   * Whether the caller will wait for rendering to finish.
   *
   * An import waits. A player does not: a feature length film takes minutes,
   * and seek previews are not worth delaying the film for.
   */
  wait?: boolean;
};
type SessionResponse = z.infer<typeof SessionResponseSchema>;
type TranscoderCapabilities = z.infer<typeof CapabilitiesSchema>;

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
  /**
   * The source picture's size, so the media service can size a hardware
   * scaler without guessing at expression support across four backends.
   */
  sourceSize?: [number, number];
};

/**
 * The media service as the rest of the server sees it.
 *
 * An interface rather than a concrete client so the transport can change from
 * a local socket to a remote pool without touching call sites. That seam is
 * the whole reason single-box deployment does not foreclose multi-node
 * transcoding. See ADR-0006.
 */
type Transcoder = {
  isReachable: () => Promise<boolean>;
  probe: (path: string) => Promise<MediaProbe>;
  startSession: (spec: SessionSpec) => Promise<SessionResponse>;
  readSessionFile: (sessionId: string, name: string) => Promise<TranscoderFile | null>;
  /**
   * Opens an original file for direct play, forwarding a byte range.
   *
   * Streamed rather than read: this is whole media, and a viewer who opens one
   * without a `Range` would otherwise put the entire film through the server's
   * memory on the way past.
   */
  readFile: (path: string, range: string | null) => Promise<TranscoderStreamedFile | null>;
  /**
   * Renders seek-bar previews, or reuses ones already on disk.
   */
  /**
   * Reduces a window of a file's audio to one hash per frame.
   *
   * Answers with hashes rather than a verdict: what two episodes share is
   * arithmetic over them, and that belongs where it can be tested without
   * media.
   */
  fingerprint: (request: FingerprintRequest) => Promise<Fingerprint>;
  /**
   * Reads one subtitle track out of a container as WebVTT.
   */
  readSubtitle: (request: { inputPath: string; streamIndex: number }) => Promise<string>;
  /**
   * Reads what the media service is doing right now.
   *
   * Left as parsed JSON rather than given a schema of its own: this is a
   * live reading for a person to look at, not something Flux makes decisions
   * from, and a monitoring endpoint that stops working because it grew a
   * field is worse than one that shows an unexpected one.
   */
  readMonitor: () => Promise<JsonValue>;
  /**
   * Opens the stream of readings, for a page that wants to watch.
   *
   * Null when the media service cannot be reached, so a monitoring page can
   * say so rather than hanging on a connection that will never open.
   */
  openMonitorStream: () => Promise<ReadableStream<Uint8Array> | null>;
  /**
   * Takes one frame of a file as a JPEG.
   */
  readFrame: (request: {
    inputPath: string;
    atSeconds: number;
    width: number;
  }) => Promise<ArrayBuffer>;
  /**
   * Makes, or finds, the short clip a library page plays.
   *
   * Made once when a file is imported and served as a file afterwards, so a
   * page full of previews costs nothing running.
   */
  requestPreview: (request: {
    inputPath: string;
    /**
     * How many times the file's library has been reset.
     *
     * Required rather than optional, and required on purpose: it is part of the
     * clip's address, so a call that left it out would ask for a different clip
     * than the scan made and re-encode one on every request.
     */
    generation: number;
    wait?: boolean;
    /**
     * Which audio stream the clip should carry, when one was chosen for it.
     *
     * Left out means whichever ffmpeg would pick on its own — the same as a
     * file with no forced language.
     */
    audioStreamIndex?: number;
  }) => Promise<{ id: string; url: string; isReady: boolean }>;
  /**
   * Reads a made clip, passing a byte range on to the media service.
   *
   * The range is forwarded rather than applied here so that the service reads
   * only the bytes asked for, and the answer is streamed rather than collected:
   * a preview is around 18 MB, and a hover that fetches one without a `Range`
   * used to put all of it on this heap before sending a byte.
   */
  readPreviewFile: (
    id: string,
    name: string,
    range: string | null,
  ) => Promise<TranscoderStreamedFile | null>;
  requestTrickplay: (request: TrickplayRequest) => Promise<TrickplayIndex>;
  /**
   * Deletes preview clips nothing addresses any more.
   *
   * Told what is still wanted as the requests that would ask for it, never as
   * addresses: the address is a hash of the request and belongs to the media
   * service, so computing one here would be a second implementation of its
   * naming scheme — and the first disagreement would delete clips in use.
   */
  sweepPreviews: (keep: PreviewSweepSubject[]) => Promise<SweepReport>;
  /**
   * Deletes thumbnail sheets nothing addresses any more.
   */
  sweepTrickplay: (keep: TrickplayRequest[]) => Promise<SweepReport>;
  /**
   * Counts what the artefact cache holds, rather than reading the figure the
   * media service took on its own timer.
   *
   * Null when the media service cannot be reached or answers with something
   * unreadable, so a page can say the count did not happen rather than show a
   * cache that appears to have emptied.
   */
  measureCache: () => Promise<CacheUse | null>;
  /**
   * Removes one item's artefacts, so the next request makes them again.
   *
   * The safe kind of deletion, unlike a sweep: an operator points at one item
   * rather than at a computed list of everything unwanted, and the worst case
   * is that a clip is rendered a second time.
   *
   * Answers whether anything was there, so a caller can tell "removed it" from
   * "there was nothing to remove".
   */
  forgetPreview: (request: PreviewSweepSubject) => Promise<boolean>;
  forgetTrickplay: (request: TrickplayRequest) => Promise<boolean>;
  readTrickplayFile: (id: string, name: string) => Promise<TranscoderFile | null>;
  stopSession: (id: string) => Promise<boolean>;
  /**
   * Tells the media service a session is still wanted, and whether it is
   * currently playing or paused.
   *
   * `false` means the service no longer knows this session — the caller
   * should stop sending heartbeats for it.
   */
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

/**
 * A file being forwarded as it arrives, rather than after it has all arrived.
 *
 * What the media service sends is what a browser asked for, so there is nothing
 * for the server to do to it but pass it on. Holding it first is pure cost, and
 * the cost is the size of the file: a viewer opening a film with no `Range` had
 * the whole film read into this process before any of it was sent.
 */
type TranscoderStreamedFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  status: number;
  contentRange: string | null;
  contentLength: string | null;
};

type CreateTranscoderClientOptions = {
  /**
   * Where the media service listens.
   *
   * `unix:/run/flux-transcoder.sock` uses a Unix socket, which is what a
   * single-box deployment does: no port to expose, no chance of another
   * process on the network reaching a service that has no authentication of
   * its own. An `http://` address is used when the media service runs
   * elsewhere. See ADR-0006.
   */
  baseUrl: string;
  fetchImpl?: FetchLike;
};

const UNIX_PREFIX = 'unix:';

/**
 * Splits a socket URL into the path to connect to and the URL to request.
 *
 * Undici needs a real origin even over a socket, so requests are addressed to
 * a placeholder host that the dispatcher ignores.
 */
const readSocketPath = (baseUrl: string): string | null =>
  baseUrl.startsWith(UNIX_PREFIX) ? baseUrl.slice(UNIX_PREFIX.length) : null;

/**
 * Builds a fetch bound to a Unix socket.
 */
/**
 * Narrows any response to the shape Flux uses.
 *
 * The body is parsed through the JSON contract rather than trusted, which also
 * types it: `Response.json()` is `unknown`, and casting it would be exactly
 * the thing the standards forbid.
 */
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
 * The ordinary network fetch, narrowed to what Flux uses.
 */
const httpFetch: FetchLike = async (url, init) => narrow(await fetch(url, init));

/**
 * How long a request to the media service may take before it is abandoned.
 *
 * Generous, because probing a large file over a slow disk is genuinely slow.
 * Finite, because the alternative is what this replaced: a request that hangs
 * for ever if the service accepts a connection and then never answers, which
 * leaves the page that asked waiting for ever with nothing to report.
 */
const REQUEST_TIMEOUT_MILLISECONDS = 60_000;

/**
 * How long a question about whether the service is alive may take.
 *
 * Much shorter: this one is asked to draw a page, and an answer that arrives
 * after a minute is no use to anybody looking at it.
 */
const HEALTH_TIMEOUT_MILLISECONDS = 5_000;

const createSocketFetch = (socketPath: string): FetchLike => {
  const agent = new Agent({
    connect: { socketPath },
    headersTimeout: REQUEST_TIMEOUT_MILLISECONDS,
    bodyTimeout: REQUEST_TIMEOUT_MILLISECONDS,
  });

  return async (url, init) => narrow(await undiciFetch(url, { ...init, dispatcher: agent }));
};

/**
 * A response whose body is still arriving.
 *
 * Carries the status and headers as well as the body, because a media file is
 * fetched with a `Range` and the answer to that is a 206 and a `content-range`
 * the browser has to be told about.
 */
type StreamedResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array> | null;
};

/**
 * Opens a response whose body is read as it arrives.
 *
 * Separate from the narrowed fetch every other call uses, because that one
 * reads a whole body before returning it — which is right for a probe, wrong
 * for a stream that never ends, and wrong for a film. A viewer opening a file
 * Flux can send as it is does so without a `Range`, and reading that whole
 * answer before forwarding it means a gigabyte of film through this heap to
 * deliver a gigabyte of film.
 *
 * The connection pool is made once and kept, like the one every other call
 * uses. Making one per request leaks a pool and its socket every time: the
 * admin monitor is an `EventSource`, which reconnects on its own, so a page
 * left open during a scan quietly consumed file descriptors until the media
 * service could no longer be reached at all.
 */
const createStreamFetch = (
  socketPath: string | null,
): ((url: string, init?: HttpRequestInit) => Promise<StreamedResponse>) => {
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
}: CreateTranscoderClientOptions): Transcoder => {
  const socketPath = readSocketPath(baseUrl);
  const origin = socketPath === null ? baseUrl : 'http://transcoder.local';
  const call2 = fetchImpl ?? (socketPath === null ? httpFetch : createSocketFetch(socketPath));
  const call = async (path: string, init?: HttpRequestInit): Promise<HttpResponse> => {
    const response = await call2(`${origin}${path}`, init);

    if (!response.ok) {
      throw new TranscoderError(`The media service rejected ${path}.`, response.status);
    }

    return response;
  };

  const streamFrom = createStreamFetch(socketPath);

  /**
   * Opens a file on the media service and hands back the body still arriving.
   *
   * Used for anything whose size is the media's rather than Flux's — an
   * original file and a preview clip. The status and the range headers come
   * straight from the service, because it is the one that decided them.
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

    startSession: async (spec) =>
      SessionResponseSchema.parse(await (await postJson('/sessions', spec)).json()),

    readSessionFile: async (sessionId, name) => {
      const response = await call2(
        `${origin}/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(name)}`,
      );

      if (!response.ok) {
        return null;
      }

      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },

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
      PreviewClipSchema.parse(await (await postJson('/previews', request)).json()),

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

    requestTrickplay: async (request) =>
      TrickplayIndexSchema.parse(await (await postJson('/trickplay', request)).json()),

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

    stopSession: async (id) => {
      const response = await call2(`${origin}/sessions/${id}`, { method: 'DELETE' });

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
