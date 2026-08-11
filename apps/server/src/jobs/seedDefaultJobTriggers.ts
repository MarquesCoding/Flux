import { DEFAULT_JOB_TRIGGERS } from './jobDefinitions';
import type { JobScheduleService } from './JobScheduleService';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';

type SeedDefaultJobTriggersOptions = {
  schedules: JobScheduleService;
  settings: SettingsStore;
};

/**
 * Gives a job kind its default triggers the first time Flux ever sees it.
 *
 * Once per kind, not once per boot: which kinds have been seeded is recorded
 * in settings, so deleting a default is a decision that sticks while a job
 * added in a later version still arrives with sensible defaults of its own. A
 * kind that already has triggers is left alone regardless — whatever is there
 * came from an operator, and defaults are for an empty schedule, not an
 * opinion about one.
 *
 * Reports the kinds it seeded.
 */
const seedDefaultJobTriggers = async ({
  schedules,
  settings,
}: SeedDefaultJobTriggersOptions): Promise<string[]> => {
  const { seededJobTriggerKinds } = await settings.read();
  const existing = await schedules.list();
  const seeded: string[] = [];

  for (const [kind, triggers] of Object.entries(DEFAULT_JOB_TRIGGERS)) {
    const isAlreadySeeded = seededJobTriggerKinds.includes(kind);
    const hasTriggers = (existing.find((entry) => entry.kind === kind)?.triggers.length ?? 0) > 0;

    if (isAlreadySeeded || hasTriggers) {
      continue;
    }

    for (const trigger of triggers) {
      await schedules.add(kind, trigger);
    }

    seeded.push(kind);
  }

  const unrecorded = Object.keys(DEFAULT_JOB_TRIGGERS).filter(
    (kind) => !seededJobTriggerKinds.includes(kind),
  );

  if (unrecorded.length > 0) {
    await settings.write({ seededJobTriggerKinds: [...seededJobTriggerKinds, ...unrecorded] });
  }

  return seeded;
};

export { seedDefaultJobTriggers };
