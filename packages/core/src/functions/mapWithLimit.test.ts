import { describe, expect, it } from 'vitest';
import { mapWithLimit } from './mapWithLimit';

/**
 * A promise somebody else decides when to finish.
 */
const held = () => {
  let release: () => void = () => {
    return;
  };

  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release: () => release() };
};

describe('mapWithLimit', () => {
  it('answers for every item', async () => {
    const doubled = await mapWithLimit([1, 2, 3], 2, (item) => Promise.resolve(item * 2));

    expect(doubled).toEqual([2, 4, 6]);
  });

  it('keeps the answers in the order they were asked, not the order they finished', async () => {
    const answers = await mapWithLimit([30, 10, 20], 3, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item));

      return item;
    });

    expect(answers).toEqual([30, 10, 20]);
  });

  it('runs no more than the limit at once', async () => {
    let running = 0;
    let most = 0;

    await mapWithLimit(
      Array.from({ length: 10 }, (_, at) => at),
      3,
      async () => {
        running += 1;
        most = Math.max(most, running);

        await new Promise((resolve) => setTimeout(resolve, 1));

        running -= 1;
      },
    );

    expect(most).toBe(3);
  });

  it('starts the next one as soon as a slot frees, rather than in batches', async () => {
    const first = held();
    const started: number[] = [];

    const all = mapWithLimit([0, 1, 2], 1, async (item) => {
      started.push(item);

      if (item === 0) {
        await first.promise;
      }
    });

    expect(started).toEqual([0]);

    first.release();
    await all;

    expect(started).toEqual([0, 1, 2]);
  });

  it('does nothing at all with nothing to do', async () => {
    await expect(mapWithLimit([], 4, () => Promise.reject(new Error('never')))).resolves.toEqual(
      [],
    );
  });

  it('treats a limit of nought as one, since nought would never finish', async () => {
    const answers = await mapWithLimit([1, 2], 0, (item) => Promise.resolve(item));

    expect(answers).toEqual([1, 2]);
  });

  it('never runs more workers than there are items', async () => {
    let most = 0;
    let running = 0;

    await mapWithLimit([1, 2], 16, async () => {
      running += 1;
      most = Math.max(most, running);

      await new Promise((resolve) => setTimeout(resolve, 1));

      running -= 1;
    });

    expect(most).toBeLessThanOrEqual(2);
  });

  it('lets a failure through rather than swallowing it', async () => {
    await expect(
      mapWithLimit([1, 2], 2, (item) =>
        item === 2 ? Promise.reject(new Error('no')) : Promise.resolve(item),
      ),
    ).rejects.toThrow('no');
  });

  it('skips a hole in a sparse list rather than working on nothing', async () => {
    const sparse: number[] = [];

    sparse[0] = 1;
    sparse[2] = 3;
    const seen: number[] = [];

    const answers = await mapWithLimit(sparse, 2, (item) => {
      seen.push(item);

      return Promise.resolve(item * 2);
    });

    expect(seen).toEqual([1, 3]);
    expect(answers[0]).toBe(2);
    expect(answers[2]).toBe(6);
  });
});
