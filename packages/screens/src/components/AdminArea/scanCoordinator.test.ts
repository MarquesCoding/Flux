import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
  subscribe,
  getSnapshot,
  resumeRunning,
  resetForTests,
} from './scanCoordinator';
import type { Library } from '@ValenceContracts/schemas/Library';

const scanLibraryMock = vi.hoisted(() => vi.fn());
const resetLibraryMock = vi.hoisted(() => vi.fn());
const regenerateLibraryPreviewsMock = vi.hoisted(() => vi.fn());
const readScanStateMock = vi.hoisted(() => vi.fn());
const runJobMock = vi.hoisted(() => vi.fn());
const fetchRunningScansMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  scanLibrary: scanLibraryMock,
  resetLibrary: resetLibraryMock,
  regenerateLibraryPreviews: regenerateLibraryPreviewsMock,
  readScanState: readScanStateMock,
}));

vi.mock('@ValenceClient/admin/fetchAdmin', () => ({
  runJob: runJobMock,
  fetchRunningScans: fetchRunningScansMock,
}));

beforeEach(() => {
  resetForTests();
  scanLibraryMock.mockReset();
  resetLibraryMock.mockReset();
  regenerateLibraryPreviewsMock.mockReset();
  readScanStateMock.mockReset();
  runJobMock.mockReset();
  fetchRunningScansMock.mockReset();
  fetchRunningScansMock.mockResolvedValue([]);
});

const LIBRARY: Library = {
  id: 'library-1',
  name: 'Movies',
  kind: 'movies',
  path: '/media/movies',
  itemCount: 10,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
};

