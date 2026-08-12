import {
  scanLibrary,
  resetLibrary,
  regenerateLibraryPreviews,
} from '@FluxWeb/library/fetchLibrary';
import { fetchRunningScans, runJob } from '@FluxWeb/admin/fetchAdmin';
import { waitForScanCompletion } from '@FluxWeb/library/waitForScanCompletion';
import type { ScanJob } from '@FluxWeb/library/fetchLibrary';
import type { Library } from '@FluxContracts/schemas/Library';

type ScanEntry = {
  /**
   * A widely-known kind (`'scan'`, `'regeneratePreviews'`) or any job kind
   * the server's job registry names — the Work tab's picker can track a
   * kind this module has never heard of before.
   */
  kind: string;
  phase: string | null;
  processed: number | null;
  total: number | null;
};

type ScanSnapshot = {
  progress: ReadonlyMap<string, ScanEntry>;
  isScanningAll: boolean;
  isResettingAll: boolean;
};

/**
 * Tracks running scans outside any component.
 *
 * The admin page unmounts every time an operator navigates away from it —
 * the library section is one panel among several, and switching panels
 * elsewhere in the app throws the whole tree away. A scan started before
 * that has no component left to report its progress to, and used to simply
 * vanish from the screen even though it kept running on the server. Kept
 * here instead, a scan started once is visible again the moment the admin
 * page is back, whether that's the same tab a second later or a different
 * one entirely.
 */
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
 * Listens for changes, for `useSyncExternalStore` to drive a component from.
 *
 * Returns the function that stops listening.
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
 * Queues one library's job and tracks its progress until it finishes.
 *
 * The one place that enqueues, polls and untracks — every job kind this
 * module offers, generic or not, runs through this so there is a single
 * implementation of "track a library job to completion" rather than one per
 * kind.
 */
const runAndTrack = async (
  libraryId: string,
  kind: string,
  enqueue: () => Promise<ScanJob | null>,
): Promise<void> => {
  track(libraryId, { kind, phase: null, processed: null, total: null });

  try {
    const job = await enqueue();

    if (job !== null) {
      await waitForScanCompletion(job.jobId, (found) => {
        track(libraryId, {
          kind,
          phase: found.phase,
          processed: found.processed,
          total: found.total,
        });
      });
    }
  } finally {
    untrack(libraryId);
  }
};

/**
 * Picks up scans the server is already running.
 *
 * A reload loses the job ids this page was following, but not the work: the
 * server is still scanning, and a page that shows nothing is telling the
 * operator something untrue. Asked once when the page opens, so a refresh
 * mid-scan rejoins rather than starts again.
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
        });

        try {
          await waitForScanCompletion(scan.jobId, (found) => {
            track(libraryId, {
              kind: scan.kind,
              phase: found.phase,
              processed: found.processed,
              total: found.total,
            });
          });
        } finally {
          untrack(libraryId);
        }
      }),
  );
};

/**
 * Follows a job somebody else queued, as though this page had started it.
 *
 * A correction is made from a dialog rather than from the Libraries panel, so
 * without this the work it sets off would run unwatched and the operator
 * would be told it was done while the files were still being read.
 */
const watchJob = (libraryId: string, kind: string, jobId: string): Promise<void> =>
  runAndTrack(libraryId, kind, () => Promise.resolve({ jobId, state: 'queued' }));

/**
 * Scans one library, tracking its progress until it finishes.
 *
 * Forced, every file is read again whatever the filesystem says about it. An
 * ordinary scan skips anything whose size and date are unchanged, which is
 * right for finding new files and useless for fixing what is known about the
 * old ones: a title that came out wrong stays wrong however many times the
 * button is pressed, because the file it came from has not moved.
 */
const startScan = (libraryId: string, force = false): Promise<void> =>
  runAndTrack(libraryId, force ? 'rescan' : 'scan', () => scanLibrary(libraryId, force));

/**
 * Scans every library at once, forcing a full re-probe of each file.
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
 * Deletes and rebuilds every library from nothing.
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
 * Regenerates one library's previews against its current forced language.
 */
const startRegeneratePreviews = (libraryId: string): Promise<void> =>
  runAndTrack(libraryId, 'regeneratePreviews', () => regenerateLibraryPreviews(libraryId));

/**
 * Starts a job by kind, as picked from the Work tab's job registry.
 *
 * Works for any kind the server offers without this module needing to know
 * about it in advance — unlike `startScan`/`startRegeneratePreviews`, which
 * exist for the Libraries panel's own fixed buttons.
 *
 * `libraryId` is left out for a job that does not need one — tracked under
 * its own kind instead, since there is no library id to key it by and at
 * most one of a given kind ever runs at once.
 */
const runDefinedJob = (kind: string, libraryId?: string, force?: boolean): Promise<void> =>
  runAndTrack(libraryId ?? kind, kind, () => runJob(kind, libraryId, force));

/**
 * Starts a job by kind against every library at once.
 */
const runDefinedJobAll = (
  kind: string,
  libraries: readonly Library[],
  force?: boolean,
): Promise<void> =>
  Promise.all(libraries.map((library) => runDefinedJob(kind, library.id, force))).then(
    () => undefined,
  );

export type { ScanEntry, ScanSnapshot };

/**
 * Clears every tracked scan.
 *
 * For tests only: this module is a singleton for the lifetime of the page on
 * purpose, but a test file reuses the same module instance across every
 * `it()` block, and a scan a test left running (deliberately, to inspect
 * mid-flight state) would otherwise leak into whichever test runs next.
 */
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
  resetForTests,
};
