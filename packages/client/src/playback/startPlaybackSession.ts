import { serverUrl } from '@FluxClient/query/serverUrl';
import { onThisServer } from '@FluxClient/query/onThisServer';
import { z } from 'zod';
import { PlaybackPlanSchema } from '@FluxContracts/schemas/PlaybackPlan';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';
import type { QualityPreference } from './qualityPreference';

const DeliverySchema = z.union([
  z.object({
    kind: z.literal('hls'),
    manifestUrl: z.string().min(1).transform(onThisServer),
  }),
  z.object({ kind: z.literal('direct'), url: z.string().min(1).transform(onThisServer) }),
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
 * Asks the server for a session: what to play, from where, and on what this client can actually
 * take. Answers with the failure rather than throwing, since a refusal is something the player has
 * to explain rather than something that should break it.
 *
 * @param mediaId - What to play.
 * @param deviceProfile - What this client can decode.
 * @param clientId - Which device is asking, for presence.
 * @param startSeconds - Where to begin.
 * @param audioStreamIndex - A particular audio track, where one was chosen.
 * @param requestedQuality - A ceiling a viewer chose.
 * @returns The session, or why there is not one.
 */
const startPlaybackSession = async (
  mediaId: string,
  deviceProfile: DeviceProfile,
  clientId: string,
  startSeconds = 0,
  audioStreamIndex?: number,
  requestedQuality?: QualityPreference,
): Promise<StartOutcome> => {
  const response = await fetch(serverUrl(`/api/playback/${mediaId}/session`), {
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
 * Tells the server a session is finished, so the encoder stops rather than running on for a viewer
 * who has gone.
 *
 * @param sessionId - The session to stop.
 */
const stopPlaybackSession = async (sessionId: string): Promise<void> => {
  await fetch(serverUrl(`/api/playback/session/${sessionId}`), { method: 'DELETE' }).catch(
    () => undefined,
  );
};

/**
 * Tells presence a tab has genuinely stopped watching, rather than merely paused, so an operator's
 * session list empties when a viewer leaves.
 *
 * @param clientId - Which device.
 * @param keepalive - Whether the page is going away, which decides whether the request is one the
 *   browser has promised to finish.
 */
const stopWatching = async (clientId: string, keepalive = false): Promise<void> => {
  await fetch(serverUrl(`/api/presence/${clientId}/watching`), {
    method: 'DELETE',
    keepalive,
  }).catch(() => undefined);
};

/**
 * Tells the server a session is still wanted, so the idle reaper does not collect it, and whether it
 * is currently playing.
 *
 * @param sessionId - The session.
 * @param isPlaying - Whether the picture is moving.
 */
const heartbeatPlaybackSession = async (sessionId: string, isPlaying: boolean): Promise<void> => {
  await fetch(serverUrl(`/api/playback/session/${sessionId}/heartbeat`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isPlaying }),
  }).catch(() => undefined);
};

/**
 * Tells presence whether this tab is playing right now, along with what it can measure of the
 * stream — which is what fills the position and the health an operator watches on the sessions page.
 *
 * @param clientId - Which device.
 * @param isPlaying - Whether the picture is moving.
 * @param health - What the browser reports about the stream, where it reports anything.
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
  await fetch(serverUrl(`/api/presence/${clientId}/heartbeat`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isPlaying, ...(health === undefined ? {} : { health }) }),
  }).catch(() => undefined);
};

/**
 * Summarises a negotiated plan as one sentence a viewer can act on — what is being changed and why —
 * rather than as the four axes an operator would read.
 *
 * @param plan - The plan the server answered with.
 * @returns The sentence to show.
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
