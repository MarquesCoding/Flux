import type { MediaItem, SubtitleFormat, VideoRange } from '@ValenceContracts/schemas/MediaItem';
import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';
import type {
  AudioDecision,
  ContainerDecision,
  PlaybackPlan,
  SubtitleDecision,
  VideoDecision,
} from '@ValenceContracts/schemas/PlaybackPlan';
import type { QualityClamp } from './resolveQualityStep';
import { selectAudioStream } from './describeTrack';
import { encodeBitrateFor } from './encodeBitrateFor';
const IMAGE_SUBTITLE_FORMATS: readonly SubtitleFormat[] = ['pgs', 'vobsub', 'dvbsub'];

/**
 * Decides what the file should be delivered in: the container it is already in where the device
 * says it can play it, and the fallback the device asked for otherwise. Every decision carries the
 * reason for it, so a session can afterwards say why it did what it did.
 *
 * @param media - The file, as the catalogue holds it.
 * @param profile - What the device says it can play.
 * @returns The container decision and its reason.
 */
const decideContainer = (media: MediaItem, profile: DeviceProfile): ContainerDecision => {
  const supported = profile.directPlayProfiles.some((entry) => entry.container === media.container);

  if (supported) {
    return {
      kind: 'passthrough',
      reason: {
        code: 'ClientSupportsSource',
        detail: `Client direct plays the ${media.container} container`,
      },
    };
  }

  const target = profile.transcodingProfiles[0];

  return {
    kind: 'remux',
    target: target === undefined ? 'mp4' : target.container,
    reason: {
      code: 'ContainerNotSupported',
      detail: `Client does not support the ${media.container} container`,
    },
  };
};

/**
 * Which range this file can be delivered in to this client, of the ones it can honestly be read as.
 *
 * A file is graded in one range and is sometimes legible as another. Dolby Vision profile 8.1
 * carries an HDR10 base layer and HDR10+ is HDR10 with per-scene metadata added; in both cases a
 * player that ignores the extra metadata is not being fooled, it is reading the picture the format
 * was built to leave for it. Refusing those is how a film that would have played untouched gets
 * decoded, tone mapped and encoded again on a screen that could have shown the original.
 *
 * Profile 5 is the case this exists to keep out. It has no base layer anything else can read, so a
 * client that cannot decode Dolby Vision is sent something else rather than a green and purple
 * picture, which is the failure that makes people distrust a server.
 *
 * @param media - The file, as the catalogue holds it.
 * @param profile - What the device says it can play.
 * @returns The range to send, or nothing where the client can read neither.
 */
const rangeFor = (media: MediaItem, profile: DeviceProfile): VideoRange | null => {
  if (profile.supportedVideoRanges.includes(media.videoRange)) {
    return media.videoRange;
  }

  const base = media.videoRangeBase;

  if (base !== null && base !== undefined && profile.supportedVideoRanges.includes(base)) {
    return base;
  }

  return null;
};

/**
 * Decides what to do with the picture: pass it through untouched where the device can play it as it
 * is and it is within any ceiling asked for, or transcode it down to what it can.
 *
 * Bitrate takes the tighter of whatever ceilings exist, because that one is about what a network
 * can carry rather than a matter of taste — but a browser cannot state it and Valence stopped
 * inventing it on the browser's behalf, so in practice the only ceiling is a rung somebody pinned.
 * Resolution is not a ceiling at all, for the same reason and more plainly: only a rung somebody
 * pinned can force the picture smaller. `profile.maxWidth` is the display's own size, which is a sensible
 * thing to encode towards once something else has decided to encode, and a poor reason to decide
 * it — 4K into a 1440p panel is downsampled by the display and looks better for it than anything
 * re-encoded to fit would, which is why every streaming service offers the choice rather than
 * hiding it.
 *
 * It used to be a veto, and this comment argued against it while the code below did it anyway: a 4K
 * film was decoded, scaled and re-encoded so that a panel which cannot show 4K could be sent
 * something slightly smaller than 4K. What the device genuinely cannot decode is enforced
 * elsewhere, through codec support and level limits — a level is a real statement about a decoder,
 * where a panel size is a statement about a piece of glass.
 *
 * Which leaves "original" meaning what a viewer would expect it to: as the file is, sized for the
 * screen in front of them. Asking for a rung is asking for something else on purpose.
 *
 * @param media - The file, as the catalogue holds it.
 * @param profile - What the device says it can play.
 * @param qualityClamp - What the viewer pinned quality to, where they pinned it.
 * @returns The video decision, its reason, and the ceiling being encoded to where one applies.
 */
