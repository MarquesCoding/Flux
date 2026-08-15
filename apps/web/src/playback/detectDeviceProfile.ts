import { DeviceProfileSchema } from '@FluxContracts/schemas/DeviceProfile';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';

type CodecProbe = (mimeType: string) => boolean;

type DetectDeviceProfileOptions = {
  isTypeSupported: CodecProbe;
  supportsHdr: boolean;
  screenWidth: number;
  screenHeight: number;
  name: string;
  maxBitrateKbps?: number;
};

const VIDEO_PROBES = [
  { codec: 'h264', mimeType: 'video/mp4; codecs="avc1.640028"' },
  { codec: 'hevc', mimeType: 'video/mp4; codecs="hvc1.1.6.L120.B0"' },
  { codec: 'av1', mimeType: 'video/mp4; codecs="av01.0.05M.08"' },
  { codec: 'vp9', mimeType: 'video/webm; codecs="vp9"' },
] as const;

const TEN_BIT_VIDEO_PROBES = [
  { codec: 'hevc', mimeType: 'video/mp4; codecs="hvc1.2.4.L120.B0"' },
  { codec: 'av1', mimeType: 'video/mp4; codecs="av01.0.05M.10"' },
  { codec: 'vp9', mimeType: 'video/webm; codecs="vp09.02.10.10"' },
] as const;

const AUDIO_PROBES = [
  { codec: 'aac', mimeType: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'ac3', mimeType: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mimeType: 'audio/mp4; codecs="ec-3"' },
  { codec: 'opus', mimeType: 'audio/webm; codecs="opus"' },
  { codec: 'flac', mimeType: 'audio/mp4; codecs="flac"' },
] as const;

const DEFAULT_MAX_BITRATE_KBPS = 20_000;

/**
 * Builds a device profile from what the browser actually reports.
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
  );

  const audioCodecs = AUDIO_PROBES.filter((probe) => isTypeSupported(probe.mimeType)).map(
    (probe) => probe.codec,
  );

  const tenBitVideoCodecs = TEN_BIT_VIDEO_PROBES.filter((probe) =>
    isTypeSupported(probe.mimeType),
  ).map((probe) => probe.codec);

  const video = videoCodecs.length > 0 ? [...videoCodecs] : ['h264'];
  const audio = audioCodecs.length > 0 ? [...audioCodecs] : ['aac'];

  return DeviceProfileSchema.parse({
    schemaVersion: 1,
    name,
    maxWidth: Math.max(screenWidth, 640),
    maxHeight: Math.max(screenHeight, 480),
    maxBitrateKbps,
    maxAudioChannels: 2,
    supportedVideoRanges: supportsHdr ? ['SDR', 'HDR10', 'HLG'] : ['SDR'],
    tenBitVideoCodecs,
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
  });
};

type MediaQuerySource = {
  matchMedia?: (query: string) => { matches: boolean };
};

/**
 * Reads the browser's real capabilities.
 */
const detectFromBrowser = (name = 'Browser'): DeviceProfile => {
  const isTypeSupported: CodecProbe =
    'MediaSource' in window && typeof window.MediaSource.isTypeSupported === 'function'
      ? (mimeType) => window.MediaSource.isTypeSupported(mimeType)
      : () => false;

  const queries: MediaQuerySource = window;

  return detectDeviceProfile({
    isTypeSupported,
    supportsHdr: queries.matchMedia?.('(dynamic-range: high)').matches ?? false,
    screenWidth: Math.round(window.screen.width * window.devicePixelRatio),
    screenHeight: Math.round(window.screen.height * window.devicePixelRatio),
    name,
  });
};

export type { CodecProbe, DetectDeviceProfileOptions };

export { detectDeviceProfile, detectFromBrowser, VIDEO_PROBES, AUDIO_PROBES };
