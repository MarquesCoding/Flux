type QueuedJob = { jobId: string | null; state: string };

type MaintenanceService = {
  cleanupImageCache: () => Promise<QueuedJob>;
  cleanupArtefactCache: () => Promise<QueuedJob>;
  cleanupSessions: () => Promise<QueuedJob>;
  checkCatalogueConnectivity: () => Promise<QueuedJob>;
};

export type { MaintenanceService, QueuedJob };
