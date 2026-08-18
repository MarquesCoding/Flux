import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startPlaybackSession,
  stopPlaybackSession,
  stopWatching,
  heartbeatPlaybackSession,
  sendPresenceHeartbeat,
  describeWhy,
} from './startPlaybackSession';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string };

type FetchLike = (
  input: string,
  init?: JsonRequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const SentBodySchema = z.object({
  deviceProfile: z.object({ name: z.string() }),
  clientId: z.string(),
  startSeconds: z.number(),
  requestedQuality: z.string().optional(),
});

const sentBody = () => SentBodySchema.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const plan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const profile: DeviceProfile = {
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 1920,
  maxHeight: 1080,
  maxBitrateKbps: 8000,
  maxAudioChannels: 2,
  supportedVideoRanges: ['SDR'],
  tenBitVideoCodecs: [],
  maxVideoLevels: {},
  canPlayInterlaced: true,
  canPlayAnamorphic: true,
  canRotate: true,
  unsupportedAudioProfiles: [],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

const started = {
  sessionId: 'abc',
  delivery: { kind: 'hls', manifestUrl: '/api/playback/session/abc/index.m3u8' },
  mode: 'DirectPlay',
  plan,
  warnings: [],
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(started) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startPlaybackSession', () => {
  it('returns the session on success', async () => {
    const outcome = await startPlaybackSession('media-1', profile, 'client-1');

    expect(outcome).toMatchObject({ kind: 'started', session: { sessionId: 'abc' } });
  });

  it('sends the device profile with the request', async () => {
    await startPlaybackSession('media-1', profile, 'client-1');

    expect(sentBody()).toMatchObject({ deviceProfile: { name: 'Browser' }, startSeconds: 0 });
  });

  it('sends a seek position when given one', async () => {
    await startPlaybackSession('media-1', profile, 'client-1', 120);

    expect(sentBody()).toMatchObject({ startSeconds: 120 });
  });

  it('sends the requested quality when it is not Original', async () => {
    await startPlaybackSession('media-1', profile, 'client-1', 0, undefined, '720p');

    expect(sentBody().requestedQuality).toBe('720p');
  });

  it('omits the requested quality for Original', async () => {
    await startPlaybackSession('media-1', profile, 'client-1', 0, undefined, 'original');

    expect(sentBody().requestedQuality).toBeUndefined();
  });

  it('reports the server reason when it refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'This server has no working encoder for h264.' }),
    });

    await expect(startPlaybackSession('media-1', profile, 'client-1')).resolves.toMatchObject({
      kind: 'failed',
      reason: 'This server has no working encoder for h264.',
    });
  });

  it('reports an unreachable server', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(startPlaybackSession('media-1', profile, 'client-1')).resolves.toMatchObject({
      kind: 'failed',
      reason: 'Could not reach the server.',
    });
  });

  it('accepts a direct delivery', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...started,
          delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
        }),
    });

    await expect(startPlaybackSession('media-1', profile, 'client-1')).resolves.toMatchObject({
      kind: 'started',
      session: { delivery: { kind: 'direct' } },
    });
  });

  it('does not report a contract mismatch as a network failure', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ sessionId: 'abc' }),
    });

    const outcome = await startPlaybackSession('media-1', profile, 'client-1');

    expect(outcome).toMatchObject({
      kind: 'failed',
      reason: 'The server sent a response Flux could not read.',
    });
  });
});

describe('stopPlaybackSession', () => {
  it('tells the server the session is finished', async () => {
    await stopPlaybackSession('abc');

    expect(fetchMock).toHaveBeenCalledWith('/api/playback/session/abc', { method: 'DELETE' });
  });

  it('does not throw when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(stopPlaybackSession('abc')).resolves.toBeUndefined();
  });
});

describe('stopWatching', () => {
  it('tells presence a tab has genuinely stopped watching', async () => {
    await stopWatching('client-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/presence/client-1/watching', {
      method: 'DELETE',
      keepalive: false,
    });
  });

  it('can be sent with keepalive, for a tab that is actually closing', async () => {
    await stopWatching('client-1', true);

    expect(fetchMock).toHaveBeenCalledWith('/api/presence/client-1/watching', {
      method: 'DELETE',
      keepalive: true,
    });
  });

  it('does not throw when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(stopWatching('client-1')).resolves.toBeUndefined();
  });
});

describe('heartbeatPlaybackSession', () => {
  it('tells the server the session is still wanted, and whether it is playing', async () => {
    await heartbeatPlaybackSession('abc', false);

    expect(fetchMock).toHaveBeenCalledWith('/api/playback/session/abc/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPlaying: false }),
    });
  });

  it('does not throw when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(heartbeatPlaybackSession('abc', true)).resolves.toBeUndefined();
  });
});

describe('sendPresenceHeartbeat', () => {
  it('tells presence whether this tab is playing', async () => {
    await sendPresenceHeartbeat('client-1', true);

    expect(fetchMock).toHaveBeenCalledWith('/api/presence/client-1/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPlaying: true }),
    });
  });

  it('does not throw when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(sendPresenceHeartbeat('client-1', true)).resolves.toBeUndefined();
  });
});

describe('describeWhy', () => {
  it('says nothing is being converted for direct play', () => {
    expect(describeWhy(plan)).toEqual(['Playing without any conversion.']);
  });

  it('explains a video transcode', () => {
    const reasons = describeWhy({
      ...plan,
      video: {
        kind: 'transcode',
        codec: 'h264',
        range: 'SDR',
        maxBitrateKbps: 8000,
        maxWidth: 1920,
        maxHeight: 1080,
        reason: { code: 'VideoCodecNotSupported', detail: 'Client does not support hevc' },
      },
    });

    expect(reasons).toEqual(['Video: Client does not support hevc']);
  });

  it('explains every axis that is being converted', () => {
    const reasons = describeWhy({
      ...plan,
      container: {
        kind: 'remux',
        target: 'ts',
        reason: { code: 'ContainerNotSupported', detail: 'no mkv' },
      },
      audio: {
        kind: 'transcode',
        streamIndex: 1,
        codec: 'aac',
        channels: 2,
        maxBitrateKbps: 256,
        reason: { code: 'AudioCodecNotSupported', detail: 'no truehd' },
      },
    });

    expect(reasons).toHaveLength(2);
    expect(reasons.some((line) => line.startsWith('Audio:'))).toBe(true);
    expect(reasons.some((line) => line.startsWith('Container:'))).toBe(true);
  });

  it('explains burned in subtitles', () => {
    const reasons = describeWhy({
      ...plan,
      subtitles: {
        kind: 'burnIn',
        streamIndex: 2,
        reason: { code: 'SubtitleFormatNotSupported', detail: 'pgs is image based' },
      },
    });

    expect(reasons).toEqual(['Subtitles: pgs is image based']);
  });
});
