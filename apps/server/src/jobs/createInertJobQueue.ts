import type { JobQueue } from './JobQueue';

/**
 * A queue that answers every question and does nothing.
 *
 * For the things that hold a queue but are not being tested through it — a
 * schedule service, a maintenance service, a route. Each of them used to
 * carry its own hand-written stub, which meant every method added to the port
 * broke three files that had no opinion about it.
 *
 * What a test is actually asking about is passed in and overrides the rest, so
 * a test about enqueueing says only what enqueueing should do.
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