const decideVideo = (
  media: MediaItem,
  profile: DeviceProfile,
  qualityClamp?: QualityClamp | null,
): VideoDecision => {
  const fallback = profile.transcodingProfiles[0];
  const targetCodec = fallback === undefined ? 'h264' : fallback.videoCodec;
  const clamp = qualityClamp ?? null;

  const stated = profile.maxBitrateKbps ?? null;

  const maxBitrateKbps =
    clamp === null
      ? stated
      : Math.min(stated ?? clamp.maxVideoBitrateKbps, clamp.maxVideoBitrateKbps);
  const maxWidth = clamp === null ? profile.maxWidth : clamp.maxWidth;
  const maxHeight = clamp === null ? profile.maxHeight : clamp.maxHeight;

  const transcodeTo = (
    code:
      | 'VideoCodecNotSupported'
      | 'VideoProfileNotSupported'
      | 'VideoBitrateAboveLimit'
      | 'VideoResolutionAboveLimit'
      | 'VideoRangeNotSupported'
      | 'VideoNotSegmentable'
      | 'VideoLevelNotSupported'
      | 'VideoFramerateNotSupported'
      | 'InterlacedVideoNotSupported'
      | 'RefFramesNotSupported'
      | 'AnamorphicVideoNotSupported'
      | 'VideoRotationNotSupported'
      | 'UserForcedTranscode',
    detail: string,
  ): VideoDecision => ({
    kind: 'transcode',
    codec: targetCodec,
    range: rangeFor(media, profile) ?? 'SDR',
    maxBitrateKbps: encodeBitrateFor({
      sourceBitrateKbps: media.bitrateKbps,
      sourceCodec: media.videoCodec,
      targetCodec,
      ceilingKbps: maxBitrateKbps,
      sourceWidth: media.width,
      sourceHeight: media.height,
      maxWidth,
      maxHeight,
    }),
    maxWidth,
    maxHeight,
    reason: { code, detail },
  });

  const codecSupported = profile.directPlayProfiles.some((entry) =>
    entry.videoCodecs.includes(media.videoCodec),
  );

  if (!codecSupported) {
    return transcodeTo(
      'VideoCodecNotSupported',
      `Client does not support the ${media.videoCodec} video codec`,
    );
  }

  if (!media.canCopySegments) {
    return transcodeTo(
      'VideoNotSegmentable',
      'The source cannot be cut into segments a player can start at',
    );
  }

  const levelCeiling = profile.maxVideoLevels[media.videoCodec];

  if (
    levelCeiling !== undefined &&
    media.videoLevel !== null &&
    media.videoLevel !== undefined &&
    media.videoLevel > levelCeiling
  ) {
    return transcodeTo(
      'VideoLevelNotSupported',
      `Client decodes ${media.videoCodec} to level ${levelCeiling.toString()} and the source is level ${media.videoLevel.toString()}`,
    );
  }

  if (
    profile.maxFrameRate !== null &&
    profile.maxFrameRate !== undefined &&
    media.videoFrameRate !== null &&
    media.videoFrameRate !== undefined &&
    media.videoFrameRate > profile.maxFrameRate
  ) {
    return transcodeTo(
      'VideoFramerateNotSupported',
      `Source runs at ${media.videoFrameRate.toFixed(3)}fps and the client tops out at ${profile.maxFrameRate.toString()}fps`,
    );
  }

  if (media.videoIsInterlaced && !profile.canPlayInterlaced) {
    return transcodeTo(
      'InterlacedVideoNotSupported',
      'Source is interlaced and the client cannot deinterlace it',
    );
  }

  if (
    profile.maxRefFrames !== null &&
    profile.maxRefFrames !== undefined &&
    media.videoRefFrames !== null &&
    media.videoRefFrames !== undefined &&
    media.videoRefFrames > profile.maxRefFrames
  ) {
    return transcodeTo(
      'RefFramesNotSupported',
      `Source keeps ${media.videoRefFrames.toString()} reference frames and the client manages ${profile.maxRefFrames.toString()}`,
    );
  }

  const isAnamorphic =
    media.videoPixelAspect !== null &&
    media.videoPixelAspect !== undefined &&
    media.videoPixelAspect !== '1/1';

  if (isAnamorphic && !profile.canPlayAnamorphic) {
    return transcodeTo(
      'AnamorphicVideoNotSupported',
      `Source has ${media.videoPixelAspect ?? ''} pixels and the client shows every picture square`,
    );
  }

  const isRotated =
    media.videoRotationDegrees !== null &&
    media.videoRotationDegrees !== undefined &&
    media.videoRotationDegrees % 360 !== 0;

  if (isRotated && !profile.canRotate) {
    return transcodeTo(
      'VideoRotationNotSupported',
      `Source is rotated ${(media.videoRotationDegrees ?? 0).toString()} degrees and the client cannot turn it back`,
    );
  }

  if (media.videoBitDepth > 8 && !profile.tenBitVideoCodecs.includes(media.videoCodec)) {
    return transcodeTo(
      'VideoProfileNotSupported',
      `Client does not support ${media.videoCodec} at ${media.videoBitDepth.toString()} bits`,
    );
  }

  if (rangeFor(media, profile) === null) {
    return transcodeTo(
      'VideoRangeNotSupported',
      `Client does not support the ${media.videoRange} video range`,
    );
  }

  if (maxBitrateKbps !== null && media.bitrateKbps > maxBitrateKbps) {
    const forcedByQuality =
      clamp !== null && (stated === null || clamp.maxVideoBitrateKbps < stated);

    return forcedByQuality
      ? transcodeTo(
          'UserForcedTranscode',
          `Quality step limits bitrate to ${maxBitrateKbps.toString()}kbps`,
        )
      : transcodeTo(
          'VideoBitrateAboveLimit',
          `Source bitrate ${media.bitrateKbps.toString()}kbps exceeds the client limit of ${maxBitrateKbps.toString()}kbps`,
        );
  }

  if (clamp !== null && (media.width > clamp.maxWidth || media.height > clamp.maxHeight)) {
    return transcodeTo(
      'UserForcedTranscode',
      `Quality step limits resolution to ${clamp.maxWidth.toString()}x${clamp.maxHeight.toString()}`,
    );
  }

  return {
    kind: 'passthrough',
    reason: {
      code: 'ClientSupportsSource',
      detail: `Client direct plays ${media.videoCodec} at this bitrate, resolution and range`,
    },
  };
};