describe('scanCoordinator', () => {
  it('tracks a scan until it completes', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-1', state: 'queued' });
    readScanStateMock
      .mockResolvedValueOnce({ state: 'running', phase: 'probing', processed: 1, total: 4 })
      .mockResolvedValueOnce({ state: 'completed', phase: 'probing', processed: 4, total: 4 });

    const seen: boolean[] = [];
    const stop = subscribe(() => {
      seen.push(getSnapshot().progress.has('library-1:scan'));
    });

    await startScan('library-1');
    stop();

    expect(seen).toContain(true);
    expect(getSnapshot().progress.has('library-1:scan')).toBe(false);
  });

  it('survives no listener being subscribed, the same as an unmounted admin page', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-2', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    await expect(startScan('library-solo')).resolves.toBeUndefined();
  });

  it('reports scan-all as busy for its whole run', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-3', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    const promise = startScanAll([LIBRARY]);

    expect(getSnapshot().isScanningAll).toBe(true);

    await promise;

    expect(getSnapshot().isScanningAll).toBe(false);
  });

  it('reports reset-all as busy for its whole run', async () => {
    resetLibraryMock.mockResolvedValue({ jobId: 'job-4', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    const promise = startResetAll([LIBRARY]);

    expect(getSnapshot().isResettingAll).toBe(true);

    await promise;

    expect(getSnapshot().isResettingAll).toBe(false);
  });

  it('tracks preview regeneration under its own kind', async () => {
    regenerateLibraryPreviewsMock.mockResolvedValue({ jobId: 'job-5', state: 'queued' });
    readScanStateMock.mockResolvedValueOnce({
      state: 'running',
      phase: 'previews',
      processed: 1,
      total: 2,
    });
    readScanStateMock.mockResolvedValueOnce({
      state: 'completed',
      phase: 'previews',
      processed: 2,
      total: 2,
    });

    let sawRegenerateKind = false;
    const stop = subscribe(() => {
      const entry = getSnapshot().progress.get('library-regen:regeneratePreviews');

      if (entry?.kind === 'regeneratePreviews') {
        sawRegenerateKind = true;
      }
    });

    await startRegeneratePreviews('library-regen');
    stop();

    expect(sawRegenerateKind).toBe(true);
  });

  it('stops tracking once the job comes back null', async () => {
    scanLibraryMock.mockResolvedValue(null);

    await startScan('library-null');

    expect(getSnapshot().progress.has('library-null:scan')).toBe(false);
  });

  it('tracks a job started by kind, from the Work tab picker', async () => {
    runJobMock.mockResolvedValue({ jobId: 'job-6', state: 'queued' });
    readScanStateMock
      .mockResolvedValueOnce({ state: 'running', phase: 'probing', processed: 1, total: 2 })
      .mockResolvedValueOnce({ state: 'completed', phase: 'probing', processed: 2, total: 2 });

    let sawKind: string | null = null;
    const stop = subscribe(() => {
      const entry = getSnapshot().progress.get('library-defined:library.reset');

      if (entry !== undefined) {
        sawKind = entry.kind;
      }
    });

    await runDefinedJob('library.reset', 'library-defined', true);
    stop();

    expect(runJobMock).toHaveBeenCalledWith('library.reset', 'library-defined', true);
    expect(sawKind).toBe('library.reset');
    expect(getSnapshot().progress.has('library-defined:library.reset')).toBe(false);
  });

  it('runs a job by kind against every library at once', async () => {
    runJobMock.mockResolvedValue({ jobId: 'job-7', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    await runDefinedJobAll('library.scan', [LIBRARY]);

    expect(runJobMock).toHaveBeenCalledWith('library.scan', LIBRARY.id, undefined);
  });
});

describe('a page opened while a scan is already running', () => {
  it('picks the scan up rather than showing nothing', async () => {
    fetchRunningScansMock.mockResolvedValue([
      {
        jobId: 'job-9',
        kind: 'scan',
        libraryId: 'library-1',
        phase: 'probing',
        processed: 3,
        total: 12,
      },
    ]);
    let finish: () => void = () => {
      return;
    };

    readScanStateMock.mockReturnValue(
      new Promise((resolve) => {
        finish = () => {
          resolve({
            jobId: 'job-9',
            state: 'completed',
            phase: 'probing',
            processed: 12,
            total: 12,
          });
        };
      }),
    );

    const running = resumeRunning();

    await Promise.resolve();
    await Promise.resolve();

    expect(getSnapshot().progress.get('library-1:scan')).toMatchObject({
      kind: 'scan',
      processed: 3,
      total: 12,
    });

    finish();
    await running;
  });

  it('forgets it again once it finishes', async () => {
    fetchRunningScansMock.mockResolvedValue([
      {
        jobId: 'job-9',
        kind: 'scan',
        libraryId: 'library-1',
        phase: null,
        processed: null,
        total: null,
      },
    ]);
    readScanStateMock.mockResolvedValue({
      jobId: 'job-9',
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    await resumeRunning();

    expect(getSnapshot().progress.has('library-1:scan')).toBe(false);
  });

  it('leaves a job about no library alone, having nothing to attach it to', async () => {
    fetchRunningScansMock.mockResolvedValue([
      {
        jobId: 'job-9',
        kind: 'cleanup',
        libraryId: null,
        phase: null,
        processed: null,
        total: null,
      },
    ]);

    await resumeRunning();

    expect(getSnapshot().progress.size).toBe(0);
  });
});

describe('reading a library again', () => {
  it('asks for every file, not only the ones that changed', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-4', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      jobId: 'job-4',
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    await startScan('library-1', true);

    expect(scanLibraryMock).toHaveBeenCalledWith('library-1', true);
  });

  it('asks only about what changed by default, which is what a scan is for', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-5', state: 'queued' });
    readScanStateMock.mockResolvedValue({
      jobId: 'job-5',
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    });

    await startScan('library-1');

    expect(scanLibraryMock).toHaveBeenCalledWith('library-1', false);
  });
  it('follows a scan and a render on one library without either hiding the other', async () => {
    fetchRunningScansMock.mockResolvedValue([
      {
        jobId: 'job-reading',
        kind: 'scan',
        libraryId: 'library-1',
        phase: 'probing',
        processed: 2,
        total: 9,
      },
      {
        jobId: 'job-sheets',
        kind: 'library.regenerateTrickplay',
        libraryId: 'library-1',
        phase: 'trickplay',
        processed: 1,
        total: 300,
      },
    ]);

    let finishSheets: () => void = () => {};

    readScanStateMock.mockImplementation((jobId: string) =>
      jobId === 'job-reading'
        ? Promise.resolve({ jobId, state: 'completed', phase: null, processed: 9, total: 9 })
        : new Promise((resolve) => {
            finishSheets = () => {
              resolve({ jobId, state: 'completed', phase: null, processed: 300, total: 300 });
            };
          }),
    );

    const running = resumeRunning();

    await Promise.resolve();
    await Promise.resolve();

    expect(getSnapshot().progress.get('library-1:scan')).toMatchObject({ kind: 'scan' });
    expect(getSnapshot().progress.get('library-1:library.regenerateTrickplay')).toMatchObject({
      kind: 'library.regenerateTrickplay',
    });

    finishSheets();
    await running;

    expect(getSnapshot().progress.size).toBe(0);
  });

  it('keeps the render when the scan beside it finishes first', async () => {
    fetchRunningScansMock.mockResolvedValue([
      {
        jobId: 'job-sheets',
        kind: 'library.regenerateTrickplay',
        libraryId: 'library-1',
        phase: 'trickplay',
        processed: 1,
        total: 300,
      },
    ]);

    let finishSheets: () => void = () => {};

    readScanStateMock.mockImplementation(
      (jobId: string) =>
        new Promise((resolve) => {
          finishSheets = () => {
            resolve({ jobId, state: 'completed', phase: null, processed: 300, total: 300 });
          };
        }),
    );

    const running = resumeRunning();

    await Promise.resolve();
    await Promise.resolve();

    scanLibraryMock.mockResolvedValue({ jobId: 'job-reading', state: 'queued' });

    expect(getSnapshot().progress.has('library-1:library.regenerateTrickplay')).toBe(true);

    finishSheets();
    await running;
  });
});
