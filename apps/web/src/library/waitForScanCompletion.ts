import { readScanState } from './fetchLibrary';
import type { ScanProgress, ScanState } from './fetchLibrary';

const TERMINAL_STATES: ReadonlySet<ScanState> = new Set(['completed', 'failed', 'unknown']);
const POLL_INTERVAL_MS = 800;

/**
 * Waits for a queued scan to actually finish, polling its state rather than assuming that queuing it
 * was the end of the matter — a first scan of a real library is minutes of work, and the page that
 * asked for it needs to know when there is something to show.
 *
 * @param jobId - The scan to wait on.
 * @param options - How often to ask and when to give up.
 * @returns How the scan ended.
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
