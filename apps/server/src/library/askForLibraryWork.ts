import { jobBehindTheKey } from '@ValenceServer/library/jobBehindTheKey';
import type { JobQueue } from '@ValenceServer/jobs/JobQueue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

/**
 * Asks for a piece of work on a library, unless it is already being done.
 *
 * The queue will not hold two of a kind waiting for one library, but it stops caring the moment one
 * of them starts — so anything asking while a job is under way is given a job of its own. That is
 * every night on a real server: a scan runs at three and asks for the clips and the sheets when it
 * has finished reading, and the clips and the sheets have schedules of their own half an hour and an
 * hour later. Where a library takes longer to draw than a day, each night leaves another pair behind
 * it.
 *
 * They do no damage — the work lock keeps them from overlapping and the media service claims each
 * film so nothing is drawn twice — but they make a queue look frantic when it is idle, and there is
 * nothing for a second one to do: a render asks again for what is outstanding until nothing is, so
 * whatever arrives while one runs is already its to pick up.
 *
 * Reading asked for on a schedule is the case that matters most, because a schedule does not look
 * before it asks. A library scanned every quarter of an hour asks ninety-six times a day, and a
 * reading that takes longer than the gap would otherwise leave one behind every time.
 *
 * @param jobs - The queue to ask.
 * @param kind - The work being asked for.
 * @param libraryId - The library to do it to.
 * @param payload - What the job needs to know.
 * @returns The job that will do it, which may be one that was already doing it.
 */
const askForLibraryWork = async (
  jobs: Pick<JobQueue, 'enqueue' | 'liveJob'>,
  kind: string,
  libraryId: string,
  payload: { [key: string]: JsonValue },
): Promise<{ jobId: string; state: string } | null> => {
  const going = await jobs.liveJob(kind, libraryId);

  if (going !== null) {
    return { jobId: going, state: 'running' };
  }

  return jobBehindTheKey(await jobs.enqueue(kind, payload, libraryId), kind, libraryId, jobs);
};

export { askForLibraryWork };
