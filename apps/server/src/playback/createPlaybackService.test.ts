import { describe, expect, it, vi } from 'vitest';
import { createPlaybackService } from './createPlaybackService';
import type { MediaLookup } from './createPlaybackService';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const item = (overrides: Partial<MediaItem> = {}): MediaItem => ({
  id: MEDIA_ID,
  title: 'Arrival',
  container: 'mp4',
  durationSeconds: 7200,
  videoCodec: 'h264',
  videoRange: 'SDR',
  width: 1920,
  height: 1080,
  bitrateKbps: 8000,
  audioStreams: [
    { index: 1, codec: 'aac', channels: 2, language: 'eng', isDefault: true, isAtmos: false },
  ],
  subtitleStreams: [],
  ...overrides,
});

/**
 * A client that plays anything, so a plan comes back as passthrough unless a
 * test deliberately asks for something it cannot manage.
 */
const profile = (overrides: Partial<DeviceProfile> = {}): DeviceProfile => ({
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40000,
  maxAudioChannels: 8,
  supportedVideoRanges: ['SDR', 'HDR10'],
  supportedSubtitleFormats: ['srt', 'webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
  ...overrides,
});

const CAPABILITIES = {
  ffmpegVersion: 'ffmpeg 9.0',
  encoders: [{ codec: 'h264', encoder: 'libx264', accel: 'none', verified: true }],
  hardwareAccels: [],
  toneMapping: 'zscale' as const,
  canBurnTextSubtitles: true,
  canBurnImageSubtitles: true,
  hardwareScalers: [],
  rejected: [],
};

/**
 * A media service that answers, and a library that holds one film.
 *
 * Both are ports, so the whole service can be exercised without a database
 * behind it or a process to talk to.
 */
const build = (
  transcoderOverrides: Partial<Transcoder> = {},
  found: Awaited<ReturnType<MediaLookup['findForPlayback']>> | undefined = undefined,
) => {
  const transcoder: Transcoder = {
    isReachable: () => Promise.resolve(true),
    probe: () => Promise.reject(new Error('not asked for here')),
    fingerprint: () => Promise.reject(new Error('not asked for here')),
    readSubtitle: () => Promise.resolve(''),
    readMonitor: () => Promise.resolve({}),
    openMonitorStream: () => Promise.resolve(null),
    capabilities: () => Promise.resolve(CAPABILITIES),
    startSession: () => Promise.resolve({ id: 'session-1', manifest: 'index.m3u8' }),
    readSessionFile: () => Promise.resolve(null),
    readFile: () => Promise.resolve(null),
    readFrame: () => Promise.resolve(new ArrayBuffer(4)),
    requestPreview: () => Promise.resolve({ id: 'clip-1', url: '/clip', isReady: true }),
    readPreviewFile: () => Promise.resolve(null),
    requestTrickplay: () =>
      Promise.resolve({
        id: 'sheet-1',
        intervalSeconds: 10,
        tileWidth: 160,
        tileHeight: 90,
        columns: 5,
        rows: 5,
        sheets: [],
        index: 'thumbnails.vtt',
        isReady: true,
      }),
    readTrickplayFile: () => Promise.resolve(null),
    stopSession: () => Promise.resolve(true),
    heartbeatSession: () => Promise.resolve(true),
    ...transcoderOverrides,
  };

  const media: MediaLookup = {
    findForPlayback: () =>
      Promise.resolve(
        found === undefined
          ? { item: item(), path: '/media/arrival.mp4', defaultAudioLanguage: null }
          : found,
      ),
  };

  return {
    transcoder,
    service: createPlaybackService({
      media,
      transcoder,
      sessionUrlPrefix: '/api/playback/session',
      directUrlPrefix: '/api/media',
      trickplayUrlPrefix: '/api/trickplay',
    }),
  };
};

const nothingInTheLibrary = (transcoderOverrides: Partial<Transcoder> = {}) =>
  build(transcoderOverrides, null);

describe('explaining what would happen', () => {
  it('says the mode and the plan for something in the library', async () => {
    const { service } = build();

    await expect(service.explain(MEDIA_ID, profile())).resolves.toMatchObject({
      plan: { video: { kind: 'passthrough' } },
    });
  });

  it('has nothing to explain about something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.explain(MEDIA_ID, profile())).resolves.toBeNull();
  });
});

