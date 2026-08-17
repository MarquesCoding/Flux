import { createInertJobQueue } from './createInertJobQueue';
import { createJobScheduleService } from './createJobScheduleService';
import { createMemoryJobTriggerStore } from './createMemoryJobTriggerStore';
import type { JobScheduleService } from './JobScheduleService';

/**
 * Triggers held in memory and a queue that swallows what it is given, so the admin routes can be
 * exercised without Postgres or a worker. The schedule reads back exactly as it was written; nothing
 * it schedules ever runs.
 */
const createMemoryJobScheduleService = (): JobScheduleService =>
  createJobScheduleService({
    store: createMemoryJobTriggerStore(),
    jobs: createInertJobQueue(),
    readTimezone: () => Promise.resolve('UTC'),
  });

export { createMemoryJobScheduleService };
