import { createJobScheduleService } from './createJobScheduleService';
import { createMemoryJobTriggerStore } from './createMemoryJobTriggerStore';
import type { JobQueue } from './JobQueue';
import type { JobScheduleService } from './JobScheduleService';

/**
 * A queue that accepts schedules and forgets them, so the real schedule
 * service can run with nothing behind it.
 *
 * Only the scheduling half is answered: a test reaching for this is asking
 * about triggers, and anything that actually enqueues work is given a real
 * queue instead.
 */
const createInertJobQueue = (): JobQueue => ({
  enqueue: () => Promise.resolve(null),
  readState: () => Promise.resolve('unknown'),
  readProgress: () => null,
  listRunning: () => [],
  reportProgress: () => {},
  setSchedule: () => Promise.resolve(),
  clearSchedule: () => Promise.resolve(),
  listSchedules: () => Promise.resolve([]),
  stop: () => Promise.resolve(),
});

/**
 * Triggers held in memory, for testing the admin routes without Postgres.
 *
 * The real service over a memory store rather than a separate implementation
 * of the port, so a route test exercises the same reconciling logic the
 * server runs.
 */
const createMemoryJobScheduleService = (): JobScheduleService =>
  createJobScheduleService({ store: createMemoryJobTriggerStore(), jobs: createInertJobQueue() });

export { createMemoryJobScheduleService };
