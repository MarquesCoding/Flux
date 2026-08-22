import type { FinishedJob } from './createJobQueue';

type JobStall = {
  kind: string;
  failures: number;
  everSucceeded: boolean;
  reason: string;
};

type CreateJobHealthWatchOptions = {
  onStalled: (stall: JobStall) => void;
  onWorking: (kind: string) => void;
  stalledAfter?: number;
};

const STALLED_AFTER = 3;

/**
 * Watches how each kind of job is faring and speaks up when a kind stops working entirely — once,
 * rather than on every failure.
 *
 * A job that failed today and a job that has never once succeeded are different conditions with
 * different answers, and nothing here could tell them apart: a scheduled queue failed twelve hundred
 * times over nine days without raising anything, because every failure looked like the first. This
 * counts failures in a row per kind, remembers whether the kind has ever worked, and reports the
 * crossing rather than the count.
 *
 * @param onStalled - Called once, when a kind has failed every time for long enough to mean it.
 * @param onWorking - Called once, when a stalled kind runs without failing.
 * @param stalledAfter - How many failures in a row it takes. Three by default, because a job is
 * retried twice before it is given up on: three failures is one firing that failed all the way
 * through rather than three separate bad days.
 * @returns The watch, to be told about every job that ends.
 */
const createJobHealthWatch = ({
  onStalled,
  onWorking,
  stalledAfter = STALLED_AFTER,
}: CreateJobHealthWatchOptions) => {
  const health = new Map<
    string,
    { failures: number; everSucceeded: boolean; stalled: boolean; reason: string }
  >();

  const healthOf = (kind: string) =>
    health.get(kind) ?? { failures: 0, everSucceeded: false, stalled: false, reason: '' };

  return {
    record: ({ kind, reason }: FinishedJob): void => {
      const current = healthOf(kind);

      if (reason === null) {
        health.set(kind, { failures: 0, everSucceeded: true, stalled: false, reason: '' });

        if (current.stalled) {
          onWorking(kind);
        }

        return;
      }

      const failures = current.failures + 1;
      const stalled = current.stalled || failures >= stalledAfter;

      health.set(kind, { ...current, failures, stalled, reason });

      if (stalled && !current.stalled) {
        onStalled({ kind, failures, everSucceeded: current.everSucceeded, reason });
      }
    },

    stalled: (): JobStall[] =>
      [...health]
        .filter(([, about]) => about.stalled)
        .map(([kind, about]) => ({
          kind,
          failures: about.failures,
          everSucceeded: about.everSucceeded,
          reason: about.reason,
        })),
  };
};

export type { JobStall };

export { createJobHealthWatch, STALLED_AFTER };
