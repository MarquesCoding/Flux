import { describe, expect, it } from 'vitest';
import { traceJobs } from './traceJobs';
import { createLogScope } from './createLogScope';
import type { LogContext } from '@FluxContracts/schemas/Log';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

describe('traceJobs', () => {
  it('says which job a line deep inside a handler belongs to', async () => {
    const scope = createLogScope();
    let seen: Partial<LogContext> = {};

    const traced = traceJobs(
      {
        scan: async () => {
          await Promise.resolve();

          seen = scope.current();
        },
      },
      scope,
    );

    await traced.scan?.('job-1', {});

    expect(seen).toStrictEqual({ jobId: 'job-1', jobKind: 'scan' });
  });

  it('wraps every handler, not only the first', async () => {
    const scope = createLogScope();
    const seen: string[] = [];

    const traced = traceJobs(
      {
        scan: () => {
          seen.push(scope.current().jobKind ?? 'none');

          return Promise.resolve();
        },
        prune: () => {
          seen.push(scope.current().jobKind ?? 'none');

          return Promise.resolve();
        },
      },
      scope,
    );

    await traced.scan?.('job-1', {});
    await traced.prune?.('job-2', {});

    expect(seen).toStrictEqual(['scan', 'prune']);
  });

  it('passes the job and its payload through unchanged', async () => {
    const scope = createLogScope();
    let given: { jobId: string; payload: { [key: string]: JsonValue } } | null = null;

    const traced = traceJobs(
      {
        scan: (jobId, payload) => {
          given = { jobId, payload };

          return Promise.resolve();
        },
      },
      scope,
    );

    await traced.scan?.('job-1', { libraryId: 'library-1' });

    expect(given).toStrictEqual({ jobId: 'job-1', payload: { libraryId: 'library-1' } });
  });

  it('keeps the same set of kinds', () => {
    const scope = createLogScope();
    const traced = traceJobs(
      { scan: () => Promise.resolve(), prune: () => Promise.resolve() },
      scope,
    );

    expect(Object.keys(traced).sort()).toStrictEqual(['prune', 'scan']);
  });

  it('lets a failure through rather than swallowing it', async () => {
    const scope = createLogScope();
    const traced = traceJobs({ scan: () => Promise.reject(new Error('failed')) }, scope);

    await expect(traced.scan?.('job-1', {})).rejects.toThrow('failed');
  });

  it('forgets the job once it has finished', async () => {
    const scope = createLogScope();
    const traced = traceJobs({ scan: () => Promise.resolve() }, scope);

    await traced.scan?.('job-1', {});

    expect(scope.current()).toStrictEqual({});
  });
});
