import type { MediaItem, SubtitleFormat } from '@FluxContracts/schemas/MediaItem'
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile'
import type {
  AudioDecision,
  ContainerDecision,
  PlaybackPlan,
  SubtitleDecision,
  VideoDecision,
} from '@FluxContracts/schemas/PlaybackPlan'

const IMAGE_SUBTITLE_FORMATS: readonly SubtitleFormat[] = ['pgs', 'vobsub', 'dvbsub']

const decideContainer = (media: MediaItem, profile: DeviceProfile): ContainerDecision => {
  const supported = profile.directPlayProfiles.some((entry) => entry.container === media.container)

  if (supported) {
    return {
      kind: 'passthrough',
      reason: {
        code: 'ClientSupportsSource',
        detail: `Client direct plays the ${media.container} container`,
      },
    }
  }

  const target = profile.transcodingProfiles[0]

  return {
    kind: 'remux',
    target: target === undefined ? 'mp4' : target.container,
    reason: {
      code: 'ContainerNotSupported',
      detail: `Client does not support the ${media.container} container`,
    },
  }
}

const decideVideo = (media: MediaItem, profile: DeviceProfile): VideoDecision => {
  const fallback = profile.transcodingProfiles[0]
  const targetCodec = fallback === undefined ? 'h264' : fallback.videoCodec

  const transcodeTo = (
    code:
      | 'VideoCodecNotSupported'
      | 'VideoBitrateAboveLimit'
      | 'VideoResolutionAboveLimit'
      | 'VideoRangeNotSupported',
    detail: string,
  ): VideoDecision => ({
    kind: 'transcode',
    codec: targetCodec,
    range: profile.supportedVideoRanges.includes(media.videoRange) ? media.videoRange : 'SDR',
    maxBitrateKbps: profile.maxBitrateKbps,
    maxWidth: profile.maxWidth,
    maxHeight: profile.maxHeight,
    reason: { code, detail },
  })

  const codecSupported = profile.directPlayProfiles.some((entry) =>
    entry.videoCodecs.includes(media.videoCodec),
  )

  if (!codecSupported) {
    return transcodeTo(
      'VideoCodecNotSupported',
      `Client does not support the ${media.videoCodec} video codec`,
    )
  }

  if (!profile.supportedVideoRanges.includes(media.videoRange)) {
    return transcodeTo(
      'VideoRangeNotSupported',
      `Client does not support the ${media.videoRange} video range`,
    )
  }

  if (media.bitrateKbps > profile.maxBitrateKbps) {
    return transcodeTo(
      'VideoBitrateAboveLimit',
      `Source bitrate ${media.bitrateKbps.toString()}kbps exceeds the client limit of ${profile.maxBitrateKbps.toString()}kbps`,
    )
  }

  if (media.width > profile.maxWidth || media.height > profile.maxHeight) {
    return transcodeTo(
      'VideoResolutionAboveLimit',
      `Source resolution ${media.width.toString()}x${media.height.toString()} exceeds the client limit`,
    )
  }

  return {
    kind: 'passthrough',
    reason: {
      code: 'ClientSupportsSource',
      detail: `Client direct plays ${media.videoCodec} at this bitrate, resolution and range`,
    },
  }
}

const decideAudio = (media: MediaItem, profile: DeviceProfile): AudioDecision => {
  const stream = media.audioStreams[0]
  const fallback = profile.transcodingProfiles[0]
  const targetCodec = fallback === undefined ? 'aac' : fallback.audioCodec

  if (stream === undefined) {
    return {
      kind: 'passthrough',
      reason: { code: 'ClientSupportsSource', detail: 'Source has no audio stream' },
    }
  }

  const codecSupported = profile.directPlayProfiles.some((entry) =>
    entry.audioCodecs.includes(stream.codec),
  )

  if (!codecSupported) {
    return {
      kind: 'transcode',
      codec: targetCodec,
      channels: Math.min(stream.channels, profile.maxAudioChannels),
      maxBitrateKbps: 384,
      reason: {
        code: 'AudioCodecNotSupported',
        detail: `Client does not support the ${stream.codec} audio codec`,
      },
    }
  }

  if (stream.channels > profile.maxAudioChannels) {
    return {
      kind: 'transcode',
      codec: targetCodec,
      channels: profile.maxAudioChannels,
      maxBitrateKbps: 384,
      reason: {
        code: 'AudioChannelsAboveLimit',
        detail: `Source has ${stream.channels.toString()} channels, client supports ${profile.maxAudioChannels.toString()}`,
      },
    }
  }

  return {
    kind: 'passthrough',
    reason: {
      code: 'ClientSupportsSource',
      detail: `Client direct plays ${stream.codec} at ${stream.channels.toString()} channels`,
    },
  }
}

const decideSubtitles = (media: MediaItem, profile: DeviceProfile): SubtitleDecision => {
  const stream = media.subtitleStreams[0]

  if (stream === undefined) {
    return {
      kind: 'none',
      reason: { code: 'ClientSupportsSource', detail: 'Source has no subtitle stream' },
    }
  }

  if (profile.supportedSubtitleFormats.includes(stream.format)) {
    return {
      kind: 'passthrough',
      streamIndex: stream.index,
      reason: {
        code: 'ClientSupportsSource',
        detail: `Client renders ${stream.format} subtitles`,
      },
    }
  }

  if (IMAGE_SUBTITLE_FORMATS.includes(stream.format)) {
    return {
      kind: 'burnIn',
      streamIndex: stream.index,
      reason: {
        code: 'SubtitleFormatNotSupported',
        detail: `${stream.format} is image based and cannot be converted, so it must be burned in`,
      },
    }
  }

  return {
    kind: 'sidecar',
    streamIndex: stream.index,
    format: 'webvtt',
    reason: {
      code: 'SubtitleFormatNotSupported',
      detail: `Client does not render ${stream.format}, delivering as a WebVTT sidecar instead`,
    },
  }
}

/**
 * Decides how a media item should be delivered to a client.
 *
 * Each axis is decided independently, so a mismatch on one can never force a
 * re-encode on another. This is what prevents the class of bug where an
 * unsupported video range silently strips lossless or Atmos audio.
 *
 * Pure by design: it depends only on the item, the profile, and nothing else.
 * That is what makes the dry-run explainer possible. See ADR-0011.
 */
const negotiatePlayback = (media: MediaItem, profile: DeviceProfile): PlaybackPlan => ({
  mediaId: media.id,
  container: decideContainer(media, profile),
  video: decideVideo(media, profile),
  audio: decideAudio(media, profile),
  subtitles: decideSubtitles(media, profile),
})

export default { negotiatePlayback }
