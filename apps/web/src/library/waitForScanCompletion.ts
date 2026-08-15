import { readScanState } from './fetchLibrary';
import type { ScanProgress, ScanState } from './fetchLibrary';

const TERMINAL_STATES: ReadonlySet<ScanState> = new Set(['completed', 'failed', 'unknown']);
const POLL_INTERVAL_MS = 800;

/**
 * Waits for a queued scan to actually finish.
 */
const waitForScanCompletion = async (
  jobId: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<void> => {
  let progress = await readScanState(jobId);

  onProgress?.(progress);

  while (!TERMINAL_STATES.has(progress.state)) {
    await new Promise((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });

    progress = await readScanState(jobId);
    onProgress?.(progress);
  }
};

export { waitForScanCompletion };
