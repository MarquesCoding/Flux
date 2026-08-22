import {
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
} from '@ValenceServer/jobs/JobQueue';
import type { JobQueue } from '@ValenceServer/jobs/JobQueue';
import type { MaintenanceService, QueuedJob } from './MaintenanceService';

type CreateDatabaseMaintenanceServiceOptions = {
  jobs: JobQueue;
};

/**
 * Queues a server-wide job under its own kind as a singleton, so pressing the same button twice
 * joins the run already queued rather than starting a second sweep beside it. Different kinds stay
 * independent: a cache cleanup and a session cleanup may run at once.
 *
 * @param jobs - The queue to put it on.
 * @param kind - The job being asked for.
 * @returns The job to watch.
 */
const enqueueSingleton = async (jobs: JobQueue, kind: string): Promise<QueuedJob> => {
  const jobId = await jobs.enqueue(kind, {}, kind);

  return { jobId: jobId ?? `pending-${kind}`, state: 'queued' };
};

/**
 * The housekeeping an operator can ask for: sweeping the caches, clearing out stale sessions, and
 * checking the metadata catalogue answers. Every one of them is queued rather than run here, since
 * each walks the whole library and none should hold a request open while it does.
 *
 * @param jobs - The queue the work is put on.
 * @returns The maintenance service.
 */
const createDatabaseMaintenanceService = ({
  jobs,
}: CreateDatabaseMaintenanceServiceOptions): MaintenanceService => ({
  cleanupImageCache: () => enqueueSingleton(jobs, CLEANUP_IMAGE_CACHE_JOB),
  cleanupArtefactCache: () => enqueueSingleton(jobs, CLEANUP_ARTEFACT_CACHE_JOB),
  cleanupSessions: () => enqueueSingleton(jobs, CLEANUP_SESSIONS_JOB),
  checkCatalogueConnectivity: () => enqueueSingleton(jobs, CHECK_CATALOGUE_CONNECTIVITY_JOB),
});

export { createDatabaseMaintenanceService };
