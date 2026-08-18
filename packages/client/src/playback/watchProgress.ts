import { readFromServer } from '@FluxClient/query/readFromServer';
import { WatchProgressListSchema } from '@FluxContracts/schemas/WatchProgress';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

import { profileHeaders } from '@FluxClient/profiles/currentProfile';

const REPORT_EVERY_MILLISECONDS = 10_000;

/**
 * Reads where this viewer got to in everything they have started, which is what fills the
 * part-watched row and what a card's progress bar is drawn from.
 */
const fetchWatchProgress = async (): Promise<WatchProgress[]> => {
  return (await readFromServer('/api/progress', WatchProgressListSchema, profileHeaders()))
    .progress;
};

/**
 * Records where this viewer has got to. Best effort, and deliberately quiet about failure: somebody
 * watching a film should never be interrupted to be told their bookmark did not save.
 *
 * @param mediaId - The item being watched.
 * @param report - Where they are, how long it is, and whether it counts as finished.
 * @param options - Whether the page is going away, which makes this a request the browser has
 *   promised to finish rather than one it may cancel.
 */
const reportWatchProgress = async (
  mediaId: string,
  report: { positionSeconds: number; durationSeconds: number; isFinished?: boolean },
  { isLeaving = false }: { isLeaving?: boolean } = {},
): Promise<void> => {
  try {
    await fetch(`/api/media/${mediaId}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...profileHeaders() },
      body: JSON.stringify({ isFinished: false, ...report }),
      keepalive: isLeaving,
    });
  } catch {}
};

/**
 * Turns the list of progress the server answers with into a map, so a card can ask about itself
 * without searching the whole list.
 *
 * @param progress - Everything this viewer has watched.
 * @returns The same, keyed by item.
 */
const byMediaId = (progress: WatchProgress[]): Map<string, WatchProgress> =>
  new Map(progress.map((entry) => [entry.mediaId, entry]));

export type { WatchProgress };

export { fetchWatchProgress, reportWatchProgress, byMediaId, REPORT_EVERY_MILLISECONDS };
