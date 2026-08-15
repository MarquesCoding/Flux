import { WatchProgressListSchema } from '@FluxContracts/schemas/WatchProgress';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

import { profileHeaders } from '@FluxWeb/profiles/currentProfile';

/**
 * How often a position is sent while something is playing.
 *
 * Often enough that a tab killed outright loses a moment rather than a scene,
 * rarely enough that a two hour film is a few hundred small requests instead
 * of tens of thousands.
 *
 * An orderly departure — a reload, a closed tab, a followed link — does not
 * rely on this at all: the position is sent as the page goes away, exactly, so
 * this interval only bounds what a crash can lose.
 */
const REPORT_EVERY_MILLISECONDS = 5_000;

/**
 * Reads where this viewer got to in everything.
 *
 * Answers with nothing rather than throwing: a progress bar is an addition to
 * a library, and its absence must not stop one being browsed.
 */
const fetchWatchProgress = async (): Promise<WatchProgress[]> => {
  try {
    const response = await fetch('/api/progress', {
      headers: { accept: 'application/json', ...profileHeaders() },
    });

    if (!response.ok) {
      return [];
    }

    return WatchProgressListSchema.parse(await response.json()).progress;
  } catch {
    return [];
  }
};

/**
 * Records where this viewer has got to.
 *
 * Best effort, and deliberately quiet about failure: someone watching a film
 * should never be interrupted to be told their bookmark did not save.
 *
 * `isLeaving` is for the report sent as the page goes away — a reload, a
 * closed tab, a link followed. The browser is free to cancel ordinary requests
 * from a page it is tearing down, and that one request is the only thing
 * standing between a viewer and losing the last ten seconds they watched, so
 * it is sent as one the browser has promised to finish.
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
