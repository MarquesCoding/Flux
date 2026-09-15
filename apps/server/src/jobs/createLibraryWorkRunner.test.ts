import { describe, expect, it, vi } from 'vitest';
import { ASK_AGAIN_IN_SECONDS, createLibraryWorkRunner } from './createLibraryWorkRunner';
import { createWorkLock } from './createWorkLock';
import { DETECT_SEGMENTS_JOB, SCAN_LIBRARY_JOB } from './JobQueue';
import type { DatabaseWorkLock } from './createDatabaseWorkLock';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

const alwaysFree: DatabaseWorkLock = {
  attempt: async (_key, work) => ({ held: true, result: await work() }),
};

const alwaysTaken: DatabaseWorkLock = {
  attempt: () => Promise.resolve({ held: false }),
};

type PutBack = {
  kind: string;
  payload: { [key: string]: JsonValue };
  seconds: number;
  key: string | undefined;
};

const createRunner = (acrossProcesses: DatabaseWorkLock) => {
  const putBack: PutBack[] = [];
  const onDeferred = vi.fn();

  return {
    putBack,
    onDeferred,
    run: createLibraryWorkRunner({
      inProcess: createWorkLock(),
      acrossProcesses,
      jobs: {
        enqueueAfter: (kind, payload, seconds, key) => {
          putBack.push({ kind, payload, seconds, key });

          return Promise.resolve('put-back');
        },
      },
      onDeferred,
    }),
  };
};

describe('running a piece of work against one library', () => {
  it('does the work, where no other process has the library', async () => {
    const runner = createRunner(alwaysFree);
    const work = vi.fn(() => Promise.resolve());

    await runner.run(SCAN_LIBRARY_JOB, 'one', { libraryId: 'one' }, work);

    expect(work).toHaveBeenCalledOnce();
    expect(runner.putBack).toHaveLength(0);
    expect(runner.onDeferred).not.toHaveBeenCalled();
  });

  it('takes the library under the key the work shares with the rest of its kind', async () => {
    const keys: string[] = [];
    const runner = createRunner({
      attempt: async (key, work) => {
        keys.push(key);

        return { held: true, result: await work() };
      },
    });

    await runner.run(SCAN_LIBRARY_JOB, 'one', {}, () => Promise.resolve());
    await runner.run(DETECT_SEGMENTS_JOB, 'one', {}, () => Promise.resolve());

    expect(keys).toEqual(['reading:one', `${DETECT_SEGMENTS_JOB}:one`]);
  });

  it('does not do the work where another process is already doing it', async () => {
    const runner = createRunner(alwaysTaken);
    const work = vi.fn(() => Promise.resolve());

    await runner.run(SCAN_LIBRARY_JOB, 'one', { libraryId: 'one' }, work);

    expect(work).not.toHaveBeenCalled();
  });

  it('puts the job back with a delay rather than dropping it', async () => {
    const runner = createRunner(alwaysTaken);

    await runner.run(SCAN_LIBRARY_JOB, 'one', { libraryId: 'one', force: true }, () =>
      Promise.resolve(),
    );

    expect(runner.putBack).toEqual([
      {
        kind: SCAN_LIBRARY_JOB,
        payload: { libraryId: 'one', force: true },
        seconds: ASK_AGAIN_IN_SECONDS,
        key: 'one',
      },
    ]);
  });

  it('puts it back under the library, so a second deferral leaves one job and not two', async () => {
    const runner = createRunner(alwaysTaken);

    await runner.run(SCAN_LIBRARY_JOB, 'one', {}, () => Promise.resolve());
    await runner.run(SCAN_LIBRARY_JOB, 'one', {}, () => Promise.resolve());

    expect(runner.putBack).toHaveLength(2);
    expect(runner.putBack.every((asking) => asking.key === 'one')).toBe(true);
  });

  it('says which library went back, so an operator can see it happen', async () => {
    const runner = createRunner(alwaysTaken);

    await runner.run(DETECT_SEGMENTS_JOB, 'one', {}, () => Promise.resolve());

    expect(runner.onDeferred).toHaveBeenCalledWith(DETECT_SEGMENTS_JOB, 'one');
  });

  it('lets the work fail as its own job rather than swallowing it', async () => {
    const runner = createRunner(alwaysFree);

    await expect(
      runner.run(SCAN_LIBRARY_JOB, 'one', {}, () => Promise.reject(new Error('the scan broke'))),
    ).rejects.toThrow('the scan broke');

    expect(runner.putBack).toHaveLength(0);
  });

  it('runs two jobs of one kind on one library one after the other, not together', async () => {
    const runner = createRunner(alwaysFree);
    const order: string[] = [];

    let letTheFirstFinish = (): void => {};

    const first = runner.run(
      SCAN_LIBRARY_JOB,
      'one',
      {},
      () =>
        new Promise<void>((resolve) => {
          order.push('first started');

          letTheFirstFinish = () => {
            order.push('first finished');
            resolve();
          };
        }),
    );

    const second = runner.run(SCAN_LIBRARY_JOB, 'one', {}, () => {
      order.push('second started');

      return Promise.resolve();
    });

    letTheFirstFinish();

    await Promise.all([first, second]);

    expect(order).toEqual(['first started', 'first finished', 'second started']);
  });
});
