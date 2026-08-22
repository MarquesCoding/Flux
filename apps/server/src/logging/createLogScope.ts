import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogContext } from '@ValenceContracts/schemas/Log';

type LogScope = {
  during: <Answer>(context: Partial<LogContext>, run: () => Promise<Answer>) => Promise<Answer>;
  current: () => Partial<LogContext>;
};

/**
 * Carries what a piece of work is about to every log written while it runs.
 *
 * "Show me everything that happened during last night's scan of Films" is the question an operator
 * actually has, and it is unanswerable unless each of the four thousand lines a scan produces knows
 * which scan produced it. The lines come from deep inside the scanner, the subtitle reader and the
 * artwork fetcher — places that have no reason to know a job exists, and would all need a job
 * identifier threaded through them to say so.
 *
 * Held against the async execution that is doing the work rather than in a variable, so two jobs
 * running at once do not attribute each other's lines.
 *
 * @returns The scope.
 */
const createLogScope = (): LogScope => {
  const holder = new AsyncLocalStorage<Partial<LogContext>>();

  return {
    during: (context, run) => holder.run({ ...holder.getStore(), ...context }, run),
    current: () => holder.getStore() ?? {},
  };
};

export type { LogScope };

export { createLogScope };
