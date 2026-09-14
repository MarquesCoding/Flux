import { describe, expect, it } from 'vitest';
import { collectConcerns } from './collectConcerns';
import type { ActiveSession, AdminOverview, Job, Monitor } from '@ValenceClient/admin/fetchAdmin';
import type { PlaybackPlan, Reason } from '@ValenceContracts/schemas/PlaybackPlan';
import type { Library } from '@ValenceContracts/schemas/Library';

const healthyOverview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  users: [],
  settings: {
    hasCatalogueKey: true,
    cookieSecure: true,
    hardwareAccel: '',
    previewQuality: 'high' as const,
    showsProfilesBeforeSignIn: false,
    trustedOrigins: [],
  },
  transcoder: {
    isReachable: true,
    address: 'unix:/tmp/valence-transcoder.sock',
    ffmpegVersion: '7.1',
    ffmpegSupported: true,
    hardwareAccels: [],
    rejectedEncoders: [],
    concurrentRenders: 0,
    chains: [],
  },
  library: { itemCount: 10, libraryCount: 1, bytes: 0 },
  artwork: null,
  jobs: { stalled: [] },
  ...overrides,
});

const healthyMonitor = (
  jobs: Job[] = [],
  memory: { used: number; total: number } = { used: 1, total: 10 },
): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: memory.used,
    systemMemoryTotalBytes: memory.total,
    cpuCount: 4,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children: [],
    deploymentMemory: null,
    apiMemoryBytes: null,
    loadAverage: 0,
    disks: [],
    graphics: null,
    artefacts: null,
  },
  queue: { concurrency: 1, queued: 0, running: 0, jobs },
  sessions: 0,
  logs: [],
  cache: null,
});

const library = (overrides: Partial<Library> = {}): Library => ({
  id: 'lib_1',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 10,
  lastScannedAt: '2026-08-11T00:00:00.000Z',
  ...overrides,
  defaultAudioLanguage: null,
  filesAtOnce: null,
});

const failedJob = (detail: string | null = null): Job => ({
  id: 1,
  kind: 'library.scan',
  subject: 'Films',
  state: 'failed',
  queuedAtMs: 0,
  startedAtMs: 0,
  finishedAtMs: 1,
  detail,
});

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const PLAN: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const streaming = (bufferedAheadSeconds: number, isPlaying = true): ActiveSession => ({
  clientId: 'cli_1',
  profileId: 'prf_1',
  profileName: 'Dan',
  deviceLabel: 'Chrome on macOS',
  connectedAt: 0,
  playback: {
    mediaId: 'med_1',
    mediaTitle: 'Arrival',
    hasPoster: false,
    hasBackdrop: false,
    mode: 'transcode',
    plan: PLAN,
    reuse: null,
    isPlaying,
    pausedByAdmin: false,
    startedAt: 0,
    health: {
      positionSeconds: 10,
      durationSeconds: 7200,
      bufferedAheadSeconds,
      presentedWidth: 1920,
      presentedHeight: 1080,
    },
  },
});

const healthy = {
  overview: healthyOverview(),
  monitor: healthyMonitor(),
  libraries: [library()],
};

