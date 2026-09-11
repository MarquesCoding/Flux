import type { JobQueue } from './JobQueue';

/**
 * A queue that answers every question and runs nothing, for the tests and the tools that exercise
 * the HTTP surface without wanting background work to actually happen.
 *
 * @param overrides - Any operations to answer differently, for a test that cares about one of them.
 * @returns A queue that accepts everything and does none of it.
 */
const createInertJobQueue = (overrides: Partial<JobQueue> = {}): JobQueue => ({
  startWorking: () => Promise.resolve(),
  enqueue: () => Promise.resolve(null),
  readState: () => Promise.resolve('unknown'),
  readProgress: () => null,
  listRunning: () => [],
  liveJob: () => Promise.resolve(null),
  cancel: () => Promise.resolve(false),
  cancelFor: () => Promise.resolve(0),
  isCancelled: () => false,
  reportProgress: () => {},
  setSchedule: () => Promise.resolve(),
  clearSchedule: () => Promise.resolve(),
  listSchedules: () => Promise.resolve([]),
  stop: () => Promise.resolve(),
  ...overrides,
});

export { createInertJobQueue };
