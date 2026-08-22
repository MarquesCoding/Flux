import type { JobHandler } from '@ValenceServer/jobs/createJobQueue';
import type { LogScope } from './createLogScope';

/**
 * Wraps every job handler so that whatever it logs says which job it was.
 *
 * Done to the whole set at once rather than to each handler, because there are twenty of them and a
 * handler added later would otherwise write lines that belong to no job — which is the state the
 * logs were in before any of this.
 *
 * @param handlers - The handlers as written.
 * @param scope - What carries the context while a job runs.
 * @returns The same handlers, each running inside its own context.
 */
const traceJobs = (
  handlers: Record<string, JobHandler>,
  scope: LogScope,
): Record<string, JobHandler> =>
  Object.fromEntries(
    Object.entries(handlers).map(([kind, run]) => [
      kind,
      (jobId, payload) => scope.during({ jobId, jobKind: kind }, () => run(jobId, payload)),
    ]),
  );

export { traceJobs };
