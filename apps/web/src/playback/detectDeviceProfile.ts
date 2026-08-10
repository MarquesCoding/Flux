import DeviceProfileModule from '@FluxContracts/schemas/DeviceProfile'
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile'

const { DeviceProfileSchema } = DeviceProfileModule

type CodecProbe = (mimeType: string) => boolean

type DetectDeviceProfileOptions = {
  isTypeSupported: CodecProbe
  supportsHdr: boolean
  screenWidth: number
  screenHeight: number
  name: string
  maxBitrateKbps?: number
}

/**
 * The probes Flux uses to decide what a browser can play.
 *
 * Each is a concrete codec string rather than a family name, because
 * `video/mp4` alone answers almost nothing: a browser that reports MP4 support
 * may still refuse HEVC or 10-bit AV1.
 */
const VIDEO_PROBES = [
  { codec: 'h264', mimeType: 'video/mp4; codecs="avc1.640028"' },
  { codec: 'hevc', mimeType: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  { codec: 'av1', mimeType: 'video/mp4; codecs="av01.0.05M.08"' },
  { codec: 'vp9', mimeType: 'video/webm; codecs="vp9"' },
] as const

const AUDIO_PROBES = [
  { codec: 'aac', mimeType: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'ac3', mimeType: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mimeType: 'audio/mp4; codecs="ec-3"' },
  { codec: 'opus', mimeType: 'audio/webm; codecs="opus"' },
  { codec: 'flac', mimeType: 'audio/mp4; codecs="flac"' },
] as const

const DEFAULT_MAX_BITRATE_KBPS = 20_000

/**
 * Builds a device profile from what the browser actually reports.
 *
 * Every value here comes from a capability probe rather than a user agent
 * string. Identifying a client by user agent is guesswork that goes stale the
 * moment a browser changes, and is exactly the guesswork ADR-0011 set out to
 * avoid by letting clients declare their own profile.
 *
 * `h264` and `aac` are always claimed as fallbacks. Any browser capable of
 * Media Source Extensions plays them, and a profile with no direct play entry
 * would make the server transcode into a format the client just said it could
 * not accept.
 */
const detectDeviceProfile = ({
  isTypeSupported,
  supportsHdr,
  screenWidth,
  screenHeight,
  name,
  maxBitrateKbps = DEFAULT_MAX_BITRATE_KBPS,
}: DetectDeviceProfileOptions): DeviceProfile => {
  const videoCodecs = VIDEO_PROBES.filter((probe) => isTypeSupported(probe.mimeType)).map(
    (probe) => probe.codec,
  )

  const audioCodecs = AUDIO_PROBES.filter((probe) => isTypeSupported(probe.mimeType)).map(
    (probe) => probe.codec,
  )

  const video = videoCodecs.length > 0 ? [...videoCodecs] : ['h264']
  const audio = audioCodecs.length > 0 ? [...audioCodecs] : ['aac']

  // Parsed rather than asserted: the profile Flux sends must satisfy the same
  // contract the server validates it against, so a mistake here fails in the
  // client that made it rather than as a 400 the user cannot act on.
  return DeviceProfileSchema.parse({
    schemaVersion: 1,
    name,
    maxWidth: Math.max(screenWidth, 640),
    maxHeight: Math.max(screenHeight, 480),
    maxBitrateKbps,
    maxAudioChannels: 2,
    supportedVideoRanges: supportsHdr ? ['SDR', 'HDR10', 'HLG'] : ['SDR'],
    supportedSubtitleFormats: ['webvtt'],
    directPlayProfiles: [
      {
        container: 'mp4',
        videoCodecs: video,
        audioCodecs: audio,
      },
    ],
    transcodingProfiles: [
      { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
    ],
  })
}

/**
 * Reads the browser's real capabilities.
 *
 * Kept apart from the pure builder so the decision logic can be tested against
 * any browser's answers without needing that browser.
 */
const detectFromBrowser = (name = 'Browser'): DeviceProfile => {
  const isTypeSupported: CodecProbe =
    'MediaSource' in window && typeof window.MediaSource.isTypeSupported === 'function'
      ? (mimeType) => window.MediaSource.isTypeSupported(mimeType)
      : () => false

  return detectDeviceProfile({
    isTypeSupported,
    supportsHdr: window.matchMedia('(dynamic-range: high)').matches,
    screenWidth: Math.round(window.screen.width * window.devicePixelRatio),
    screenHeight: Math.round(window.screen.height * window.devicePixelRatio),
    name,
  })
}

export type { CodecProbe, DetectDeviceProfileOptions }

export default { detectDeviceProfile, detectFromBrowser, VIDEO_PROBES, AUDIO_PROBES }
