import { WatchProgressListSchema } from '@FluxContracts/schemas/WatchProgress';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

import { profileHeaders } from '@FluxWeb/profiles/currentProfile';

const REPORT_EVERY_MILLISECONDS = 10_000;

/**
 * Reads where this viewer got to in everything.
 */
const fetchWatchProgress = async (): Promise<WatchProgress[] | null> => {
  try {
    const response = await fetch('/api/progress', {
      headers: { accept: 'application/json', ...profileHeaders() },
    });

    if (!response.ok) {
      return null;
    }

    return WatchProgressListSchema.parse(await response.json()).progress;
  } catch {
    return null;
  }
};

/**
 * Records where this viewer has got to.
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
 * Turns a list into something a card can ask one question of.
 */
const byMediaId = (progress: WatchProgress[]): Map<string, WatchProgress> =>
  new Map(progress.map((entry) => [entry.mediaId, entry]));

export type { WatchProgress };

export { fetchWatchProgress, reportWatchProgress, byMediaId, REPORT_EVERY_MILLISECONDS };
