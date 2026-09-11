import { cpus } from 'node:os';

const PER_JOB_CORES = 2;
const FEWEST = 1;
const MOST = 16;

/**
 * How many files the library works on at once, where the operator has not said.
 *
 * Scaled to the machine rather than fixed. This was capped at four however many cores were present,
 * which gave a twenty core server the concurrency of a four core one — and the cap was the reason a
 * scan used a single core of twenty.
 *
 * Two cores apiece, because a render is given two threads. The ceiling is there because the work is
 * more often waiting on a disk than on a processor, and past some width more readers on one array
 * make each other slower rather than faster. Where that width is depends on the storage, which is
 * why this is a default and MEDIA_JOBS is a setting.
 *
 * @param cores - How many processors the machine has. Read from the machine where not given.
 * @returns How many files to work on at once.
 */
const defaultMediaJobs = (cores: number = cpus().length): number =>
  Math.max(FEWEST, Math.min(MOST, Math.floor(cores / PER_JOB_CORES)));

export { defaultMediaJobs };