/**
 * Decides what to do with the sound, having first picked which track the viewer means. A track the
 * device can play is passed through; anything else is transcoded to what it asked for. Sound is
 * decided separately from picture because the common case is a file whose picture is fine and whose
 * sound is not, and remuxing one is far cheaper than re-encoding both.
 *
 * How many channels a track carries is not a reason to touch it. A client that can decode the codec
 * has an operating system underneath it that knows what is plugged in, and will fold a 5.1 bed down
 * for two speakers, render it binaurally for headphones, or pass it to a receiver untouched.
 * Downmixing first takes that choice away from every listener and cannot be undone further along.
 *
 * Measured on a Mac playing an E-AC-3 5.1 film through Safari with AirPods in: the output reports
 * two channels and always will, because AirPods are a stereo endpoint and macOS renders spatial
 * audio into them. Refusing 5.1 on that number sent a stereo downmix to the one arrangement that
 * had something to do with the other four channels. See VAL-152.
 *
 * `maxAudioChannels` still says what to encode to once something else has forced an encode, which
 * is what it is good for: a stereo device has no use for a 5.1 encode.
 *
 * @param media - The file, as the catalogue holds it.
 * @param profile - What the device says it can play.
 * @param qualityClamp - What the viewer pinned quality to, where they pinned it.
 * @param preferredLanguage - The language they would rather hear, where they said.
 * @returns The audio decision, its reason, and the bitrate being encoded to where one applies.
 */
