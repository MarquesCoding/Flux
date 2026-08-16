import {
  scanLibrary,
  resetLibrary,
  regenerateLibraryPreviews,
} from '@FluxWeb/library/fetchLibrary';
import { cancelJob, fetchRunningScans, runJob } from '@FluxWeb/admin/fetchAdmin';
import { waitForScanCompletion } from '@FluxWeb/library/waitForScanCompletion';
import type { ScanJob } from '@FluxWeb/library/fetchLibrary';
import type { Library } from '@FluxContracts/schemas/Library';

type ScanEntry = {
  kind: string;
  phase: string | null;
  processed: number | null;
  total: number | null;
  jobId: string | null;
};

type ScanSnapshot = {
  progress: ReadonlyMap<string, ScanEntry>;
  isScanningAll: boolean;
  isResettingAll: boolean;
};

let progress = new Map<string, ScanEntry>();
let isScanningAll = false;
let isResettingAll = false;
let snapshot: ScanSnapshot = { progress, isScanningAll, isResettingAll };
const listeners = new Set<() => void>();

const notify = () => {
  snapshot = { progress, isScanningAll, isResettingAll };

  for (const listener of listeners) {
    listener();
  }
};

/**
 * Registers a listener for changes to what is running. This module is shared state outside React so
 * that a scan started in one panel is still tracked when the administrator moves to another, and
 * this is what lets `useSyncExternalStore` drive a component from it.
 *
 * @param listener - Called whenever what is running changes.
 * @returns How to stop listening.
 */
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ScanSnapshot => snapshot;

const track = (libraryId: string, entry: ScanEntry) => {
  progress = new Map(progress).set(libraryId, entry);
  notify();
};

const untrack = (libraryId: string) => {
  if (!progress.has(libraryId)) {
    return;
  }

  const next = new Map(progress);

  next.delete(libraryId);
  progress = next;
  notify();
};

/**
 * Queues one library's job and follows it to the end, publishing its progress as it goes and clearing
 * it afterwards however it ended. Everything that starts work goes through here, so that a job is
 * tracked the same way whether it was started from a panel, resumed after a reload, or picked up
 * from another tab.
 *
 * @param libraryId - The library the work belongs to.
 * @param kind - What the work is.
 * @param enqueue - How to ask the server to start it.
 */
const runAndTrack = async (
  libraryId: string,
  kind: string,
  enqueue: () => Promise<ScanJob | null>,
): Promise<void> => {
  track(libraryId, { kind, phase: null, processed: null, total: null, jobId: null });

  try {
    const job = await enqueue();

    if (job !== null) {
      track(libraryId, { kind, phase: null, processed: null, total: null, jobId: job.jobId });

      await waitForScanCompletion(job.jobId, (found) => {
        track(libraryId, {
          kind,
          phase: found.phase,
          processed: found.processed,
          total: found.total,
          jobId: job.jobId,
        });
      });
    }
  } finally {
    untrack(libraryId);
  }
};

/**
 * Picks up scans the server is already running.
 */
const resumeRunning = async (): Promise<void> => {
  const running = await fetchRunningScans();

  await Promise.all(
    running
      .filter((scan) => scan.libraryId !== null)
      .map(async (scan) => {
        const libraryId = scan.libraryId ?? '';

        if (snapshot.progress.has(libraryId)) {
          return;
        }

        track(libraryId, {
          kind: scan.kind,
          phase: scan.phase,
          processed: scan.processed,
          total: scan.total,
          jobId: scan.jobId,
        });

        try {
          await waitForScanCompletion(scan.jobId, (found) => {
            track(libraryId, {
              kind: scan.kind,
              phase: found.phase,
              processed: found.processed,
              total: found.total,
              jobId: scan.jobId,
            });
          });
        } finally {
          untrack(libraryId);
        }
      }),
  );
};

/**
 * Follows a job somebody else queued, as though this page had started it, so a scan begun in another
 * tab shows the same progress here.
 *
 * @param libraryId - The library being worked on.
 * @param kind - What the work is.
 * @param jobId - The job to follow.
 */
const watchJob = (libraryId: string, kind: string, jobId: string): Promise<void> =>
  runAndTrack(libraryId, kind, () => Promise.resolve({ jobId, state: 'queued' }));

/**
 * Scans one library, tracking its progress until it finishes.
 *
 * @param libraryId - The library to scan.
 * @param force - Whether to re-probe every file rather than only what has changed.
 */
const startScan = (libraryId: string, force = false): Promise<void> =>
  runAndTrack(libraryId, force ? 'rescan' : 'scan', () => scanLibrary(libraryId, force));

/**
 * Scans every library at once, forcing a full re-probe of each file.
 *
 * @param libraries - The libraries to scan.
 */
const startScanAll = async (libraries: readonly Library[]): Promise<void> => {
  isScanningAll = true;
  notify();

  try {
    await Promise.all(
      libraries.map((library) =>
        runAndTrack(library.id, 'scan', () => scanLibrary(library.id, true)),
      ),
    );
  } finally {
    isScanningAll = false;
    notify();
  }
};

/**
 * Deletes and rebuilds every library from nothing, which is the answer to a catalogue that has gone
 * wrong in a way no rescan will correct.
 *
 * @param libraries - The libraries to rebuild.
 */
const startResetAll = async (libraries: readonly Library[]): Promise<void> => {
  isResettingAll = true;
  notify();

  try {
    await Promise.all(
      libraries.map((library) => runAndTrack(library.id, 'scan', () => resetLibrary(library.id))),
    );
  } finally {
    isResettingAll = false;
    notify();
  }
};

/**
 * Regenerates one library's previews against its current forced language, for after that setting has
 * been changed and the previews already made no longer match it.
 *
 * @param libraryId - The library to regenerate previews for.
 */
const startRegeneratePreviews = (libraryId: string): Promise<void> =>
  runAndTrack(libraryId, 'regeneratePreviews', () => regenerateLibraryPreviews(libraryId));

/**
 * Starts a job by kind, as picked from the Work tab's registry, against one library or against the
 * server as a whole.
 *
 * @param kind - The job to run.
 * @param libraryId - The library to run it against, where it takes one.
 * @param force - Whether to redo work already done.
 */
const runDefinedJob = (kind: string, libraryId?: string, force?: boolean): Promise<void> =>
  runAndTrack(libraryId ?? kind, kind, () => runJob(kind, libraryId, force));

/**
 * Starts a job by kind against every library at once.
 *
 * @param kind - The job to run.
 * @param libraries - The libraries to run it against.
 * @param force - Whether to redo work already done.
 */
const runDefinedJobAll = (
  kind: string,
  libraries: readonly Library[],
  force?: boolean,
): Promise<void> =>
  Promise.all(libraries.map((library) => runDefinedJob(kind, library.id, force))).then(
    () => undefined,
  );

export type { ScanEntry };

/**
 * Asks every run of one job kind to stop, whichever library each is working on.
 *
 * @param kind - The job kind to stop.
 */
const stopJobs = async (kind: string): Promise<void> => {
  const ids = [...snapshot.progress.values()]
    .filter((entry) => entry.kind === kind && entry.jobId !== null)
    .map((entry) => entry.jobId ?? '');

  await Promise.all(ids.map((jobId) => cancelJob(jobId)));
};

const resetForTests = () => {
  progress = new Map();
  isScanningAll = false;
  isResettingAll = false;
  notify();
};

export {
  subscribe,
  getSnapshot,
  resumeRunning,
  watchJob,
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
  stopJobs,
  resetForTests,
};
