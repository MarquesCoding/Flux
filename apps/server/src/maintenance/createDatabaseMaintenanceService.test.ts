import { describe, expect, it, vi } from 'vitest';
import { createInertJobQueue } from '@FluxServer/jobs/createInertJobQueue';
import { createDatabaseMaintenanceService } from './createDatabaseMaintenanceService';

describe('createDatabaseMaintenanceService', () => {
  it('queues image cache cleanup under its own kind as a singleton key', async () => {
    const enqueue = vi.fn(() => Promise.resolve('job-1'));
    const maintenance = createDatabaseMaintenanceService({
      jobs: createInertJobQueue({ enqueue }),
    });

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
    const maintenance = createDatabaseMaintenanceService({
      jobs: createInertJobQueue({ enqueue }),
    });

    await maintenance.cleanupSessions();

    expect(enqueue).toHaveBeenCalledWith('server.cleanupSessions', {}, 'server.cleanupSessions');
  });

  it('queues a catalogue connectivity check under its own kind', async () => {
    const enqueue = vi.fn(() => Promise.resolve('job-3'));
    const maintenance = createDatabaseMaintenanceService({
      jobs: createInertJobQueue({ enqueue }),
    });

    await maintenance.checkCatalogueConnectivity();

    expect(enqueue).toHaveBeenCalledWith(
      'server.checkCatalogueConnectivity',
      {},
      'server.checkCatalogueConnectivity',
    );
  });

  it('falls back to a pending id when one is already queued', async () => {
    const maintenance = createDatabaseMaintenanceService({
      jobs: createInertJobQueue({ enqueue: () => Promise.resolve(null) }),
    });

    const queued = await maintenance.cleanupSessions();

    expect(queued).toEqual({ jobId: 'pending-server.cleanupSessions', state: 'queued' });
  });
});
