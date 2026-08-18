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

const HE_AAC_PROBES = ['audio/mp4; codecs="mp4a.40.5"', 'audio/mp4; codecs="mp4a.40.29"'] as const;

const HE_AAC_PROFILE = 'HE-AAC';

const H264_LEVEL_PROBES = [
  { level: 62, mimeType: 'video/mp4; codecs="avc1.64003e"' },
  { level: 61, mimeType: 'video/mp4; codecs="avc1.64003d"' },
  { level: 60, mimeType: 'video/mp4; codecs="avc1.64003c"' },
  { level: 52, mimeType: 'video/mp4; codecs="avc1.640034"' },
  { level: 51, mimeType: 'video/mp4; codecs="avc1.640033"' },
  { level: 50, mimeType: 'video/mp4; codecs="avc1.640032"' },
  { level: 42, mimeType: 'video/mp4; codecs="avc1.64002a"' },
  { level: 41, mimeType: 'video/mp4; codecs="avc1.640029"' },
  { level: 40, mimeType: 'video/mp4; codecs="avc1.640028"' },
  { level: 31, mimeType: 'video/mp4; codecs="avc1.64001f"' },
  { level: 30, mimeType: 'video/mp4; codecs="avc1.64001e"' },
] as const;

const HEVC_LEVEL_PROBES = [
  { level: 186, mimeType: 'video/mp4; codecs="hvc1.1.6.L186.B0"' },
  { level: 183, mimeType: 'video/mp4; codecs="hvc1.1.6.L183.B0"' },
  { level: 180, mimeType: 'video/mp4; codecs="hvc1.1.6.L180.B0"' },
  { level: 156, mimeType: 'video/mp4; codecs="hvc1.1.6.L156.B0"' },
  { level: 153, mimeType: 'video/mp4; codecs="hvc1.1.6.L153.B0"' },
  { level: 150, mimeType: 'video/mp4; codecs="hvc1.1.6.L150.B0"' },
  { level: 123, mimeType: 'video/mp4; codecs="hvc1.1.6.L123.B0"' },
  { level: 120, mimeType: 'video/mp4; codecs="hvc1.1.6.L120.B0"' },
  { level: 93, mimeType: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  { level: 90, mimeType: 'video/mp4; codecs="hvc1.1.6.L90.B0"' },
] as const;

const DEFAULT_MAX_BITRATE_KBPS = 20_000;

/**
 * The highest codec level this browser admits to decoding, by asking about each in turn.
 *
 * Probes are ordered from the highest level down and the first accepted one wins, so a browser that
 * takes everything answers on its first question. Nothing is returned where a browser accepts none
 * of them, because claiming a ceiling nobody stated would refuse files that in fact play.
 *
 * @param probes - Level probes, highest first.
 * @param isTypeSupported - What the browser answers about a MIME type.
 * @returns The highest level accepted, or nothing where none were.
 */
const highestSupportedLevel = (
  probes: readonly { level: number; mimeType: string }[],
  isTypeSupported: CodecProbe,
): number | null => probes.find((probe) => isTypeSupported(probe.mimeType))?.level ?? null;

/**
 * The audio profiles this browser decodes the base codec of but not the extension.
 *
 * HE-AAC is the one that matters in practice: it is 7.7% of a real library, it declares itself as
 * plain AAC to anything that only reads the codec name, and a browser that decodes AAC-LC may still
 * refuse it. Asked only where AAC itself is supported, since otherwise the codec check already
 * covers it.
 *
 * @param audioCodecs - The codecs this browser accepted.
 * @param isTypeSupported - What the browser answers about a MIME type.
 * @returns The profile names to refuse a direct play over.
 */
const unsupportedAudioProfilesFor = (
  audioCodecs: readonly string[],
  isTypeSupported: CodecProbe,
): string[] => {
  if (!audioCodecs.includes('aac')) {
    return [];
  }

  return HE_AAC_PROBES.some((mimeType) => isTypeSupported(mimeType)) ? [] : [HE_AAC_PROFILE];
};

/**
 * Builds the profile the server negotiates against, from what this browser actually reports it can
 * play rather than from what its name suggests — two browsers of the same name on different machines
 * answer differently, and guessing produces a film that will not play.
 *
 * Interlaced video is declared unplayable outright rather than probed. Media Source has no
 * deinterlacer, so a browser decodes an interlaced stream and then shows the combing, and there is
 * no MIME type that asks the question.
 *
 * Frame rate, reference frames and audio sample rate are deliberately left unstated. None can be
 * asked of a browser, and a guessed ceiling costs a needless transcode on every file above it.
 *
 * @param capabilities - What the browser reported it can decode.
 * @returns The profile to send with a session request.
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

  const h264Level = highestSupportedLevel(H264_LEVEL_PROBES, isTypeSupported);
  const hevcLevel = highestSupportedLevel(HEVC_LEVEL_PROBES, isTypeSupported);

  return DeviceProfileSchema.parse({
    schemaVersion: 1,
    name,
    maxWidth: Math.max(screenWidth, 640),
    maxHeight: Math.max(screenHeight, 480),
    maxBitrateKbps,
    maxAudioChannels: 2,
    supportedVideoRanges: supportsHdr ? ['SDR', 'HDR10', 'HLG'] : ['SDR'],
    tenBitVideoCodecs,
    maxVideoLevels: {
      ...(h264Level === null ? {} : { h264: h264Level }),
      ...(hevcLevel === null ? {} : { hevc: hevcLevel }),
    },
    canPlayInterlaced: false,
    unsupportedAudioProfiles: unsupportedAudioProfilesFor(audio, isTypeSupported),
    supportedSubtitleFormats: ['webvtt'],
    directPlayProfiles: [
      {
        container: 'mp4',
        videoCodecs: video,
        audioCodecs: audio,
      },
    ],
    transcodingProfiles: [
      { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
    ],
  });
};

type MediaQuerySource = {
  matchMedia?: (query: string) => { matches: boolean };
};

/**
 * Asks the browser which containers, codecs and ranges it can actually play, by testing each rather
 * than by reading its name.
 *
 * @param name - What to call this device in the session list.
 * @returns What this browser can play.
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

export { detectDeviceProfile, detectFromBrowser };
