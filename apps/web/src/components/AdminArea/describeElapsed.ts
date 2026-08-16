import type { Job } from '@FluxWeb/admin/fetchAdmin';

/**
 * Says how long a job took, or how long it has been taking so far, in milliseconds while it is quick
 * enough for that to be the useful unit and in seconds after.
 *
 * @param job - The job.
 * @param now - The moment to measure an unfinished job against.
 * @returns How long, or a dash where it has not started.
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
