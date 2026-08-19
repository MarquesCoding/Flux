import { describe, expect, it, vi } from 'vitest';
import { wait } from './wait';

describe('wait', () => {
  it('carries on once the time has passed', async () => {
    vi.useFakeTimers();

    const waited = wait(500);
    let settled = false;

    void waited.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await waited;

    expect(settled).toBe(true);

    vi.useRealTimers();
  });

  it('waits no time at all when asked for none', async () => {
    await expect(wait(0)).resolves.toBeUndefined();
  });
});
