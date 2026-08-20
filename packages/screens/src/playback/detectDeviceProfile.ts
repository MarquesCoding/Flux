import { DeviceProfileSchema } from '@FluxContracts/schemas/DeviceProfile';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';

type CodecProbe = (mimeType: string) => boolean;

type DetectDeviceProfileOptions = {
  isTypeSupported: CodecProbe;
  platform: string;
  supportsHdr: boolean;
  screenWidth: number;
  screenHeight: number;
  name: string;
  maxBitrateKbps?: number;
  maxAudioChannels?: number;
};

const STEREO = 2;

const VIDEO_PROBES = [
  { codec: 'h264', mimeType: 'video/mp4; codecs="avc1.640028"' },
  { codec: 'hevc', mimeType: 'video/mp4; codecs="hvc1.1.6.L120.B0"' },
  { codec: 'av1', mimeType: 'video/mp4; codecs="av01.0.05M.08"' },
  { codec: 'vp9', mimeType: 'video/mp4; codecs="vp09.00.10.08"' },
] as const;

const TEN_BIT_VIDEO_PROBES = [
  { codec: 'hevc', mimeType: 'video/mp4; codecs="hvc1.2.4.L120.B0"' },
  { codec: 'av1', mimeType: 'video/mp4; codecs="av01.0.05M.10"' },
  { codec: 'vp9', mimeType: 'video/mp4; codecs="vp09.02.10.10"' },
] as const;

const AUDIO_PROBES = [
  { codec: 'aac', mimeType: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'ac3', mimeType: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mimeType: 'audio/mp4; codecs="ec-3"' },
  { codec: 'opus', mimeType: 'audio/mp4; codecs="opus"' },
  { codec: 'flac', mimeType: 'audio/mp4; codecs="flac"' },
] as const;

const DOLBY_CODECS = ['ac3', 'eac3'] as const;

/**
 * Whether what this client says about Dolby can be believed.
 *
 * A build with `enable_platform_ac3_eac3_audio` turned on — castLabs' Electron is one — answers that
 * it plays AC-3 and E-AC-3, and on macOS and Windows it does. The flag enables *platform* decoders,
 * and Chromium implements those for those two platforms only, so the same build on Linux answers
 * yes and then plays silence.
 *
 * That is worse than answering no. `negotiatePlayback` believes what a client says it can decode, so
 * a client claiming Dolby it cannot decode gets direct play and hands somebody a film with no sound —
 * where a client that admits it cannot gets an honest transcode and a working one.
 *
 * Reported by a tester on castLabs' own build and confirmed by castLabs:
 * https://github.com/castlabs/electron-releases/issues/221
 *
 * @param platform - What the client says it is running on.
 * @returns Whether a claim of Dolby support means anything here.
 */
const dolbyCanBeBelieved = (platform: string): boolean => !/linux|x11|cros/i.test(platform);

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
 * Reads a channel count as a whole number of channels, never fewer than two.
 *
 * @param claimed - What the device answered.
 * @returns The count to declare.
 */
const atLeastStereo = (claimed: number): number =>
  Number.isFinite(claimed) ? Math.max(STEREO, Math.floor(claimed)) : STEREO;

/**
 * Builds the profile the server negotiates against, from what this browser actually reports it can
 * play rather than from what its name suggests — two browsers of the same name on different machines
 * answer differently, and guessing produces a film that will not play.
 *
 * Interlaced video is declared unplayable outright rather than probed. Media Source has no
 * deinterlacer, so a browser decodes an interlaced stream and then shows the combing, and there is
 * no MIME type that asks the question.
 *
 * Frame rate, reference frames, audio sample rate and bitrate are deliberately left unstated. None
 * can be asked of a browser, and a guessed ceiling costs a needless transcode on every file above
 * it.
 *
 * Bitrate was guessed anyway, at twenty megabits, and then reported back as “the client limit” in
 * the reason a film had been re-encoded — a figure Flux invented and attributed to a browser that
 * never said it. A viewer who wants less than the file pins a quality step, which is a ceiling
 * somebody actually chose.
 *
 * @param capabilities - What the browser reported it can decode.
 * @returns The profile to send with a session request.
 */
const detectDeviceProfile = ({
  isTypeSupported,
  platform,
  supportsHdr,
  screenWidth,
  screenHeight,
  name,
  maxBitrateKbps,
  maxAudioChannels = STEREO,
}: DetectDeviceProfileOptions): DeviceProfile => {
  const videoCodecs = VIDEO_PROBES.filter((probe) => isTypeSupported(probe.mimeType)).map(
    (probe) => probe.codec,
  );

  const believable = dolbyCanBeBelieved(platform);

  const audioCodecs = AUDIO_PROBES.filter(
    (probe) =>
      isTypeSupported(probe.mimeType) &&
      (believable || !DOLBY_CODECS.some((dolby) => dolby === probe.codec)),
  ).map((probe) => probe.codec);

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
    ...(maxBitrateKbps === undefined ? {} : { maxBitrateKbps }),
    maxAudioChannels: atLeastStereo(maxAudioChannels),
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

type AudioOutputSource = {
  AudioContext?: new () => {
    destination: { maxChannelCount: number };
    close: () => Promise<void>;
  };
};

/**
 * Asks the current output device how many channels it accepts, which is the only part of an audio
 * profile a browser will answer.
 *
 * It describes the device rather than the browser, so it is read once when the profile is built and
 * goes stale the moment somebody plugs in headphones or connects a receiver. That is a worse answer
 * than renegotiating on every device change and a far better one than the two this used to assume.
 *
 * @returns What the output accepts, never fewer than two.
 */
const channelsTheOutputAccepts = (): number => {
  const source: AudioOutputSource = window;

  if (source.AudioContext === undefined) {
    return STEREO;
  }

  try {
    const context = new source.AudioContext();
    const accepted = context.destination.maxChannelCount;

    void context.close();

    return accepted;
  } catch {
    return STEREO;
  }
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
    platform: window.navigator.platform,
    supportsHdr: queries.matchMedia?.('(dynamic-range: high)').matches ?? false,
    screenWidth: Math.round(window.screen.width * window.devicePixelRatio),
    screenHeight: Math.round(window.screen.height * window.devicePixelRatio),
    name,
    maxAudioChannels: channelsTheOutputAccepts(),
  });
};

export { detectDeviceProfile, detectFromBrowser };
