import { z } from 'zod'

/**
 * The steps a viewer can pick below the source's own resolution.
 *
 * `original` is deliberately absent: it means no additional clamp on top of
 * whatever device negotiation already decides, not a step with its own
 * numbers.
 */
const QUALITY_STEP_IDS = ['1440p', '1080p', '720p', '480p', '360p', '240p', '144p'] as const

const QualityStepIdSchema = z.enum(QUALITY_STEP_IDS)

/**
 * The ladder a requested step resolves to: a bounding box the source is
 * scaled to fit inside (never upscaled) and a video bitrate ceiling.
 *
 * Values follow YouTube's own delivery bitrates for H.264 at standard frame
 * rate. Audio is left alone above 720p and compressed to a flat 128kbps
 * below it, per how Flux differs from Jellyfin's single global bandwidth cap.
 */
const QUALITY_STEPS = [
  { id: '1440p', label: '1440p', maxWidth: 2560, maxHeight: 1440, maxVideoBitrateKbps: 8000 },
  { id: '1080p', label: '1080p', maxWidth: 1920, maxHeight: 1080, maxVideoBitrateKbps: 4500 },
  { id: '720p', label: '720p', maxWidth: 1280, maxHeight: 720, maxVideoBitrateKbps: 2500 },
  { id: '480p', label: '480p', maxWidth: 854, maxHeight: 480, maxVideoBitrateKbps: 1000 },
  { id: '360p', label: '360p', maxWidth: 640, maxHeight: 360, maxVideoBitrateKbps: 700 },
  { id: '240p', label: '240p', maxWidth: 426, maxHeight: 240, maxVideoBitrateKbps: 400 },
  { id: '144p', label: '144p', maxWidth: 256, maxHeight: 144, maxVideoBitrateKbps: 150 },
] as const

const COMPRESSED_AUDIO_THRESHOLD_HEIGHT = 720

const COMPRESSED_AUDIO_MAX_BITRATE_KBPS = 128

export type QualityStepId = z.infer<typeof QualityStepIdSchema>
export type QualityStep = (typeof QUALITY_STEPS)[number]

export default {
  QUALITY_STEP_IDS,
  QualityStepIdSchema,
  QUALITY_STEPS,
  COMPRESSED_AUDIO_THRESHOLD_HEIGHT,
  COMPRESSED_AUDIO_MAX_BITRATE_KBPS,
}
