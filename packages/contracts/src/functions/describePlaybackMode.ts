import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';

const PLAYBACK_MODES = ['DirectPlay', 'Remux', 'DirectStream', 'Transcode'] as const;

type PlaybackMode = (typeof PLAYBACK_MODES)[number];

/**
 * Derives the human-facing playback mode label from a plan.
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
