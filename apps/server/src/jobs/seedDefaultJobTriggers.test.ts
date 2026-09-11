import { describe, expect, it } from 'vitest';
import { createMemoryJobScheduleService } from './createMemoryJobScheduleService';
import { createMemorySettingsStore } from '@ValenceServer/settings/createMemorySettingsStore';
import { DEFAULT_JOB_TRIGGERS } from './jobDefinitions';
import { seedDefaultJobTriggers } from './seedDefaultJobTriggers';
import type { ServerSettings } from '@ValenceServer/settings/ServerSettings';

const SETTINGS: ServerSettings = {
  trustedOrigins: [],
  cookieSecure: false,
  setupCompletedAt: null,
  catalogueApiKey: '',
  hardwareAccel: '',
  previewQuality: 'high' as const,
  seededJobTriggerKinds: [],
  seededRoleNames: [],
  pushPublicKey: '',
  pushPrivateKey: '',
  mediaDigestReadTo: null,
  jobsTimezone: '',
};

const build = (seededJobTriggerKinds: string[] = []) => ({
  schedules: createMemoryJobScheduleService(),
  settings: createMemorySettingsStore({ ...SETTINGS, seededJobTriggerKinds }),
});

const triggersFor = async (
  schedules: ReturnType<typeof createMemoryJobScheduleService>,
  kind: string,
) => (await schedules.list()).find((entry) => entry.kind === kind)?.triggers ?? [];

describe('seedDefaultJobTriggers', () => {
  it('gives every job with a default its triggers on a fresh instance', async () => {
    const { schedules, settings } = build();

    const seeded = await seedDefaultJobTriggers({ schedules, settings });

    expect(seeded.toSorted()).toEqual(Object.keys(DEFAULT_JOB_TRIGGERS).toSorted());
    expect((await triggersFor(schedules, 'library.scan')).map((entry) => entry.trigger)).toEqual([
      { kind: 'daily', hour: 3, minute: 0 },
    ]);
  });

  it('leaves a destructive job with no schedule of its own', async () => {
    const { schedules, settings } = build();

    await seedDefaultJobTriggers({ schedules, settings });

    expect(await triggersFor(schedules, 'library.reset')).toEqual([]);
  });

  it('does not seed the same kind twice', async () => {
    const { schedules, settings } = build();

    await seedDefaultJobTriggers({ schedules, settings });

    expect(await seedDefaultJobTriggers({ schedules, settings })).toEqual([]);
    expect(await triggersFor(schedules, 'library.scan')).toHaveLength(1);
  });

  it('does not bring back a default the operator deleted', async () => {
    const { schedules, settings } = build();

    await seedDefaultJobTriggers({ schedules, settings });

    for (const entry of await triggersFor(schedules, 'library.scan')) {
      await schedules.remove('library.scan', entry.id);
    }

    await seedDefaultJobTriggers({ schedules, settings });

    expect(await triggersFor(schedules, 'library.scan')).toEqual([]);
  });

  it('leaves a kind alone when the operator already set triggers on it', async () => {
    const { schedules, settings } = build();

    await schedules.add('library.scan', { kind: 'everyHours', hours: 6 });
    await seedDefaultJobTriggers({ schedules, settings });

    expect((await triggersFor(schedules, 'library.scan')).map((entry) => entry.trigger)).toEqual([
      { kind: 'everyHours', hours: 6 },
    ]);
  });

  it('records every kind it considered, so a skipped one is not seeded later', async () => {
    const { schedules, settings } = build();

    await schedules.add('library.scan', { kind: 'everyHours', hours: 6 });
    await seedDefaultJobTriggers({ schedules, settings });

    expect((await settings.read()).seededJobTriggerKinds).toContain('library.scan');
  });

  it('seeds only the kind a later version added, leaving the rest as they are', async () => {
    const alreadyDone = Object.keys(DEFAULT_JOB_TRIGGERS).filter(
      (kind) => kind !== 'server.cleanupImageCache',
    );
    const { schedules, settings } = build(alreadyDone);

    expect(await seedDefaultJobTriggers({ schedules, settings })).toEqual([
      'server.cleanupImageCache',
    ]);
  });
});
