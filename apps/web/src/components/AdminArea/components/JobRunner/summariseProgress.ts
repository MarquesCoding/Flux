import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

const PHASE_ORDER: readonly string[] = ['probing', 'previews', 'trickplay', 'segments'];

type ProgressSummary = {
  phase: string | null;
  processed: number | null;
  total: number | null;
};

/**
 * How far along a stage is, where a job reports one per library it is working through.
 */
const rankOf = (phase: string | null): number => {
  if (phase === null) {
    return -1;
  }

  const index = PHASE_ORDER.indexOf(phase);

  return index === -1 ? PHASE_ORDER.length : index;
};

/**
 * Folds every library's progress on one job into the single bar its row shows.
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

export type { ProgressSummary };

export { summariseProgress, PHASE_ORDER };
