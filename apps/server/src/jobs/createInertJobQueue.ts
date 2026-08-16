import type { JobQueue } from './JobQueue';

/**
 * A queue that answers every question and runs nothing, for the tests and the tools that exercise
 * the HTTP surface without wanting background work to actually happen.
 *
 * @returns A queue that accepts everything and does none of it.
 */
const createInertJobQueue = (overrides: Partial<JobQueue> = {}): JobQueue => ({
  enqueue: () => Promise.resolve(null),
  readState: () => Promise.resolve('unknown'),
  readProgress: () => null,
  listRunning: () => [],
  cancel: () => Promise.resolve(false),
  isCancelled: () => false,
  reportProgress: () => {},
  setSchedule: () => Promise.resolve(),
  clearSchedule: () => Promise.resolve(),
  listSchedules: () => Promise.resolve([]),
  stop: () => Promise.resolve(),
  ...overrides,
});

export { createInertJobQueue };
