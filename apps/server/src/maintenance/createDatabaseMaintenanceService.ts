import {
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
} from '@FluxServer/jobs/JobQueue';
import type { JobQueue } from '@FluxServer/jobs/JobQueue';
import type { MaintenanceService, QueuedJob } from './MaintenanceService';

type CreateDatabaseMaintenanceServiceOptions = {
  jobs: JobQueue;
};

/**
 * Queues a server-wide job under its own kind as a singleton, so pressing the same button twice
 * joins the run already queued rather than starting a second sweep beside it. Different kinds stay
 * independent: a cache cleanup and a session cleanup may run at once.
 *
 * @param kind - The job being asked for.
 * @returns The job to watch.
 */
const enqueueSingleton = async (jobs: JobQueue, kind: string): Promise<QueuedJob> => {
  const jobId = await jobs.enqueue(kind, {}, kind);

  return { jobId: jobId ?? `pending-${kind}`, state: 'queued' };
};

const createDatabaseMaintenanceService = ({
  jobs,
}: CreateDatabaseMaintenanceServiceOptions): MaintenanceService => ({
  cleanupImageCache: () => enqueueSingleton(jobs, CLEANUP_IMAGE_CACHE_JOB),
  cleanupArtefactCache: () => enqueueSingleton(jobs, CLEANUP_ARTEFACT_CACHE_JOB),
  cleanupSessions: () => enqueueSingleton(jobs, CLEANUP_SESSIONS_JOB),
  checkCatalogueConnectivity: () => enqueueSingleton(jobs, CHECK_CATALOGUE_CONNECTIVITY_JOB),
});

export { createDatabaseMaintenanceService };
