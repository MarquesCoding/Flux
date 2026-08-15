import { createInertJobQueue } from './createInertJobQueue';
import { createJobScheduleService } from './createJobScheduleService';
import { createMemoryJobTriggerStore } from './createMemoryJobTriggerStore';
import type { JobScheduleService } from './JobScheduleService';

/**
 * Triggers held in memory, for testing the admin routes without Postgres.
 */
const createMemoryJobScheduleService = (): JobScheduleService =>
  createJobScheduleService({ store: createMemoryJobTriggerStore(), jobs: createInertJobQueue() });

export { createMemoryJobScheduleService };
