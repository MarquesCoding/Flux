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
 */
const startPlaybackSession = async (
  mediaId: string,
  deviceProfile: DeviceProfile,
  clientId: string,
  startSeconds = 0,
  audioStreamIndex?: number,
  requestedQuality?: QualityPreference,
): Promise<StartOutcome> => {
  const response = await fetch(`/api/playback/${mediaId}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deviceProfile,
      clientId,
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
 */
const stopPlaybackSession = async (sessionId: string): Promise<void> => {
  await fetch(`/api/playback/session/${sessionId}`, { method: 'DELETE' }).catch(() => undefined);
};

/**
 * Says a tab has genuinely stopped watching anything.
 */
const stopWatching = async (clientId: string, keepalive = false): Promise<void> => {
  await fetch(`/api/presence/${clientId}/watching`, { method: 'DELETE', keepalive }).catch(
    () => undefined,
  );
};

/**
 * Tells the server a session is still wanted, and whether it is playing.
 */
const heartbeatPlaybackSession = async (sessionId: string, isPlaying: boolean): Promise<void> => {
  await fetch(`/api/playback/session/${sessionId}/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isPlaying }),
  }).catch(() => undefined);
};

/**
 * Tells presence whether this tab is actually playing right now.
 */
const sendPresenceHeartbeat = async (
  clientId: string,
  isPlaying: boolean,
  health?: {
    positionSeconds: number;
    durationSeconds: number;
    bufferedAheadSeconds: number;
    presentedWidth: number;
    presentedHeight: number;
  },
): Promise<void> => {
  await fetch(`/api/presence/${clientId}/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isPlaying, ...(health === undefined ? {} : { health }) }),
  }).catch(() => undefined);
};

/**
 * Summarises a plan as a sentence a viewer can act on.
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

export {
  startPlaybackSession,
  stopPlaybackSession,
  stopWatching,
  heartbeatPlaybackSession,
  sendPresenceHeartbeat,
  describeWhy,
};
