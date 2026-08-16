import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';

const PLAYBACK_MODES = ['DirectPlay', 'Remux', 'DirectStream', 'Transcode'] as const;

type PlaybackMode = (typeof PLAYBACK_MODES)[number];

/**
 * Names how a session is being delivered, in the words an operator watching the sessions page
 * reads: transcoding the picture is the expensive case, transcoding only the sound is a direct
 * stream, repackaging without touching either is a remux, and sending the file as it lies is direct
 * play.
 *
 * @param plan - The negotiated plan for the session.
 * @returns The mode to show, from the most expensive case that applies.
 */
const describePlaybackMode = (plan: PlaybackPlan): PlaybackMode => {
  if (plan.video.kind === 'transcode' || plan.subtitles.kind === 'burnIn') {
    return 'Transcode';
  }

  if (plan.audio.kind === 'transcode') {
    return 'DirectStream';
  }

  if (plan.container.kind === 'remux') {
    return 'Remux';
  }

  return 'DirectPlay';
};

export type { PlaybackMode };

export { describePlaybackMode, PLAYBACK_MODES };
