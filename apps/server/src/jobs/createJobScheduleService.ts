import { JOB_DEFINITIONS, scheduleQueueNameFor } from './jobDefinitions';
import { toCron } from './scheduleTrigger';
import type { JobQueue } from './JobQueue';
import type { JobScheduleService } from './JobScheduleService';
import type { JobTriggerStore } from './JobTriggerStore';

type CreateJobScheduleServiceOptions = {
  store: JobTriggerStore;
  jobs: JobQueue;
  readTimezone: () => Promise<string>;
};

/**
 * Keeps each job kind's schedule in step with what an operator has configured: registering what
 * should run on a clock, removing what should not, and answering what is currently set.
 *
 * @param options - The queue to schedule on, and the store the triggers are kept in.
 * @returns The schedule service.
 */
const createJobScheduleService = ({
  store,
  jobs,
  readTimezone,
}: CreateJobScheduleServiceOptions): JobScheduleService => {
  const ownedQueueNames = new Set(
    JOB_DEFINITIONS.map((definition) => scheduleQueueNameFor(definition.kind)),
  );

  const isKnownKind = (kind: string): boolean =>
    JOB_DEFINITIONS.some((definition) => definition.kind === kind);

  const reconcile = async (): Promise<void> => {
    const timezone = await readTimezone();
    const stored = await store.list();
    const wanted = new Map<string, { queueName: string; cron: string }>();

    for (const row of stored) {
      const cron = toCron(row.trigger);

      if (cron !== null && isKnownKind(row.kind)) {
        wanted.set(row.id, { queueName: scheduleQueueNameFor(row.kind), cron });
      }
    }

    const existing = await jobs.listSchedules();

    for (const schedule of existing) {
      if (ownedQueueNames.has(schedule.queueName) && !wanted.has(schedule.key)) {
        await jobs.clearSchedule(schedule.queueName, schedule.key);
      }
    }

    for (const [key, { queueName, cron }] of wanted) {
      await jobs.setSchedule(queueName, key, cron, timezone);
    }
  };

  return {
    timezone: readTimezone,

    list: async () => {
      const stored = await store.list();

      return JOB_DEFINITIONS.map((definition) => ({
        kind: definition.kind,
        triggers: stored
          .filter((row) => row.kind === definition.kind)
          .map((row) => ({ id: row.id, trigger: row.trigger })),
      }));
    },

    add: async (kind, trigger) => {
      if (!isKnownKind(kind)) {
        return null;
      }

      const stored = await store.add(kind, trigger);

      await reconcile();

      return { id: stored.id, trigger: stored.trigger };
    },

    remove: async (kind, triggerId) => {
      if (!(await store.remove(kind, triggerId))) {
        return false;
      }

      await reconcile();

      return true;
    },

    sync: async () => {
      await reconcile();

      const stored = await store.list();
      const startupKinds = new Set(
        stored.filter((row) => row.trigger.kind === 'startup').map((row) => row.kind),
      );

      return JOB_DEFINITIONS.filter((definition) => startupKinds.has(definition.kind)).map(
        (definition) => definition.kind,
      );
    },
  };
};

export { createJobScheduleService };
