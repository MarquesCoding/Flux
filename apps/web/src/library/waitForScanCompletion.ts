import fetchLibraryModule from './fetchLibrary'
import type { ScanState } from './fetchLibrary'

const { readScanState } = fetchLibraryModule

const TERMINAL_STATES: ReadonlySet<ScanState> = new Set(['completed', 'failed', 'unknown'])
const POLL_INTERVAL_MS = 800

/**
 * Waits for a queued scan to actually finish.
 *
 * A scan is queued and answered for immediately, long before the walk it
 * describes is done. Polled rather than pushed: one more scan is not worth a
 * stream of its own, so this checks in occasionally until the state stops
 * changing.
 */
const waitForScanCompletion = async (jobId: string): Promise<void> => {
  let state = await readScanState(jobId)

  while (!TERMINAL_STATES.has(state)) {
    await new Promise((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS)
    })

    state = await readScanState(jobId)
  }
}

export default { waitForScanCompletion }