const decideAudio = (
  media: MediaItem,
  profile: DeviceProfile,
  qualityClamp?: QualityClamp | null,
  preferredLanguage?: string | null,
): AudioDecision => {
  const stream = selectAudioStream(media.audioStreams, preferredLanguage);
  const fallback = profile.transcodingProfiles[0];
  const targetCodec = fallback === undefined ? 'aac' : fallback.audioCodec;
  const compressedBitrateKbps = qualityClamp?.maxAudioBitrateKbps ?? null;
  const maxBitrateKbps = compressedBitrateKbps ?? 384;

  if (stream === undefined) {
    return {
      kind: 'passthrough',
      streamIndex: null,
      reason: { code: 'ClientSupportsSource', detail: 'Source has no audio stream' },
    };
  }

  const codecSupported = profile.directPlayProfiles.some((entry) =>
    entry.audioCodecs.includes(stream.codec),
  );

  const transcodeAudio = (
    code: 'AudioSampleRateNotSupported' | 'AudioProfileNotSupported',
    detail: string,
  ): AudioDecision => ({
    kind: 'transcode',
    streamIndex: stream.index,
    codec: targetCodec,
    channels: Math.min(stream.channels, profile.maxAudioChannels),
    maxBitrateKbps,
    reason: { code, detail },
  });

  if (!codecSupported) {
    return {
      kind: 'transcode',
      streamIndex: stream.index,
      codec: targetCodec,
      channels: Math.min(stream.channels, profile.maxAudioChannels),
      maxBitrateKbps,
      reason: {
        code: 'AudioCodecNotSupported',
        detail: `Client does not support the ${stream.codec} audio codec`,
      },
    };
  }

  if (
    profile.maxAudioSampleRate !== null &&
    profile.maxAudioSampleRate !== undefined &&
    stream.sampleRate !== null &&
    stream.sampleRate !== undefined &&
    stream.sampleRate > profile.maxAudioSampleRate
  ) {
    return transcodeAudio(
      'AudioSampleRateNotSupported',
      `Track is ${stream.sampleRate.toString()}Hz and the client tops out at ${profile.maxAudioSampleRate.toString()}Hz`,
    );
  }

  if (
    stream.profile !== null &&
    stream.profile !== undefined &&
    profile.unsupportedAudioProfiles.includes(stream.profile)
  ) {
    return transcodeAudio(
      'AudioProfileNotSupported',
      `Client does not decode the ${stream.profile} profile of ${stream.codec}`,
    );
  }

  if (compressedBitrateKbps !== null) {
    return {
      kind: 'transcode',
      streamIndex: stream.index,
      codec: targetCodec,
      channels: Math.min(stream.channels, profile.maxAudioChannels),
      maxBitrateKbps: compressedBitrateKbps,
      reason: {
        code: 'UserForcedTranscode',
        detail: `Quality step compresses audio to ${compressedBitrateKbps.toString()}kbps`,
      },
    };
  }

  return {
    kind: 'passthrough',
    streamIndex: stream.index,
    reason: {
      code: 'ClientSupportsSource',
      detail: `Client direct plays ${stream.codec} at ${stream.channels.toString()} channels`,
    },
  };
};