describe('starting playback', () => {
  it('serves the file itself when nothing needs changing', async () => {
    const { service } = build();

    await expect(service.start(MEDIA_ID, profile(), 0)).resolves.toMatchObject({
      kind: 'started',
      session: { delivery: { kind: 'direct', url: `/api/media/${MEDIA_ID}/file` } },
    });
  });

  it('converts when the client cannot play what is there', async () => {
    const { service } = build();

    const started = await service.start(
      MEDIA_ID,
      profile({
        directPlayProfiles: [{ container: 'mp4', videoCodecs: ['vp9'], audioCodecs: ['aac'] }],
      }),
      0,
    );

    expect(started).toMatchObject({
      kind: 'started',
      session: {
        delivery: { kind: 'hls', manifestUrl: '/api/playback/session/session-1/index.m3u8' },
      },
    });
  });

  it('converts rather than serving the file when a particular audio track was asked for', async () => {
    const { service } = build();

    const started = await service.start(MEDIA_ID, profile(), 0, 2);

    expect(started).toMatchObject({ kind: 'started', session: { delivery: { kind: 'hls' } } });
  });

  it('has nothing to start for something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.start(MEDIA_ID, profile(), 0)).resolves.toEqual({ kind: 'notFound' });
  });

  it('passes on what the media service said when it could not start', async () => {
    const { service } = build({
      startSession: () => Promise.reject(new Error('ffmpeg would not start')),
    });

    await expect(
      service.start(
        MEDIA_ID,
        profile({
          directPlayProfiles: [{ container: 'mp4', videoCodecs: ['vp9'], audioCodecs: ['aac'] }],
        }),
        0,
      ),
    ).resolves.toEqual({ kind: 'failed', reason: 'ffmpeg would not start' });
  });

  it('asks the media service what it can do once, rather than on every play', async () => {
    const capabilities = vi.fn(() => Promise.resolve(CAPABILITIES));
    const { service } = build({ capabilities });
    const converting = profile({
      directPlayProfiles: [{ container: 'mp4', videoCodecs: ['vp9'], audioCodecs: ['aac'] }],
    });

    await service.start(MEDIA_ID, converting, 0);
    await service.start(MEDIA_ID, converting, 0);

    expect(capabilities).toHaveBeenCalledTimes(1);
  });

  it('asks again when the media service answered with nothing it could do', async () => {
    const capabilities = vi.fn(() => Promise.resolve({ ...CAPABILITIES, encoders: [] }));
    const { service } = build({ capabilities });
    const converting = profile({
      directPlayProfiles: [{ container: 'mp4', videoCodecs: ['vp9'], audioCodecs: ['aac'] }],
    });

    await service.start(MEDIA_ID, converting, 0);
    await service.start(MEDIA_ID, converting, 0);

    expect(capabilities).toHaveBeenCalledTimes(2);
  });
});

describe('the files a player asks for while it is watching', () => {
  it('reads a file belonging to a session', async () => {
    const readSessionFile = vi.fn(() => Promise.resolve(null));
    const { service } = build({ readSessionFile });

    await service.readSessionFile('session-1', 'segment-0.ts');

    expect(readSessionFile).toHaveBeenCalledWith('session-1', 'segment-0.ts');
  });

  it('reads the file itself, at the path the library holds', async () => {
    const readFile = vi.fn(() => Promise.resolve(null));
    const { service } = build({ readFile });

    await service.readDirectFile(MEDIA_ID, 'bytes=0-1');

    expect(readFile).toHaveBeenCalledWith('/media/arrival.mp4', 'bytes=0-1');
  });

  it('has no file to read for something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.readDirectFile(MEDIA_ID, null)).resolves.toBeNull();
  });

  it('offers a thumbnail sheet once one has been drawn', async () => {
    const { service } = build();

    await expect(service.trickplay(MEDIA_ID)).resolves.toMatchObject({
      id: 'sheet-1',
      url: '/api/trickplay/sheet-1/thumbnails.vtt',
    });
  });

  it('offers no sheet while one is still being drawn', async () => {
    const { service } = build({
      requestTrickplay: () =>
        Promise.resolve({
          id: 'sheet-1',
          intervalSeconds: 10,
          tileWidth: 160,
          tileHeight: 90,
          columns: 5,
          rows: 5,
          sheets: [],
          index: 'thumbnails.vtt',
          isReady: false,
        }),
    });

    await expect(service.trickplay(MEDIA_ID)).resolves.toBeNull();
  });

  it('offers no sheet for something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.trickplay(MEDIA_ID)).resolves.toBeNull();
  });

  it('reads a single frame', async () => {
    const readFrame = vi.fn(() => Promise.resolve(new ArrayBuffer(8)));
    const { service } = build({ readFrame });

    await expect(service.readFrame(MEDIA_ID, 12, 320)).resolves.toBeInstanceOf(ArrayBuffer);
    expect(readFrame).toHaveBeenCalledWith({
      inputPath: '/media/arrival.mp4',
      atSeconds: 12,
      width: 320,
    });
  });

  it('has no frame rather than an error when the media service could not draw one', async () => {
    const { service } = build({ readFrame: () => Promise.reject(new Error('no such frame')) });

    await expect(service.readFrame(MEDIA_ID, 12, 320)).resolves.toBeNull();
  });

  it('has no frame for something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.readFrame(MEDIA_ID, 12, 320)).resolves.toBeNull();
  });

  it('reads a preview clip once one has been made', async () => {
    const readPreviewFile = vi.fn(() => Promise.resolve(null));
    const { service } = build({ readPreviewFile });

    await service.readPreview(MEDIA_ID, null);

    expect(readPreviewFile).toHaveBeenCalledWith('clip-1', 'preview.mp4', null);
  });

  it('offers no preview while one is still being made', async () => {
    const { service } = build({
      requestPreview: () => Promise.resolve({ id: 'clip-1', url: '/clip', isReady: false }),
    });

    await expect(service.readPreview(MEDIA_ID, null)).resolves.toBeNull();
  });

  it('offers no preview when the media service refused to make one', async () => {
    const { service } = build({ requestPreview: () => Promise.reject(new Error('busy')) });

    await expect(service.readPreview(MEDIA_ID, null)).resolves.toBeNull();
  });

  it('offers no preview for something that is not there', async () => {
    const { service } = nothingInTheLibrary();

    await expect(service.readPreview(MEDIA_ID, null)).resolves.toBeNull();
  });

  it('reads a sheet file straight through', async () => {
    const readTrickplayFile = vi.fn(() => Promise.resolve(null));
    const { service } = build({ readTrickplayFile });

    await service.readTrickplayFile('sheet-1', 'sheet-000.jpg');

    expect(readTrickplayFile).toHaveBeenCalledWith('sheet-1', 'sheet-000.jpg');
  });
});

