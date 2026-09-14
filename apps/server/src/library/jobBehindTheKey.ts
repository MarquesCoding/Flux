import type { JobQueue } from '@ValenceServer/jobs/JobQueue';

/**
 * Answers with the job that will do this work, whether this call is what started it.
 *
 * A queue holds one job of a kind for a library at a time, so asking twice gets nothing back the
 * second time. The answer used to be an invented id — `pending-<library>` — which was worse than
 * no answer: nothing has that id, so reading its state says "unknown", the client treats unknown
 * as finished and stops watching, and the work carries on untracked. Cancelling it answered 404
 * while it ran.
 *
 * So the job already holding the key is found and returned instead. The caller asked who is doing
 * this, and there is always a real answer.
 *
 * @param started - The id this call created, or null where something already held the key.
 * @param kind - The kind of job asked for.
 * @param libraryId - The library it is for.
 * @param jobs - The queue to ask.
 * @returns The job that will do the work, or null where it could not be found at all.
 */
const jobBehindTheKey = async (
  started: string | null,
  kind: string,
  libraryId: string,
  jobs: Pick<JobQueue, 'liveJob'>,
): Promise<{ jobId: string; state: string } | null> => {
  if (started !== null) {
    return { jobId: started, state: 'queued' };
  }

  const running = await jobs.liveJob(kind, libraryId);

  return running === null ? null : { jobId: running, state: 'running' };
};

export { jobBehindTheKey };
