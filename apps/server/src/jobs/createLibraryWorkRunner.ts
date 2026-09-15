import { lockFor } from '@ValenceServer/jobs/lockFor';
import type { DatabaseWorkLock } from '@ValenceServer/jobs/createDatabaseWorkLock';
import type { JobQueue } from '@ValenceServer/jobs/JobQueue';
import type { WorkLock } from '@ValenceServer/jobs/createWorkLock';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type LibraryWorkRunner = (
  kind: string,
  libraryId: string,
  payload: { [key: string]: JsonValue },
  work: () => Promise<void>,
) => Promise<void>;

type CreateLibraryWorkRunnerOptions = {
  inProcess: WorkLock;
  acrossProcesses: DatabaseWorkLock;
  jobs: Pick<JobQueue, 'enqueueAfter'>;
  onDeferred: (kind: string, libraryId: string) => void;
};

const ASK_AGAIN_IN_SECONDS = 30;

/**
 * Runs a piece of work against one library, once the library is nobody else's.
 *
 * Two locks, cheapest first. The lock in the process serialises the jobs this process is running,
 * which is the whole of it on a single server and costs nothing to ask. Inside that, the database
 * lock answers the question the first one cannot: whether some other process is working on the same
 * library, which happens for a few seconds either side of a restart.
 *
 * Where another process has it, the job is put back with a delay rather than blocked on or dropped.
 * That is the contract the lock in the process already keeps — work asked for is work that
 * eventually happens — and a scheduled run that quietly did not happen would be the worse failure.
 * It goes back under the library's key, so a library deferred twice leaves one job waiting rather
 * than two.
 *
 * @param options - The two locks, the queue to defer into, and what to say when work is deferred.
 * @returns A function that runs library work under both locks.
 */
const createLibraryWorkRunner = ({
  inProcess,
  acrossProcesses,
  jobs,
  onDeferred,
}: CreateLibraryWorkRunnerOptions): LibraryWorkRunner => {
  return async (kind, libraryId, payload, work) => {
    const key = lockFor(kind, libraryId);

    await inProcess.run(key, async () => {
      const attempted = await acrossProcesses.attempt(key, work);

      if (attempted.held) {
        return;
      }

      onDeferred(kind, libraryId);

      await jobs.enqueueAfter(kind, payload, ASK_AGAIN_IN_SECONDS, libraryId);
    });
  };
};

export type { LibraryWorkRunner };

export { ASK_AGAIN_IN_SECONDS, createLibraryWorkRunner };
