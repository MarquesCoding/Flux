import { describe, expect, it } from 'vitest';
import { createRealtimeClock } from './createRealtimeClock';

const settle = (afterMs: number) => new Promise((resolve) => setTimeout(resolve, afterMs));

describe('createRealtimeClock', () => {
  it('runs the work once the wait has passed', async () => {
    let ran = 0;

    createRealtimeClock()(() => {
      ran += 1;
    }, 1);

    await settle(10);

    expect(ran).toBe(1);
  });

  it('does not run work that was cancelled first', async () => {
    let ran = 0;

    const cancel = createRealtimeClock()(() => {
      ran += 1;
    }, 1);

    cancel();
    await settle(10);

    expect(ran).toBe(0);
  });
});