/**
 * Decides what to do with subtitles: none where none was asked for, passed through where the device
 * renders the format itself, and otherwise converted to text or drawn into the picture.
 *
 * Drawing into the picture is the last resort and is never chosen on a viewer's behalf. It cannot be
 * turned off without restarting the stream, and it forces the picture to be encoded for as long as
 * it is on — so a film whose only subtitles are pictures plays without them until somebody asks,
 * rather than quietly costing every viewer a transcode they did not ask for.
 *
 * @param media - The file, as the catalogue holds it.
 * @param profile - What the device says it can render.
 * @param chosenStreamIndex - The stream a viewer picked, where they picked one.
 * @returns The subtitle decision and its reason.
 */
const decideSubtitles = (
  media: MediaItem,
  profile: DeviceProfile,
  chosenStreamIndex?: number | null,
): SubtitleDecision => {
  const chosen =
    chosenStreamIndex === undefined || chosenStreamIndex === null
      ? undefined
      : media.subtitleStreams.find((candidate) => candidate.index === chosenStreamIndex);

  const stream = chosen ?? media.subtitleStreams[0];

  if (stream === undefined) {
    return {
      kind: 'none',
      reason: { code: 'ClientSupportsSource', detail: 'Source has no subtitle stream' },
    };
  }

  if (profile.supportedSubtitleFormats.includes(stream.format)) {
    return {
      kind: 'passthrough',
      streamIndex: stream.index,
      reason: {
        code: 'ClientSupportsSource',
        detail: `Client renders ${stream.format} subtitles`,
      },
    };
  }

  if (IMAGE_SUBTITLE_FORMATS.includes(stream.format)) {
    if (chosen === undefined && !stream.isForced) {
      return {
        kind: 'none',
        reason: {
          code: 'SubtitleFormatNotSupported',
          detail: `${stream.format} is image based and has to be drawn into the picture, so it is off until it is asked for`,
        },
      };
    }

    return {
      kind: 'burnIn',
      streamIndex: stream.index,
      reason: {
        code: 'SubtitleFormatNotSupported',
        detail: `${stream.format} is image based and cannot be converted, so it must be burned in`,
      },
    };
  }

  return {
    kind: 'sidecar',
    streamIndex: stream.index,
    format: 'webvtt',
    reason: {
      code: 'SubtitleFormatNotSupported',
      detail: `Client does not render ${stream.format}, delivering as a WebVTT sidecar instead`,
    },
  };
};

/**
 * Decides how one file should reach one client, one axis at a time: whether its container, picture,
 * sound and subtitles can be sent as they are, or have to be re-encoded, and why. Every decision
 * carries the reason for it, so a session can explain itself afterwards rather than being a verdict
 * nobody can argue with.
 *
 * @param media - The file being played, as the scanner probed it.
 * @param profile - What this client says it can play.
 * @param qualityClamp - A ceiling a viewer chose, or nothing to let the client's own limits decide.
 * @param preferredAudioLanguage - The language to pick an audio track in where the file has one.
 * @param chosenSubtitleStreamIndex - The subtitle stream a viewer picked, where they picked one.
 * @returns The plan for this file and this client, axis by axis.
 */
const negotiatePlayback = (
  media: MediaItem,
  profile: DeviceProfile,
  qualityClamp?: QualityClamp | null,
  preferredAudioLanguage?: string | null,
  chosenSubtitleStreamIndex?: number | null,
): PlaybackPlan => ({
  mediaId: media.id,
  container: decideContainer(media, profile),
  video: decideVideo(media, profile, qualityClamp),
  audio: decideAudio(media, profile, qualityClamp, preferredAudioLanguage),
  subtitles: decideSubtitles(media, profile, chosenSubtitleStreamIndex),
});

export { negotiatePlayback };
