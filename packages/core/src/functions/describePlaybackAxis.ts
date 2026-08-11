import type { AudioDecision, VideoDecision } from '@FluxContracts/schemas/PlaybackPlan'

/**
 * Reads any plan axis as the decision plus the reason behind it.
 *
 * The shared shape every axis line reads as, whether it is a simple
 * passthrough/remux/none or one of the two axes with numbers of their own.
 */
const describeAxis = (kind: string, detail: string): string => `${kind} — ${detail}`

/**
 * Reads the video axis with the resolution/bitrate ceiling actually being
 * encoded to, when it is transcoding.
 *
 * `plan.video` already carries these numbers whether the transcode came from
 * device capability or a chosen quality step, so this is the one place they
 * need to be shown.
 */
const describeVideoAxis = (video: VideoDecision): string =>
  video.kind === 'passthrough'
    ? describeAxis(video.kind, video.reason.detail)
    : `${describeAxis(video.kind, video.reason.detail)} (${video.maxWidth.toString()}x${video.maxHeight.toString()} @ ${video.maxBitrateKbps.toString()}kbps)`

const describeAudioAxis = (audio: AudioDecision): string =>
  audio.kind === 'passthrough'
    ? describeAxis(audio.kind, audio.reason.detail)
    : `${describeAxis(audio.kind, audio.reason.detail)} (${audio.maxBitrateKbps.toString()}kbps)`

export default { describeAxis, describeVideoAxis, describeAudioAxis }
