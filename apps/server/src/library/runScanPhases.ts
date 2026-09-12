import type { ScanResult } from '@ValenceContracts/schemas/Library';

type ScanPhaseWork = {
  scan: () => Promise<ScanResult | null>;
  fetchLogos: () => Promise<void>;
  detectSegments: () => Promise<void>;
};

type ScanPhaseOptions = {
  work: ScanPhaseWork;
  isCancelled: () => boolean;
  onScanned: (result: ScanResult) => Promise<void>;
  onRead: () => Promise<void>;
};

const PHASES = ['scan', 'fetchLogos', 'detectSegments'] as const;

/**
 * Reads a library: the files, then the lettering, then the intros.
 *
 * Reading only. The clips and the scrub thumbnails used to be phases four and five of this, and a
 * scan was not finished until they were — which on a real library is days, and for all of those days
 * no new film could be picked up, because a library will not read twice at once. Adding one film
 * meant waiting for every thumbnail in the collection.
 *
 * So the renders are asked for instead. `onRead` runs once the reading is done and queues them as
 * work of their own, and this returns. That is what Jellyfin calls a non-blocking scan, and it is
 * the only behaviour here: media is in the library before its thumbnails are drawn.
 *
 * Every phase works from what is outstanding rather than from what this scan happened to import, so
 * running one over a library that is already complete costs a query and nothing else. That is what
 * makes it safe to run all of them every time rather than remembering which ones a file still needs,
 * and it is why the renders can be queued unconditionally.
 *
 * Lettering comes before the intros because it is the cheaper of the two and a scan is usually being
 * watched, so a page shows the right thing sooner for the ordering costing nothing.
 *
 * Cancellation is checked between phases rather than within them, so a cancelled scan stops at the
 * next boundary rather than abandoning work half-written — and a cancelled scan asks for no renders,
 * since stopping a scan should not start the longest work in the system.
 *
 * @param work - What each phase does.
 * @param isCancelled - Whether the job has been asked to stop.
 * @param onScanned - Told what the reading phase changed, where it reported anything.
 * @param onRead - Asks for the artefacts the library is still missing, once it has been read.
 */
const runScanPhases = async ({
  work,
  isCancelled,
  onScanned,
  onRead,
}: ScanPhaseOptions): Promise<void> => {
  for (const phase of PHASES) {
    if (isCancelled()) {
      return;
    }

    if (phase !== 'scan') {
      await work[phase]();

      continue;
    }

    const result = await work.scan();

    if (result !== null) {
      await onScanned(result);
    }
  }

  if (isCancelled()) {
    return;
  }

  await onRead();
};

export type { ScanPhaseWork, ScanPhaseOptions };

export { runScanPhases, PHASES };