describe('ending and holding a session', () => {
  it('ends one', async () => {
    const stopSession = vi.fn(() => Promise.resolve(true));
    const { service } = build({ stopSession });

    await expect(service.stop('session-1')).resolves.toBe(true);
    expect(stopSession).toHaveBeenCalledWith('session-1');
  });

  it('says a session is still being watched', async () => {
    const heartbeatSession = vi.fn(() => Promise.resolve(true));
    const { service } = build({ heartbeatSession });

    await expect(service.heartbeat('session-1', false)).resolves.toBe(true);
    expect(heartbeatSession).toHaveBeenCalledWith('session-1', false);
  });
});

describe('the details a conversion has to be told', () => {
  const converting = profile({
    directPlayProfiles: [{ container: 'mp4', videoCodecs: ['vp9'], audioCodecs: ['aac'] }],
  });

  it('counts image subtitles among their own kind, which is what ffmpeg asks for', async () => {
    const withSubtitles = item({
      subtitleStreams: [
        { index: 2, format: 'srt', language: 'eng', isForced: false },
        { index: 3, format: 'pgs', language: 'eng', isForced: false },
      ],
    });

    const { service } = build(
      {},
      {
        item: withSubtitles,
        path: '/media/arrival.mp4',
        defaultAudioLanguage: null,
      },
    );

    await expect(service.start(MEDIA_ID, converting, 0)).resolves.toMatchObject({
      kind: 'started',
    });
  });

  it('serves a file with no audio at all as it is', async () => {
    const { service } = build(
      {},
      {
        item: item({ audioStreams: [] }),
        path: '/media/silent.mp4',
        defaultAudioLanguage: null,
      },
    );

    await expect(service.start(MEDIA_ID, profile(), 0)).resolves.toMatchObject({
      kind: 'started',
      session: { delivery: { kind: 'direct' } },
    });
  });

  it('takes the first audio stream when the file marks none of them default', async () => {
    const { service } = build(
      {},
      {
        item: item({
          audioStreams: [
            {
              index: 1,
              codec: 'aac',
              channels: 2,
              language: 'eng',
              isDefault: false,
              isAtmos: false,
            },
          ],
        }),
        path: '/media/arrival.mp4',
        defaultAudioLanguage: null,
      },
    );

    await expect(service.start(MEDIA_ID, profile(), 0)).resolves.toMatchObject({
      kind: 'started',
      session: { delivery: { kind: 'direct' } },
    });
  });

  it('says the media service failed when it threw something that was not an error', async () => {
    const { service } = build({
      startSession: () =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The point of the test: a media service that rejects with something that is not an Error.
        Promise.reject({ why: 'a plain object' }),
    });

    await expect(service.start(MEDIA_ID, converting, 0)).resolves.toEqual({
      kind: 'failed',
      reason: 'The media service failed.',
    });
  });
});
