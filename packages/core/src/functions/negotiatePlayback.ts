import type { MediaItem, SubtitleFormat } from '@FluxContracts/schemas/MediaItem';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type {
  AudioDecision,
  ContainerDecision,
  PlaybackPlan,
  SubtitleDecision,
  VideoDecision,
} from '@FluxContracts/schemas/PlaybackPlan';
import type { QualityClamp } from './resolveQualityStep';
import { selectAudioStream } from './describeTrack';
const IMAGE_SUBTITLE_FORMATS: readonly SubtitleFormat[] = ['pgs', 'vobsub', 'dvbsub'];

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

const decideVideo = (
  media: MediaItem,
  profile: DeviceProfile,
  qualityClamp?: QualityClamp | null,
): VideoDecision => {
  const fallback = profile.transcodingProfiles[0];
  const targetCodec = fallback === undefined ? 'h264' : fallback.videoCodec;
  const clamp = qualityClamp ?? null;

  const maxBitrateKbps =
    clamp === null
      ? profile.maxBitrateKbps
      : Math.min(profile.maxBitrateKbps, clamp.maxVideoBitrateKbps);
  const maxWidth = clamp === null ? profile.maxWidth : Math.min(profile.maxWidth, clamp.maxWidth);
  const maxHeight =
    clamp === null ? profile.maxHeight : Math.min(profile.maxHeight, clamp.maxHeight);

  const transcodeTo = (
    code:
      | 'VideoCodecNotSupported'
      | 'VideoProfileNotSupported'
      | 'VideoBitrateAboveLimit'
      | 'VideoResolutionAboveLimit'
      | 'VideoRangeNotSupported'
      | 'VideoNotSegmentable'
      | 'UserForcedTranscode',
    detail: string,
  ): VideoDecision => ({
    kind: 'transcode',
    codec: targetCodec,
    range: profile.supportedVideoRanges.includes(media.videoRange) ? media.videoRange : 'SDR',
    maxBitrateKbps,
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

  if (media.videoBitDepth > 8 && !profile.tenBitVideoCodecs.includes(media.videoCodec)) {
    return transcodeTo(
      'VideoProfileNotSupported',
      `Client does not support ${media.videoCodec} at ${media.videoBitDepth.toString()} bits`,
    );
  }

  if (!profile.supportedVideoRanges.includes(media.videoRange)) {
    return transcodeTo(
      'VideoRangeNotSupported',
      `Client does not support the ${media.videoRange} video range`,
    );
  }

  if (media.bitrateKbps > maxBitrateKbps) {
    const forcedByQuality = clamp !== null && clamp.maxVideoBitrateKbps < profile.maxBitrateKbps;

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

  if (media.width > maxWidth || media.height > maxHeight) {
    const forcedByQuality =
      clamp !== null && (clamp.maxWidth < profile.maxWidth || clamp.maxHeight < profile.maxHeight);

    return forcedByQuality
      ? transcodeTo(
          'UserForcedTranscode',
          `Quality step limits resolution to ${maxWidth.toString()}x${maxHeight.toString()}`,
        )
      : transcodeTo(
          'VideoResolutionAboveLimit',
          `Source resolution ${media.width.toString()}x${media.height.toString()} exceeds the client limit`,
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

  if (stream.channels > profile.maxAudioChannels) {
    return {
      kind: 'transcode',
      streamIndex: stream.index,
      codec: targetCodec,
      channels: profile.maxAudioChannels,
      maxBitrateKbps,
      reason: {
        code: 'AudioChannelsAboveLimit',
        detail: `Source has ${stream.channels.toString()} channels, client supports ${profile.maxAudioChannels.toString()}`,
      },
    };
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

const decideSubtitles = (media: MediaItem, profile: DeviceProfile): SubtitleDecision => {
  const stream = media.subtitleStreams[0];

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
 * Decides how a media item should be delivered to a client.
 *
 * Each axis is decided independently, so a mismatch on one can never force a
 * re-encode on another. This is what prevents the class of bug where an
 * unsupported video range silently strips lossless or Atmos audio.
 *
 * `qualityClamp` layers a viewer-picked quality step on top of the device's
 * own capability: it can only tighten the effective limit, never loosen it
 * beyond what the device already declared, and a transcode it alone causes
 * is reported as `UserForcedTranscode` rather than a capability mismatch.
 *
 * Pure by design: it depends only on the item, the profile, the clamp, and
 * nothing else. That is what makes the dry-run explainer possible. See
 * ADR-0011.
 *
 * `preferredAudioLanguage` comes from the item's library, not the device: a
 * library operator forcing a language is a statement about the collection,
 * not about what any one client can play.
 */
const negotiatePlayback = (
  media: MediaItem,
  profile: DeviceProfile,
  qualityClamp?: QualityClamp | null,
  preferredAudioLanguage?: string | null,
): PlaybackPlan => ({
  mediaId: media.id,
  container: decideContainer(media, profile),
  video: decideVideo(media, profile, qualityClamp),
  audio: decideAudio(media, profile, qualityClamp, preferredAudioLanguage),
  subtitles: decideSubtitles(media, profile),
});

export { negotiatePlayback };
