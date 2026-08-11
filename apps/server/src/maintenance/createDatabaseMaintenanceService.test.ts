import { describe, expect, it, vi } from 'vitest';
import { createDatabaseMaintenanceService } from './createDatabaseMaintenanceService';
import type { JobQueue } from '@FluxServer/jobs/JobQueue';

const stubJobQueue = (enqueue: JobQueue['enqueue']): JobQueue => ({
  enqueue,
  readState: () => Promise.resolve('unknown'),
  readProgress: () => null,
  reportProgress: () => {},
  setSchedule: () => Promise.resolve(),
  clearSchedule: () => Promise.resolve(),
  listSchedules: () => Promise.resolve([]),
  stop: () => Promise.resolve(),
});

describe('createDatabaseMaintenanceService', () => {
  it('queues image cache cleanup under its own kind as a singleton key', async () => {
    const enqueue = vi.fn(() => Promise.resolve('job-1'));
    const maintenance = createDatabaseMaintenanceService({ jobs: stubJobQueue(enqueue) });

    const queued = await maintenance.cleanupImageCache();

    expect(enqueue).toHaveBeenCalledWith(
      'server.cleanupImageCache',
      {},
      'server.cleanupImageCache',
    );
    expect(queued).toEqual({ jobId: 'job-1', state: 'queued' });
  });

  it('queues session cleanup under its own kind', async () => {
    const enqueue = vi.fn(() => Promise.resolve('job-2'));
    const maintenance = createDatabaseMaintenanceService({ jobs: stubJobQueue(enqueue) });

    await maintenance.cleanupSessions();

    expect(enqueue).toHaveBeenCalledWith('server.cleanupSessions', {}, 'server.cleanupSessions');
  });

  it('queues a catalogue connectivity check under its own kind', async () => {
    const enqueue = vi.fn(() => Promise.resolve('job-3'));
    const maintenance = createDatabaseMaintenanceService({ jobs: stubJobQueue(enqueue) });

    await maintenance.checkCatalogueConnectivity();

    expect(enqueue).toHaveBeenCalledWith(
      'server.checkCatalogueConnectivity',
      {},
      'server.checkCatalogueConnectivity',
    );
  });

  it('falls back to a pending id when one is already queued', async () => {
    const maintenance = createDatabaseMaintenanceService({
      jobs: stubJobQueue(() => Promise.resolve(null)),
    });

    const queued = await maintenance.cleanupSessions();

    expect(queued).toEqual({ jobId: 'pending-server.cleanupSessions', state: 'queued' });
  });
});
