import type { ScanResult } from '@FluxContracts/schemas/Library';

type ScanPhaseWork = {
  scan: () => Promise<ScanResult | null>;
  fetchLogos: () => Promise<void>;
  regeneratePreviews: () => Promise<void>;
  regenerateTrickplay: () => Promise<void>;
  detectSegments: () => Promise<void>;
};

type ScanPhaseOptions = {
  work: ScanPhaseWork;
  isCancelled: () => boolean;
  onScanned: (result: ScanResult) => Promise<void>;
};

const PHASES = [
  'scan',
  'fetchLogos',
  'regeneratePreviews',
  'regenerateTrickplay',
  'detectSegments',
] as const;

/**
 * Runs a scan's phases in turn: read the files, then make everything the items are still missing —
 * lettering, previews, scrub previews and intros. Every phase after the first works from what is
 * outstanding rather than from what this scan happened to import, so running one over a library that
 * is already complete costs a query and nothing else. That is what makes it safe for a scan to run
 * all of them every time, rather than trying to remember which ones a given file still needs.
 *
 * Lettering comes before the two render phases because it is metadata rather than a render, it is
 * cheap beside a preview, and a scan is usually being watched — a page shows the right thing sooner
 * for the ordering costing nothing.
 *
 * Cancellation is checked between phases rather than within them, so a cancelled scan stops at the
 * next boundary instead of abandoning a render half-written.
 *
 * @param work - What each phase does.
 * @param isCancelled - Whether the job has been asked to stop.
 * @param onScanned - Told what the reading phase changed, where it reported anything.
 */
const runScanPhases = async ({ work, isCancelled, onScanned }: ScanPhaseOptions): Promise<void> => {
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
};

export type { ScanPhaseWork, ScanPhaseOptions };

export { runScanPhases, PHASES };
