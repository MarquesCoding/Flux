import { createInertJobQueue } from './createInertJobQueue';
import { createJobScheduleService } from './createJobScheduleService';
import { createMemoryJobTriggerStore } from './createMemoryJobTriggerStore';
import type { JobScheduleService } from './JobScheduleService';

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
