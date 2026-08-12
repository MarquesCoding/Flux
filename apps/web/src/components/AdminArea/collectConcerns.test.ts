import { describe, expect, it } from 'vitest';
import { collectConcerns } from './collectConcerns';
import type { ActiveSession, AdminOverview, Job, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';
import type { Library } from '@FluxContracts/schemas/Library';

const healthyOverview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  users: [],
  settings: { hasCatalogueKey: true, cookieSecure: true, trustedOrigins: [] },
  transcoder: { isReachable: true, ffmpegVersion: '7.1', hardwareAccels: [] },
  library: { itemCount: 10, libraryCount: 1 },
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
    loadAverage: 0,
  },
  queue: { concurrency: 1, queued: 0, running: 0, jobs },
  sessions: 0,
  logs: [],
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
          transcoder: { isReachable: false, ffmpegVersion: null, hardwareAccels: [] },
        }),
      });

      expect(concerns.map((concern) => concern.id)).toContain('transcoder');
      expect(concerns[0]?.tone).toBe('broken');
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
          settings: { hasCatalogueKey: false, cookieSecure: true, trustedOrigins: [] },
        }),
      });

      expect(concerns.map((concern) => concern.id)).toContain('no-catalogue-key');
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
        settings: { hasCatalogueKey: false, cookieSecure: true, trustedOrigins: [] },
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
});
