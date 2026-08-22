import type { ScanEntry } from '@ValenceScreens/components/AdminArea/scanCoordinator';

const PHASE_ORDER: readonly string[] = ['probing', 'previews', 'trickplay', 'segments'];

type ProgressSummary = {
  phase: string | null;
  processed: number | null;
  total: number | null;
};

/**
 * Ranks a stage by how early it comes in a job's run, so that several libraries at different stages
 * can be compared. A stage nobody recognises ranks last rather than first, since an unknown stage is
 * more likely to be a new one added at the end than the very beginning.
 *
 * @param phase - The stage, or null where a job reports none.
 * @returns Its rank, lower being earlier.
 */
const rankOf = (phase: string | null): number => {
  if (phase === null) {
    return -1;
  }

  const index = PHASE_ORDER.indexOf(phase);

  return index === -1 ? PHASE_ORDER.length : index;
};

/**
 * Folds every library's progress on one job into the single bar its row shows. Reports the earliest
 * stage any library is still on rather than an average, because a job is only as far along as its
 * furthest-behind part, and counts only the libraries on that stage — adding a count from one stage
 * to a count from another produces a number that means nothing.
 *
 * @param entries - What each library working on this job reports.
 * @returns The stage and the counts to show, or null where nothing is running.
 */
const summariseProgress = (entries: ScanEntry[]): ProgressSummary | null => {
  if (entries.length === 0) {
    return null;
  }

  const earliest = Math.min(...entries.map((entry) => rankOf(entry.phase)));
  const onStage = entries.filter((entry) => rankOf(entry.phase) === earliest);
  const phase = onStage[0]?.phase ?? null;
  const counted = onStage.filter((entry) => entry.processed !== null && entry.total !== null);

  if (counted.length === 0) {
    return { phase, processed: null, total: null };
  }

  return {
    phase,
    processed: counted.reduce((sum, entry) => sum + (entry.processed ?? 0), 0),
    total: counted.reduce((sum, entry) => sum + (entry.total ?? 0), 0),
  };
};

export { summariseProgress };
