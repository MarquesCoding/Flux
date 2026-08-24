import type { ScannedLibrary } from '@ValenceContracts/schemas/Webhook';

type ScanRunReport = {
  libraries: ScannedLibrary[];
  added: number;
  updated: number;
  removed: number;
  failed: number;
};

type CollectScanRunsOptions = {
  onFinished: (report: ScanRunReport) => void;
  givesUpAfterMilliseconds: number;
  wait?: (run: () => void, afterMilliseconds: number) => { cancel: () => void };
};

type ScanRuns = {
  record: (runId: string, expected: number, scanned: ScannedLibrary) => void;
};

/**
 * Gathers the libraries of one scan and reports them together, once every library in it has been
 * heard from.
 *
 * Scanning everything is one job per library, so a library finishing is not the scan finishing. The
 * client that asked for them says which run they belong to and how many there are, which is the only
 * thing that knows: the queue sees unrelated jobs, and a pause between two of them is as likely to be
 * one waiting its turn as it is to be the end of the run.
 *
 * A run whose last library never reports — cancelled, or failed before it read anything — is given a
 * while and then reported anyway. Saying what did finish beats saying nothing because something did
 * not.
 *
 * @param onFinished - Told about each run once it is complete.
 * @param givesUpAfterMilliseconds - How long to wait for the rest of a run before reporting it anyway.
 * @param wait - How to wait, so a test need not.
 * @returns Somewhere to record each library as its scan reports.
 */
const collectScanRuns = ({
  onFinished,
  givesUpAfterMilliseconds,
  wait = (run, afterMilliseconds) => {
    const timer = setTimeout(run, afterMilliseconds);

    return {
      cancel: () => {
        clearTimeout(timer);
      },
    };
  },
}: CollectScanRunsOptions): ScanRuns => {
  const runs = new Map<
    string,
    { expected: number; libraries: Map<string, ScannedLibrary>; giveUp: { cancel: () => void } }
  >();

  const report = (runId: string): void => {
    const run = runs.get(runId);

    if (run === undefined) {
      return;
    }

    run.giveUp.cancel();
    runs.delete(runId);

    const libraries = [...run.libraries.values()];

    if (libraries.length === 0) {
      return;
    }

    onFinished({
      libraries,
      added: libraries.reduce((total, one) => total + one.added, 0),
      updated: libraries.reduce((total, one) => total + one.updated, 0),
      removed: libraries.reduce((total, one) => total + one.removed, 0),
      failed: libraries.reduce((total, one) => total + one.failed, 0),
    });
  };

  return {
    record: (runId, expected, scanned) => {
      const run = runs.get(runId) ?? {
        expected,
        libraries: new Map<string, ScannedLibrary>(),
        giveUp: wait(() => {
          report(runId);
        }, givesUpAfterMilliseconds),
      };

      run.libraries.set(scanned.libraryId, scanned);
      runs.set(runId, run);

      if (run.libraries.size >= run.expected) {
        report(runId);
      }
    },
  };
};

export type { ScanRunReport, ScanRuns };

export { collectScanRuns };
