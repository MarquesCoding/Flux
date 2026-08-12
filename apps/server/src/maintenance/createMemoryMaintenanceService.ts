import type { MaintenanceService } from './MaintenanceService';

/**
 * Server-wide upkeep that answers as if queued, without a real queue.
 *
 * Lets the admin routes be tested without Postgres, the same reason
 * `createMemoryLibraryService` exists.
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
