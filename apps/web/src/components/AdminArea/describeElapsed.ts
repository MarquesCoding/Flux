import type { Job } from '@FluxWeb/admin/fetchAdmin';

/**
 * How long a job took, or has been taking.
 */
const describeElapsed = (job: Job, now: number): string => {
  if (job.startedAtMs === null) {
    return '—';
  }

  const elapsed = (job.finishedAtMs ?? now) - job.startedAtMs;

  return elapsed < 1000
    ? `${elapsed.toString()} ms`
    : `${(elapsed / 1000).toFixed(elapsed < 10_000 ? 1 : 0)} s`;
};

export { describeElapsed };
