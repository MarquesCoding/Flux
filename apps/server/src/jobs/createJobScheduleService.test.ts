import { describe, expect, it, vi } from 'vitest';
import { createInertJobQueue } from './createInertJobQueue';
import { createJobScheduleService } from './createJobScheduleService';
import { createMemoryJobTriggerStore } from './createMemoryJobTriggerStore';
import type { JobQueue } from './JobQueue';

const build = (overrides: Partial<JobQueue> = {}) =>
  createJobScheduleService({
    store: createMemoryJobTriggerStore(),
    jobs: createInertJobQueue(overrides),
  });

describe('createJobScheduleService', () => {
  it('lists every job kind with no triggers until one is added', async () => {
    const list = await build().list();

    expect(list.length).toBeGreaterThan(0);
    expect(list.every((entry) => entry.triggers.length === 0)).toBe(true);
  });

  it('schedules a library-scoped kind on its trigger queue, not its own', async () => {
    const setSchedule = vi.fn(() => Promise.resolve());
    const schedules = build({ setSchedule });

    const added = await schedules.add('library.scan', { kind: 'everyHours', hours: 6 });

    expect(setSchedule).toHaveBeenCalledWith('library.scan.scheduled', added?.id, '0 */6 * * *');
  });

  it('schedules a server-wide kind on its own queue', async () => {
    const setSchedule = vi.fn(() => Promise.resolve());
    const schedules = build({ setSchedule });

    const added = await schedules.add('server.cleanupSessions', {
      kind: 'daily',
      hour: 3,
      minute: 0,
    });

    expect(setSchedule).toHaveBeenCalledWith('server.cleanupSessions', added?.id, '0 3 * * *');
  });

  it('keeps several triggers on one job side by side', async () => {
    const schedules = build();

    await schedules.add('library.scan', { kind: 'daily', hour: 3, minute: 0 });
    await schedules.add('library.scan', { kind: 'startup' });

    const entry = (await schedules.list()).find((candidate) => candidate.kind === 'library.scan');

    expect(entry?.triggers.map((trigger) => trigger.trigger.kind)).toEqual(['daily', 'startup']);
  });

  it('does not push a startup trigger into the queue, having no cron for it', async () => {
    const setSchedule = vi.fn(() => Promise.resolve());

    await build({ setSchedule }).add('library.scan', { kind: 'startup' });

    expect(setSchedule).not.toHaveBeenCalled();
  });

  it('reports the kinds that run on startup, for the server to run itself', async () => {
    const schedules = build();

    await schedules.add('library.scan', { kind: 'startup' });
    await schedules.add('server.cleanupSessions', { kind: 'daily', hour: 3, minute: 0 });

    expect(await schedules.sync()).toEqual(['library.scan']);
  });

  it('clears a removed trigger from the queue', async () => {
    const clearSchedule = vi.fn(() => Promise.resolve());
    const schedules = createJobScheduleService({
      store: createMemoryJobTriggerStore(),
      jobs: createInertJobQueue({
        clearSchedule,
        listSchedules: () =>
          Promise.resolve([
            { queueName: 'library.scan.scheduled', key: 'gone', cron: '0 3 * * *' },
          ]),
      }),
    });

    await schedules.add('library.scan', { kind: 'daily', hour: 3, minute: 0 });

    expect(clearSchedule).toHaveBeenCalledWith('library.scan.scheduled', 'gone');
  });

  it('leaves a schedule on a queue Flux does not own alone', async () => {
    const clearSchedule = vi.fn(() => Promise.resolve());
    const schedules = createJobScheduleService({
      store: createMemoryJobTriggerStore(),
      jobs: createInertJobQueue({
        clearSchedule,
        listSchedules: () =>
          Promise.resolve([{ queueName: 'somebody.else', key: 'theirs', cron: '0 3 * * *' }]),
      }),
    });

    await schedules.sync();

    expect(clearSchedule).not.toHaveBeenCalled();
  });

  it('reports no such kind rather than storing a trigger the picker never offered', async () => {
    const setSchedule = vi.fn(() => Promise.resolve());

    const added = await build({ setSchedule }).add('not-a-real-kind', { kind: 'startup' });

    expect(added).toBeNull();
    expect(setSchedule).not.toHaveBeenCalled();
  });

  it('reports no such trigger rather than reconciling a removal that did nothing', async () => {
    const clearSchedule = vi.fn(() => Promise.resolve());

    const removed = await build({ clearSchedule }).remove('library.scan', 'never-existed');

    expect(removed).toBe(false);
    expect(clearSchedule).not.toHaveBeenCalled();
  });

  it('removes a trigger from the listing', async () => {
    const schedules = build();
    const added = await schedules.add('library.scan', { kind: 'daily', hour: 3, minute: 0 });

    expect(await schedules.remove('library.scan', added?.id ?? '')).toBe(true);

    const entry = (await schedules.list()).find((candidate) => candidate.kind === 'library.scan');

    expect(entry?.triggers).toEqual([]);
  });
});
