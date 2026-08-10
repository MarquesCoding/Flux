import { Agent, fetch as undiciFetch } from 'undici'
import { z } from 'zod'
import JsonValueModule from '@FluxContracts/schemas/JsonValue'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { JsonValueSchema } = JsonValueModule

/**
 * The part of a response Flux uses.
 *
 * Structural rather than the global `Response`, because a Unix socket request
 * goes through undici and returns undici's own type. Both satisfy this, so no
 * assertion is needed to treat them alike.
 */
type HttpResponse = {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<JsonValue>
  arrayBuffer: () => Promise<ArrayBuffer>
}

type HttpRequestInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

type FetchLike = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>

const ProbeVideoSchema = z.object({
  index: z.number().int(),
  codec: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  range: z.string(),
  bitrateKbps: z.number().int().nullable(),
  bitDepth: z.number().int().nullable(),
})

const ProbeAudioSchema = z.object({
  index: z.number().int(),
  codec: z.string(),
  channels: z.number().int(),
  language: z.string().nullable(),
  isAtmos: z.boolean(),
})

const ProbeSubtitleSchema = z.object({
  index: z.number().int(),
  format: z.string(),
  language: z.string().nullable(),
  isForced: z.boolean(),
  isImageBased: z.boolean(),
})

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
})

const SessionResponseSchema = z.object({
  id: z.string().min(1),
  manifest: z.string().min(1),
})

const CapabilitiesSchema = z.object({
  ffmpegVersion: z.string(),
  encoders: z.array(
    z.object({
      codec: z.string(),
      encoder: z.string(),
      accel: z.string(),
      verified: z.boolean(),
    }),
  ),
  hardwareAccels: z.array(z.string()),
})

const TrickplayIndexSchema = z.object({
  id: z.string(),
  intervalSeconds: z.number(),
  tileWidth: z.number(),
  tileHeight: z.number(),
  columns: z.number(),
  rows: z.number(),
  sheets: z.array(z.string()),
  index: z.string(),
})

type MediaProbe = z.infer<typeof MediaProbeSchema>
type TrickplayIndex = z.infer<typeof TrickplayIndexSchema>

type TrickplayRequest = {
  inputPath: string
  intervalSeconds: number
  tileWidth: number
  columns: number
  rows: number
}
type SessionResponse = z.infer<typeof SessionResponseSchema>
type TranscoderCapabilities = z.infer<typeof CapabilitiesSchema>

type SessionSpec = {
  inputPath: string
  startSeconds: number
  segmentSeconds: number
  hardwareAccel: string
  video:
    | { kind: 'copy' }
    | {
        kind: 'encode'
        encoder: string
        maxBitrateKbps: number
        maxWidth: number
        maxHeight: number
      }
  audio:
    { kind: 'copy' } | { kind: 'encode'; encoder: string; channels: number; maxBitrateKbps: number }
}

/**
 * The media service as the rest of the server sees it.
 *
 * An interface rather than a concrete client so the transport can change from
 * a local socket to a remote pool without touching call sites. That seam is
 * the whole reason single-box deployment does not foreclose multi-node
 * transcoding. See ADR-0006.
 */
type Transcoder = {
  isReachable: () => Promise<boolean>
  probe: (path: string) => Promise<MediaProbe>
  startSession: (spec: SessionSpec) => Promise<SessionResponse>
  readSessionFile: (sessionId: string, name: string) => Promise<TranscoderFile | null>
  readFile: (path: string, range: string | null) => Promise<TranscoderRangedFile | null>
  /**
   * Renders seek-bar previews, or reuses ones already on disk.
   */
  requestTrickplay: (request: TrickplayRequest) => Promise<TrickplayIndex>
  readTrickplayFile: (id: string, name: string) => Promise<TranscoderFile | null>
  stopSession: (id: string) => Promise<boolean>
  capabilities: () => Promise<TranscoderCapabilities>
}

