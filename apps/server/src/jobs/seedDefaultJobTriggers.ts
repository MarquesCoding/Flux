import { DEFAULT_JOB_TRIGGERS } from './jobDefinitions';
import type { JobScheduleService } from './JobScheduleService';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';

type SeedDefaultJobTriggersOptions = {
  schedules: JobScheduleService;
  settings: SettingsStore;
};

/**
 * Gives a job kind its default schedule the first time Flux ever sees it, and never again — an
 * operator who turns a nightly scan off should not find it back the next time the server restarts.
 *
 * @param options - The store to write to, and the settings recording which kinds have been seeded.
 * @returns Which kinds were seeded this time.
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
