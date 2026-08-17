import { describe, expect, it } from 'vitest';
import { createLogScope } from './createLogScope';

const pause = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('createLogScope', () => {
  it('knows nothing outside any work', () => {
    expect(createLogScope().current()).toStrictEqual({});
  });

  it('carries what the work is about while it runs', async () => {
    const scope = createLogScope();

    await scope.during({ jobId: 'job-1' }, () => {
      expect(scope.current().jobId).toBe('job-1');

      return Promise.resolve();
    });
  });

  it('carries it across an await, which is where a scan spends its life', async () => {
    const scope = createLogScope();

    await scope.during({ jobId: 'job-1' }, async () => {
      await pause();

      expect(scope.current().jobId).toBe('job-1');
    });
  });

  it('carries it into work called from inside, however deep', async () => {
    const scope = createLogScope();
    const deep = async () => {
      await pause();

      return scope.current().jobId;
    };

    const found = await scope.during({ jobId: 'job-1' }, () => deep());

    expect(found).toBe('job-1');
  });

  it('forgets once the work is done', async () => {
    const scope = createLogScope();

    await scope.during({ jobId: 'job-1' }, () => Promise.resolve());

    expect(scope.current()).toStrictEqual({});
  });

  it('does not let two jobs at once claim each other s lines', async () => {
    const scope = createLogScope();

    const [first, second] = await Promise.all([
      scope.during({ jobId: 'job-1' }, async () => {
        await pause();

        return scope.current().jobId;
      }),
      scope.during({ jobId: 'job-2' }, async () => {
        await pause();

        return scope.current().jobId;
      }),
    ]);

    expect(first).toBe('job-1');
    expect(second).toBe('job-2');
  });

  it('adds to what an outer piece of work already said', async () => {
    const scope = createLogScope();

    const found = await scope.during({ jobId: 'job-1', jobKind: 'scan' }, () =>
      scope.during({ libraryId: 'library-1' }, () => Promise.resolve(scope.current())),
    );

    expect(found).toStrictEqual({ jobId: 'job-1', jobKind: 'scan', libraryId: 'library-1' });
  });

  it('gives back what the work answered', async () => {
    const scope = createLogScope();

    expect(await createLogScope().during({ jobId: 'a' }, () => Promise.resolve(42))).toBe(42);
    expect(scope.current()).toStrictEqual({});
  });

  it('forgets even when the work threw', async () => {
    const scope = createLogScope();

    await expect(
      scope.during({ jobId: 'job-1' }, () => Promise.reject(new Error('failed'))),
    ).rejects.toThrow('failed');

    expect(scope.current()).toStrictEqual({});
  });
});
