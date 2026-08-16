import type { MaintenanceService } from './MaintenanceService';

/**
 * Server-wide upkeep that answers as if the work were queued, without a queue behind it. For testing
 * the routes that ask for housekeeping, which care that a job was accepted and not what it does.
 */
const createMemoryMaintenanceService = (): MaintenanceService => ({
  cleanupImageCache: () => Promise.resolve({ jobId: 'job-cleanup-image-cache', state: 'queued' }),
  cleanupArtefactCache: () =>
    Promise.resolve({ jobId: 'job-cleanup-artefact-cache', state: 'queued' }),
  cleanupSessions: () => Promise.resolve({ jobId: 'job-cleanup-sessions', state: 'queued' }),
  checkCatalogueConnectivity: () =>
    Promise.resolve({ jobId: 'job-check-catalogue-connectivity', state: 'queued' }),
});

export { createMemoryMaintenanceService };
