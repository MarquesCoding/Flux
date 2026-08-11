import { z } from 'zod';
import { PlaybackPlanSchema } from '@FluxContracts/schemas/PlaybackPlan';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';
import type { QualityPreference } from './qualityPreference';

const DeliverySchema = z.union([
  z.object({ kind: z.literal('hls'), manifestUrl: z.string().min(1) }),
  z.object({ kind: z.literal('direct'), url: z.string().min(1) }),
]);

const StartedSessionSchema = z.object({
  sessionId: z.string().min(1),
  delivery: DeliverySchema,
  mode: z.string(),
  plan: PlaybackPlanSchema,
  warnings: z.array(z.string()).default([]),
});

type StartedSession = z.infer<typeof StartedSessionSchema>;

type StartOutcome =
  { kind: 'started'; session: StartedSession } | { kind: 'failed'; reason: string };

const ErrorSchema = z.object({ error: z.string() });

/**
 * Asks the server for a playback session.
 *
 * The device profile is sent with the request rather than stored server-side,
 * so the same account playing on a phone and a television gets a different
 * answer for each without either having to be identified.
 */
const startPlaybackSession = async (
  mediaId: string,
  deviceProfile: DeviceProfile,
  startSeconds = 0,
  audioStreamIndex?: number,
  requestedQuality?: QualityPreference,
): Promise<StartOutcome> => {
  const response = await fetch(`/api/playback/${mediaId}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deviceProfile,
      startSeconds,
      ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
      ...(requestedQuality === undefined || requestedQuality === 'original'
        ? {}
        : { requestedQuality }),
    }),
  }).catch(() => null);

  if (response === null) {
    return { kind: 'failed', reason: 'Could not reach the server.' };
  }

  if (!response.ok) {
    const body = ErrorSchema.safeParse(await response.json());

    return {
      kind: 'failed',
      reason: body.success
        ? body.data.error
        : `Flux asked for something the server would not accept (${response.status.toString()}).`,
    };
  }

  const parsed = StartedSessionSchema.safeParse(await response.json());

  if (!parsed.success) {
    return { kind: 'failed', reason: 'The server sent a response Flux could not read.' };
  }

  return { kind: 'started', session: parsed.data };
};

/**
 * Tells the server a session is finished.
 *
 * Best effort: a viewer closing the tab is the common case and there is
 * nothing useful to report if this does not arrive. The server reaps idle
 * sessions regardless.
 */
const stopPlaybackSession = async (sessionId: string): Promise<void> => {
  await fetch(`/api/playback/session/${sessionId}`, { method: 'DELETE' }).catch(() => undefined);
};

/**
 * Summarises a plan as a sentence a viewer can act on.
 *
 * "Why is this transcoding?" is one of the most common questions asked of a
 * media server, and the answer already exists inside the plan. Showing it is
 * the whole point of carrying reasons on every axis. See ADR-0011.
 */
const describeWhy = (plan: PlaybackPlan): string[] => {
  const reasons: string[] = [];

  if (plan.video.kind === 'transcode') {
    reasons.push(`Video: ${plan.video.reason.detail}`);
  }

  if (plan.audio.kind === 'transcode') {
    reasons.push(`Audio: ${plan.audio.reason.detail}`);
  }

  if (plan.container.kind === 'remux') {
    reasons.push(`Container: ${plan.container.reason.detail}`);
  }

  if (plan.subtitles.kind === 'burnIn') {
    reasons.push(`Subtitles: ${plan.subtitles.reason.detail}`);
  }

  return reasons.length > 0 ? reasons : ['Playing without any conversion.'];
};

export type { StartedSession, StartOutcome };

export { startPlaybackSession, stopPlaybackSession, describeWhy, StartedSessionSchema };
