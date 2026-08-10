import { z } from 'zod'

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

type MediaProbe = z.infer<typeof MediaProbeSchema>
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
  probe: (path: string) => Promise<MediaProbe>
  startSession: (spec: SessionSpec) => Promise<SessionResponse>
  stopSession: (id: string) => Promise<boolean>
  capabilities: () => Promise<TranscoderCapabilities>
}

type CreateTranscoderClientOptions = {
  baseUrl: string
  fetchImpl?: typeof fetch
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
  fetchImpl = fetch,
}: CreateTranscoderClientOptions): Transcoder => {
  const call = async (path: string, init?: RequestInit): Promise<Response> => {
    const response = await fetchImpl(`${baseUrl}${path}`, init)

    if (!response.ok) {
      throw new TranscoderError(`The media service rejected ${path}.`, response.status)
    }

    return response
  }

  const postJson = (path: string, body: object): Promise<Response> =>
    call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  return {
    probe: async (path) =>
      MediaProbeSchema.parse(await (await postJson('/probe', { path })).json()),

    startSession: async (spec) =>
      SessionResponseSchema.parse(await (await postJson('/sessions', spec)).json()),

    stopSession: async (id) => {
      const response = await fetchImpl(`${baseUrl}/sessions/${id}`, { method: 'DELETE' })

      return response.ok
    },

    capabilities: async () => CapabilitiesSchema.parse(await (await call('/capabilities')).json()),
  }
}

export type { MediaProbe, SessionResponse, SessionSpec, Transcoder, TranscoderCapabilities }

export default { createTranscoderClient, TranscoderError, MediaProbeSchema }