type TranscoderFile = {
  body: ArrayBuffer
  contentType: string
}

type TranscoderRangedFile = TranscoderFile & {
  status: number
  contentRange: string | null
}

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
  baseUrl: string
  fetchImpl?: FetchLike
}

const UNIX_PREFIX = 'unix:'

/**
 * Splits a socket URL into the path to connect to and the URL to request.
 *
 * Undici needs a real origin even over a socket, so requests are addressed to
 * a placeholder host that the dispatcher ignores.
 */
const readSocketPath = (baseUrl: string): string | null =>
  baseUrl.startsWith(UNIX_PREFIX) ? baseUrl.slice(UNIX_PREFIX.length) : null

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
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<TBody>
  arrayBuffer: () => Promise<ArrayBuffer>
}): HttpResponse => ({
  ok: response.ok,
  status: response.status,
  headers: { get: (name) => response.headers.get(name) },
  json: async () => JsonValueSchema.parse(await response.json()),
  arrayBuffer: () => response.arrayBuffer(),
})

/**
 * The ordinary network fetch, narrowed to what Flux uses.
 */
const httpFetch: FetchLike = async (url, init) => narrow(await fetch(url, init))

const createSocketFetch = (socketPath: string): FetchLike => {
  const agent = new Agent({ connect: { socketPath } })

  return async (url, init) => narrow(await undiciFetch(url, { ...init, dispatcher: agent }))
}

class TranscoderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'TranscoderError'
  }
}

/**
 * Talks to the Rust media service over HTTP.
 */
const createTranscoderClient = ({
  baseUrl,
  fetchImpl,
}: CreateTranscoderClientOptions): Transcoder => {
  const socketPath = readSocketPath(baseUrl)
  const origin = socketPath === null ? baseUrl : 'http://transcoder.local'
  const call2 = fetchImpl ?? (socketPath === null ? httpFetch : createSocketFetch(socketPath))
  const call = async (path: string, init?: HttpRequestInit): Promise<HttpResponse> => {
    const response = await call2(`${origin}${path}`, init)

    if (!response.ok) {
      throw new TranscoderError(`The media service rejected ${path}.`, response.status)
    }

    return response
  }

  const postJson = (path: string, body: object): Promise<HttpResponse> =>
    call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  return {
    isReachable: async () => {
      const response = await call2(`${origin}/health`).catch(() => null)

      return response !== null && response.ok
    },

    probe: async (path) =>
      MediaProbeSchema.parse(await (await postJson('/probe', { path })).json()),

    startSession: async (spec) =>
      SessionResponseSchema.parse(await (await postJson('/sessions', spec)).json()),

    readSessionFile: async (sessionId, name) => {
      const response = await call2(
        `${origin}/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(name)}`,
      )

      if (!response.ok) {
        return null
      }

      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    },

    readFile: async (path, range) => {
      const response = await call2(`${origin}/file?path=${encodeURIComponent(path)}`, {
        headers: range === null ? {} : { range },
      })

      if (!response.ok) {
        return null
      }

      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        status: response.status,
        contentRange: response.headers.get('content-range'),
      }
    },

    requestTrickplay: async (request) =>
      TrickplayIndexSchema.parse(await (await postJson('/trickplay', request)).json()),

    readTrickplayFile: async (id, name) => {
      const response = await call2(
        `${origin}/trickplay/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
      )

      if (!response.ok) {
        return null
      }

      return {
        body: await response.arrayBuffer(),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    },

    stopSession: async (id) => {
      const response = await call2(`${origin}/sessions/${id}`, { method: 'DELETE' })

      return response.ok
    },

    capabilities: async () => CapabilitiesSchema.parse(await (await call('/capabilities')).json()),
  }
}

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
  TranscoderFile,
  TranscoderRangedFile,
}

export default { createTranscoderClient, readSocketPath, TranscoderError, MediaProbeSchema }
