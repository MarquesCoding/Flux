import { describe, expect, it } from 'vitest';
import { createPlaybackService } from './createPlaybackService';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { SessionSpec, Transcoder } from '@FluxServer/transcoder/TranscoderClient';
import type { MediaLookup } from './createPlaybackService';

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const bilingual: MediaItem = {
  id: MEDIA_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [
    { index: 1, codec: 'truehd', channels: 8, language: 'deu', isDefault: true, isAtmos: true },
    { index: 2, codec: 'aac', channels: 2, language: 'eng', isDefault: false, isAtmos: false },
  ],
  subtitleStreams: [],
};

const capableProfile: DeviceProfile = {
  schemaVersion: 1,
  name: 'Living room TV',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40000,
  maxAudioChannels: 8,
  supportedVideoRanges: ['SDR', 'HDR10'],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [
    { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['truehd', 'aac'] },
  ],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

const harness = (defaultAudioLanguage: string | null) => {
  const media: MediaLookup = {
    findForPlayback: (mediaId) =>
      Promise.resolve(
        mediaId === MEDIA_ID
          ? { item: bilingual, path: '/media/arrival.mkv', defaultAudioLanguage }
          : null,
      ),
  };

  const startedSpecs: SessionSpec[] = [];

  const transcoder: Transcoder = {
    isReachable: () => Promise.resolve(true),
    probe: () => Promise.reject(new Error('not used')),
    startSession: (spec) => {
      startedSpecs.push(spec);

      return Promise.resolve({ id: 'session-1', manifest: '/session-1' });
    },
    readSessionFile: () => Promise.resolve(null),
    readFile: () => Promise.resolve(null),
    fingerprint: () => Promise.reject(new Error('not used')),
    requestTrickplay: () => Promise.reject(new Error('not used')),
    readTrickplayFile: () => Promise.resolve(null),
    stopSession: () => Promise.resolve(true),
    heartbeatSession: () => Promise.resolve(true),
    readSubtitle: () => Promise.reject(new Error('not used')),
    readFrame: () => Promise.reject(new Error('not used')),
    requestPreview: () => Promise.reject(new Error('not used')),
    readPreviewFile: () => Promise.resolve(null),
    readMonitor: () => Promise.resolve({}),
    openMonitorStream: () => Promise.resolve(null),
    capabilities: () =>
      Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
  };

  const service = createPlaybackService({
    media,
    transcoder,
    sessionUrlPrefix: '/api/playback/session',
    directUrlPrefix: '/api/playback',
    trickplayUrlPrefix: '/api/playback/trickplay',
  });

  return { service, startedSpecs };
};

describe('createPlaybackService', () => {
  it('direct plays when no language is forced', async () => {
    const { service } = harness(null);

    const outcome = await service.start(MEDIA_ID, capableProfile, 0);

    expect(outcome).toMatchObject({ kind: 'started', session: { delivery: { kind: 'direct' } } });
  });

  it('direct plays when the forced language matches the file default', async () => {
    const { service } = harness('de');

    const outcome = await service.start(MEDIA_ID, capableProfile, 0);

    expect(outcome).toMatchObject({ kind: 'started', session: { delivery: { kind: 'direct' } } });
  });

  it('falls back to a session, rather than a direct file serve, when the forced language differs from the file default', async () => {
    const { service, startedSpecs } = harness('en');

    const outcome = await service.start(MEDIA_ID, capableProfile, 0);

    expect(outcome).toMatchObject({ kind: 'started', session: { delivery: { kind: 'hls' } } });
    expect(startedSpecs).toMatchObject([{ audioStreamIndex: 2 }]);
  });

  it('still honours an explicit viewer track choice over the forced language', async () => {
    const { service, startedSpecs } = harness('en');

    const outcome = await service.start(MEDIA_ID, capableProfile, 0, 1);

    expect(outcome).toMatchObject({ kind: 'started', session: { delivery: { kind: 'hls' } } });
    expect(startedSpecs).toMatchObject([{ audioStreamIndex: 1 }]);
  });

  it('carries the forced language into the dry-run explanation', async () => {
    const { service } = harness('en');

    const explanation = await service.explain(MEDIA_ID, capableProfile);

    expect(explanation?.plan.audio).toMatchObject({ streamIndex: 2 });
  });

  it('delegates a heartbeat to the media service', async () => {
    const { service } = harness(null);

    await expect(service.heartbeat('session-1', false)).resolves.toBe(true);
  });
});