describe('collectConcerns', () => {
  it('says nothing about a server with nothing wrong', () => {
    expect(collectConcerns(healthy)).toEqual([]);
  });

  it('says nothing before anything has loaded, rather than reporting faults', () => {
    expect(collectConcerns({ overview: null, monitor: null, libraries: [] })).toEqual([]);
  });

  describe('what is broken', () => {
    it('reports an unreachable media service', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          transcoder: {
            isReachable: false,
            address: 'unix:/tmp/valence-transcoder.sock',
            ffmpegVersion: null,
            ffmpegSupported: true,
            hardwareAccels: [],
            rejectedEncoders: [],
            concurrentRenders: 0,
            chains: [],
          },
        }),
      });

      expect(concerns.map((concern) => concern.id)).toContain('transcoder');
      expect(concerns[0]?.tone).toBe('broken');
    });

    it('says where the media service was looked for', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          transcoder: {
            isReachable: false,
            address: 'unix:/tmp/valence-transcoder.sock',
            ffmpegVersion: null,
            ffmpegSupported: true,
            hardwareAccels: [],
            rejectedEncoders: [],
            concurrentRenders: 0,
            chains: [],
          },
        }),
      });

      expect(concerns[0]?.detail).toContain('unix:/tmp/valence-transcoder.sock');
    });

    it('says only what it knows when the address was not reported', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          transcoder: {
            isReachable: false,
            address: '',
            ffmpegVersion: null,
            ffmpegSupported: true,
            hardwareAccels: [],
            rejectedEncoders: [],
            concurrentRenders: 0,
            chains: [],
          },
        }),
      });

      expect(concerns[0]?.detail).toBe('Nothing that needs converting will play until it is back.');
    });

    it('reports a failed job', () => {
      const concerns = collectConcerns({ ...healthy, monitor: healthyMonitor([failedJob()]) });

      expect(concerns[0]?.title).toBe('A job failed');
    });

    it('counts several rather than listing them', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: healthyMonitor([failedJob(), failedJob()]),
      });

      expect(concerns[0]?.title).toBe('2 jobs failed');
    });

    it('carries why it failed, when the job said', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: healthyMonitor([failedJob('no such path')]),
      });

      expect(concerns[0]?.detail).toBe('no such path');
    });

    it('points at the panel that explains it', () => {
      const concerns = collectConcerns({ ...healthy, monitor: healthyMonitor([failedJob()]) });

      expect(concerns[0]?.panel).toBe('jobs');
    });
  });

  describe('what needs a person', () => {
    const onOldFfmpeg = (version: string | null) =>
      healthyOverview({
        transcoder: {
          isReachable: true,
          address: 'unix:/tmp/valence-transcoder.sock',
          ffmpegVersion: version,
          ffmpegSupported: false,
          hardwareAccels: [],
          rejectedEncoders: [],
          concurrentRenders: 0,
          chains: [],
        },
      });

    it('reports an FFmpeg older than Valence supports', () => {
      const concerns = collectConcerns({ ...healthy, overview: onOldFfmpeg('5.1.9') });

      expect(concerns.map((concern) => concern.id)).toContain('ffmpeg-version');
    });

    it('names the version, since that is what somebody has to act on', () => {
      const concerns = collectConcerns({ ...healthy, overview: onOldFfmpeg('5.1.9') });

      expect(concerns.find((concern) => concern.id === 'ffmpeg-version')?.detail).toContain(
        '5.1.9',
      );
    });

    it('says it needs a person rather than that it is broken, because playback still works', () => {
      const concerns = collectConcerns({ ...healthy, overview: onOldFfmpeg('5.1.9') });

      expect(concerns.find((concern) => concern.id === 'ffmpeg-version')?.tone).toBe('attention');
    });

    it('says nothing about a version it could not read', () => {
      const concerns = collectConcerns({ ...healthy, overview: onOldFfmpeg(null) });

      expect(concerns.find((concern) => concern.id === 'ffmpeg-version')?.detail).not.toContain(
        'null',
      );
    });

    it('stays quiet about a supported version', () => {
      const concerns = collectConcerns(healthy);

      expect(concerns.map((concern) => concern.id)).not.toContain('ffmpeg-version');
    });

    it('stays quiet when the service cannot be reached at all', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          transcoder: {
            isReachable: false,
            address: '',
            ffmpegVersion: null,
            ffmpegSupported: false,
            hardwareAccels: [],
            rejectedEncoders: [],
            concurrentRenders: 0,
            chains: [],
          },
        }),
      });

      expect(concerns.map((concern) => concern.id)).not.toContain('ffmpeg-version');
    });

    it('reports a library that has never been scanned, by name', () => {
      const concerns = collectConcerns({
        ...healthy,
        libraries: [library({ lastScannedAt: null })],
      });

      expect(concerns[0]?.title).toBe('Films has never been scanned');
    });

    it('counts several rather than naming them all', () => {
      const concerns = collectConcerns({
        ...healthy,
        libraries: [
          library({ lastScannedAt: null }),
          library({ id: 'lib_2', name: 'Shows', lastScannedAt: null }),
        ],
      });

      expect(concerns[0]?.title).toBe('2 libraries have never been scanned');
    });

    it('says nothing about a library that has been scanned', () => {
      expect(collectConcerns(healthy)).toEqual([]);
    });

    it('reports a kind of job that has never once succeeded', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          jobs: {
            stalled: [
              {
                kind: 'library.scan.scheduled',
                label: 'Scan for changes',
                failures: 457,
                everSucceeded: false,
                reason: "Cannot read properties of null (reading 'libraryId')",
              },
            ],
          },
        }),
      });

      const stalled = concerns.find((concern) => concern.id === 'stalled-jobs');

      expect(stalled?.title).toBe('Scan for changes has never once succeeded');
      expect(stalled?.tone).toBe('broken');
      expect(stalled?.panel).toBe('jobs');
    });

    it('tells a job that has stopped working from one that never worked', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          jobs: {
            stalled: [
              {
                kind: 'server.checkDiskSpace',
                label: 'Check disk space',
                failures: 12,
                everSucceeded: true,
                reason: 'the disk is gone',
              },
            ],
          },
        }),
      });

      expect(concerns.find((concern) => concern.id === 'stalled-jobs')?.title).toBe(
        'Check disk space fails every time it runs',
      );
    });

    it('counts them rather than listing every stalled kind', () => {
      const stall = (kind: string, label: string) => ({
        kind,
        label,
        failures: 3,
        everSucceeded: false,
        reason: 'no',
      });

      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          jobs: {
            stalled: [
              stall('server.checkDiskSpace', 'Check disk space'),
              stall('server.checkTranscoder', 'Check the transcoder'),
            ],
          },
        }),
      });

      expect(concerns.find((concern) => concern.id === 'stalled-jobs')?.title).toBe(
        '2 kinds of job fail every time they run',
      );
    });

    it('says nothing about jobs while every kind still works', () => {
      expect(
        collectConcerns(healthy).find((concern) => concern.id === 'stalled-jobs'),
      ).toBeUndefined();
    });

    it('reports memory that is nearly full', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: healthyMonitor([], { used: 99, total: 100 }),
      });

      expect(concerns.map((concern) => concern.id)).toContain('memory');
    });

    it('stays quiet about a server merely running warm', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: healthyMonitor([], { used: 80, total: 100 }),
      });

      expect(concerns).toEqual([]);
    });

    it('measures a container against what it is allowed rather than the host', () => {
      const monitor = healthyMonitor([], { used: 4, total: 100 });

      const concerns = collectConcerns({
        ...healthy,
        monitor: {
          ...monitor,
          resources: {
            ...monitor.resources,
            deploymentMemory: { usedBytes: 99, limitBytes: 100 },
          },
        },
      });

      expect(concerns.map((concern) => concern.title)).toContain(
        'Valence is nearly at the memory it is allowed',
      );
    });

    it('stays quiet about a container with room left, however busy the host is', () => {
      const monitor = healthyMonitor([], { used: 99, total: 100 });

      const concerns = collectConcerns({
        ...healthy,
        monitor: {
          ...monitor,
          resources: {
            ...monitor.resources,
            deploymentMemory: { usedBytes: 10, limitBytes: 100 },
          },
        },
      });

      expect(concerns).toEqual([]);
    });

    it('does not divide by a memory total it does not have', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: healthyMonitor([], { used: 0, total: 0 }),
      });

      expect(concerns).toEqual([]);
    });
  });

  describe('what is not set up yet', () => {
    it('reports having no libraries at all', () => {
      const concerns = collectConcerns({ ...healthy, libraries: [] });

      expect(concerns.map((concern) => concern.id)).toContain('no-libraries');
    });

    it('reports a missing catalogue key', () => {
      const concerns = collectConcerns({
        ...healthy,
        overview: healthyOverview({
          settings: {
            hasCatalogueKey: false,
            cookieSecure: true,
            hardwareAccel: '',
            previewQuality: 'high' as const,
            showsProfilesBeforeSignIn: false,
            trustedOrigins: [],
          },
        }),
      });

      expect(concerns.map((concern) => concern.id)).toContain('no-catalogue-key');
    });
  });

  describe('the graphics encoder', () => {
    it('reports an encoder that has stayed at full stretch', () => {
      const concerns = collectConcerns({
        ...healthy,
        encoderHistory: Array.from({ length: 15 }, () => 96),
      });

      expect(concerns.map((concern) => concern.id)).toContain('encoder');
    });

    it('says nothing about one busy moment', () => {
      const concerns = collectConcerns({ ...healthy, encoderHistory: [100, 100, 100] });

      expect(concerns).toEqual([]);
    });

    it('stays quiet when a reading in the run dipped', () => {
      const concerns = collectConcerns({
        ...healthy,
        encoderHistory: [...Array.from({ length: 14 }, () => 96), 20],
      });

      expect(concerns).toEqual([]);
    });

    it('says nothing at all on a machine whose encoder cannot be read', () => {
      const concerns = collectConcerns({ ...healthy, encoderHistory: [] });

      expect(concerns).toEqual([]);
    });

    it('says what happens next, which is the part worth acting on', () => {
      const concerns = collectConcerns({
        ...healthy,
        encoderHistory: Array.from({ length: 15 }, () => 96),
      });

      expect(concerns.find((concern) => concern.id === 'encoder')?.detail).toContain(
        'fall back to the processor',
      );
    });
  });

  describe('the library disk', () => {
    const onDisk = (totalBytes: number, availableBytes: number): Monitor => {
      const monitor = healthyMonitor();
      monitor.resources.disks = [{ mountPoint: '/media', totalBytes, availableBytes }];

      return monitor;
    };

    it('says nothing about a disk with room on it', () => {
      expect(collectConcerns({ ...healthy, monitor: onDisk(1000, 500) })).toEqual([]);
    });

    it('reports one that is nearly full', () => {
      const concerns = collectConcerns({ ...healthy, monitor: onDisk(1000, 10) });

      expect(concerns.map((concern) => concern.id)).toContain('disk');
    });

    it('says how much is left and where, since that is what somebody acts on', () => {
      const concerns = collectConcerns({ ...healthy, monitor: onDisk(1000, 10) });

      expect(concerns.find((concern) => concern.id === 'disk')?.detail).toContain(
        '10 B left on /media',
      );
    });

    it('stays quiet about a full disk no library is on', () => {
      const monitor = healthyMonitor();
      monitor.resources.disks = [{ mountPoint: '/backup', totalBytes: 1000, availableBytes: 1 }];

      expect(collectConcerns({ ...healthy, monitor })).toEqual([]);
    });
  });

  describe('the processor', () => {
    it('says nothing about one busy moment', () => {
      const concerns = collectConcerns({ ...healthy, history: [100, 100, 100] });

      expect(concerns).toEqual([]);
    });

    it('reports load that has not let up', () => {
      const concerns = collectConcerns({
        ...healthy,
        history: Array.from({ length: 15 }, () => 95),
      });

      expect(concerns.map((concern) => concern.id)).toContain('cpu');
    });

    it('stays quiet when one reading in the run dipped', () => {
      const concerns = collectConcerns({
        ...healthy,
        history: [...Array.from({ length: 14 }, () => 95), 40],
      });

      expect(concerns).toEqual([]);
    });

    it('says so when the load is Valence doing its own work', () => {
      const monitor = healthyMonitor();
      monitor.resources.children = [{ pid: 1, cpuPercent: 380, memoryBytes: 0 }];

      const concerns = collectConcerns({
        ...healthy,
        monitor,
        history: Array.from({ length: 15 }, () => 95),
      });

      expect(concerns.find((concern) => concern.id === 'cpu')?.detail).toContain(
        'Valence is using 95% of the machine, so this is its own work',
      );
    });

    it('points elsewhere when the machine is busy and Valence is not', () => {
      const monitor = healthyMonitor();
      monitor.resources.serviceCpuPercent = 20;

      const concerns = collectConcerns({
        ...healthy,
        monitor,
        history: Array.from({ length: 15 }, () => 95),
      });

      expect(concerns.find((concern) => concern.id === 'cpu')?.detail).toContain(
        'so most of this is something else on the box',
      );
    });

    it('blames nobody when there is no reading to blame them with', () => {
      const concerns = collectConcerns({
        ...healthy,
        monitor: null,
        history: Array.from({ length: 15 }, () => 95),
      });

      expect(concerns.find((concern) => concern.id === 'cpu')?.detail).toBe(
        'Playback that needs converting may stutter while it lasts.',
      );
    });
  });

  describe('streams in trouble', () => {
    it('reports one running out of buffer, by name', () => {
      const concerns = collectConcerns({ ...healthy, sessions: [streaming(0.5)] });

      expect(concerns[0]?.title).toBe('Dan is running out of buffer');
    });

    it('counts several rather than naming them all', () => {
      const concerns = collectConcerns({
        ...healthy,
        sessions: [streaming(0.5), streaming(1)],
      });

      expect(concerns[0]?.title).toBe('2 streams are running out of buffer');
    });

    it('says nothing about a stream with buffer in hand', () => {
      expect(collectConcerns({ ...healthy, sessions: [streaming(30)] })).toEqual([]);
    });

    it('says nothing about a paused stream, which is not starving', () => {
      expect(collectConcerns({ ...healthy, sessions: [streaming(0, false)] })).toEqual([]);
    });
  });

  it('puts what is broken above what merely needs doing', () => {
    const concerns = collectConcerns({
      overview: healthyOverview({
        settings: {
          hasCatalogueKey: false,
          cookieSecure: true,
          hardwareAccel: '',
          previewQuality: 'high' as const,
          showsProfilesBeforeSignIn: false,
          trustedOrigins: [],
        },
      }),
      monitor: healthyMonitor([failedJob()], { used: 99, total: 100 }),
      libraries: [library({ lastScannedAt: null })],
    });

    expect(concerns.map((concern) => concern.tone)).toEqual([
      'broken',
      'attention',
      'attention',
      'setup',
    ]);
  });

  it('says so where rendered artefacts are being written somewhere they will not survive', () => {
    const monitor = healthyMonitor();

    const concerns = collectConcerns({
      overview: healthyOverview(),
      monitor: {
        ...monitor,
        resources: {
          ...monitor.resources,
          artefacts: { root: '/transcodes', survivesRestart: false },
        },
      },
      libraries: [library()],
    });

    const artefacts = concerns.find((concern) => concern.id === 'artefacts');

    expect(artefacts?.title).toBe('Previews and thumbnails are not being kept');
    expect(artefacts?.detail).toContain('/transcodes');
    expect(artefacts?.detail).toContain('VALENCE_ARTEFACT_DIR');
  });

  it('says nothing where rendered artefacts are on a volume that keeps them', () => {
    const monitor = healthyMonitor();

    const concerns = collectConcerns({
      overview: healthyOverview(),
      monitor: {
        ...monitor,
        resources: {
          ...monitor.resources,
          artefacts: { root: '/cache/artefacts', survivesRestart: true },
        },
      },
      libraries: [library()],
    });

    expect(concerns.find((concern) => concern.id === 'artefacts')).toBeUndefined();
  });

  it('says nothing about durability on a machine that does not publish its mounts', () => {
    const concerns = collectConcerns({
      overview: healthyOverview(),
      monitor: healthyMonitor(),
      libraries: [library()],
    });

    expect(concerns.find((concern) => concern.id === 'artefacts')).toBeUndefined();
  });
});
