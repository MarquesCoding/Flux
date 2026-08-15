import type { JobQueue } from './JobQueue';

/**
 * A queue that answers every question and does nothing.
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
