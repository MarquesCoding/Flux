type QueuedJob = { jobId: string; state: string };

/**
 * The server-wide upkeep an admin can start on demand, as the HTTP layer
 * sees it.
 *
 * A port for the same reason `LibraryService` is one: routes are tested
 * without Postgres, and the queue underneath can change without touching
 * call sites. Every method here just queues its job and reports it — unlike
 * `LibraryService`'s `scan`/`reset`/etc, none of these can fail with "no such
 * X", since none of them target anything narrower than the whole server.
 */
type MaintenanceService = {
  /**
   * Queues removal of cached artwork and profile photo files nothing in the
   * database references any more.
   */
  cleanupImageCache: () => Promise<QueuedJob>;
  /**
   * Queues clearing out expired sign-in sessions and device-authorization
   * codes.
   */
  cleanupSessions: () => Promise<QueuedJob>;
  /**
   * Queues a check that the configured catalogue key can actually reach the
   * catalogue.
   */
  checkCatalogueConnectivity: () => Promise<QueuedJob>;
};

export type { MaintenanceService, QueuedJob };
