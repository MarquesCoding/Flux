import type { AudioDecision, VideoDecision } from '@FluxContracts/schemas/PlaybackPlan';

/**
 * Writes one axis of a playback plan as a line an operator can read: the decision taken, and the
 * reason the negotiator gave for it. Used for the container, video, audio and subtitle axes alike,
 * so a session's whole plan reads in one voice.
 *
 * @param kind - What was decided on this axis, such as `passthrough` or `transcode`.
 * @param detail - The negotiator's reason, in its own words.
 * @returns The decision and its reason, joined for display.
 */
const describeAxis = (kind: string, detail: string): string => `${kind} — ${detail}`;

/**
 * Writes the video axis of a plan, adding the ceiling actually being encoded to when the picture is
 * being transcoded — a decision to transcode says nothing on its own about how far the picture is
 * being cut down, which is the thing anybody reading this wants to know.
 *
 * @param video - The video decision the negotiator reached, with its reason and any ceiling.
 * @returns The decision, its reason, and the size and bitrate being encoded to where one applies.
 */
const describeVideoAxis = (video: VideoDecision): string =>
  video.kind === 'passthrough'
    ? describeAxis(video.kind, video.reason.detail)
    : `${describeAxis(video.kind, video.reason.detail)} (${video.maxWidth.toString()}x${video.maxHeight.toString()} @ ${video.maxBitrateKbps.toString()}kbps)`;

const describeAudioAxis = (audio: AudioDecision): string =>
  audio.kind === 'passthrough'
    ? describeAxis(audio.kind, audio.reason.detail)
    : `${describeAxis(audio.kind, audio.reason.detail)} (${audio.maxBitrateKbps.toString()}kbps)`;

export { describeAxis, describeVideoAxis, describeAudioAxis };
