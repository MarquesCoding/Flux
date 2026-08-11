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
 *
 * Best effort: a viewer closing the tab is the common case and there is
 * nothing useful to report if this does not arrive. The server reaps idle
 * sessions regardless.
 *
 * This only stops the session itself — it says nothing to presence. A
 * quality or track change calls this to tear the old session down and then
 * immediately starts a new one in the same tab, and presence should keep
 * showing that tab as watching the whole time. See `stopWatching` for the
 * call that actually says a tab has stopped.
 */
const stopPlaybackSession = async (sessionId: string): Promise<void> => {
  await fetch(`/api/playback/session/${sessionId}`, { method: 'DELETE' }).catch(() => undefined);
};

/**
 * Says a tab has genuinely stopped watching anything.
 *
 * Called once per player lifetime — on unmount, or when the tab actually
 * closes — never on an internal session swap. `stopPlaybackSession` above
 * covers the far more common case of tearing one session down to start
 * another in the same tab, which must not read as the viewer leaving.
 */
const stopWatching = async (clientId: string, keepalive = false): Promise<void> => {
  await fetch(`/api/presence/${clientId}/watching`, { method: 'DELETE', keepalive }).catch(
    () => undefined,
  );
};

/**
 * Tells the server a session is still wanted, and whether it is playing.
 *
 * Sent on a fixed interval regardless of pause state — the authoritative
 * liveness signal a paused-but-open tab needs, since it stops fetching
 * segments the moment it pauses. Best effort, like the stop call above: a
 * heartbeat that fails to arrive is exactly what the idle reaper exists for.
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
 *
 * Presence's own heartbeat, separate from the one above: it fires for direct
 * play too, since that never reaches the media service at all and the
 * transcoder heartbeat above would have nothing to report to.
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

export {
  startPlaybackSession,
  stopPlaybackSession,
  stopWatching,
  heartbeatPlaybackSession,
  sendPresenceHeartbeat,
  describeWhy,
  StartedSessionSchema,
};
