import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOOK_AGAIN_EVERY_MS,
  STOP_LOOKING_AFTER_MS,
  WHERE_ONE_USUALLY_IS,
  keepLookingForAFlux,
  lookForAFlux,
} from './lookForAFlux';

afterEach(() => {
  vi.useRealTimers();
});

describe('lookForAFlux', () => {
  it('finds the one running on this machine, so nobody is asked where it is', async () => {
    const reach = vi.fn().mockResolvedValue(true);

    expect(await lookForAFlux(reach)).toBe(WHERE_ONE_USUALLY_IS[0]);
  });

  it('tries the next address where the first says nothing', async () => {
    const reach = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    expect(await lookForAFlux(reach)).toBe(WHERE_ONE_USUALLY_IS[1]);
  });

  it('finds nothing where nothing is running, rather than guessing', async () => {
    expect(await lookForAFlux(vi.fn().mockResolvedValue(false))).toBeNull();
  });

  it('looks only at this machine, never at anybody else on the network', async () => {
    const reach = vi.fn().mockResolvedValue(false);

    await lookForAFlux(reach);

    for (const [address] of reach.mock.calls) {
      expect(address).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):/);
    }
  });
});

describe('keepLookingForAFlux', () => {
  it('answers for somebody whose server was still starting', async () => {
    vi.useFakeTimers();

    const found = vi.fn();
    const reach = vi.fn().mockResolvedValue(true);

    keepLookingForAFlux(found, reach);

    await vi.advanceTimersByTimeAsync(LOOK_AGAIN_EVERY_MS);

    expect(found).toHaveBeenCalledWith(WHERE_ONE_USUALLY_IS[0]);
  });

  it('says nothing while there is nothing to say', async () => {
    vi.useFakeTimers();

    const found = vi.fn();

    keepLookingForAFlux(found, vi.fn().mockResolvedValue(false));

    await vi.advanceTimersByTimeAsync(LOOK_AGAIN_EVERY_MS * 3);

    expect(found).not.toHaveBeenCalled();
  });

  it('gives up eventually, rather than asking a machine forever', async () => {
    vi.useFakeTimers();

    const reach = vi.fn().mockResolvedValue(false);

    keepLookingForAFlux(vi.fn(), reach);

    await vi.advanceTimersByTimeAsync(STOP_LOOKING_AFTER_MS + LOOK_AGAIN_EVERY_MS * 2);

    const asked = reach.mock.calls.length;

    await vi.advanceTimersByTimeAsync(LOOK_AGAIN_EVERY_MS * 3);

    expect(reach.mock.calls.length).toBe(asked);
  });

  it('stops when told to, so changing server does not fight the search', async () => {
    vi.useFakeTimers();

    const found = vi.fn();

    keepLookingForAFlux(found, vi.fn().mockResolvedValue(true))();

    await vi.advanceTimersByTimeAsync(LOOK_AGAIN_EVERY_MS * 2);

    expect(found).not.toHaveBeenCalled();
  });

  it('tells whoever asked only once, however long it keeps running', async () => {
    vi.useFakeTimers();

    const found = vi.fn();

    keepLookingForAFlux(found, vi.fn().mockResolvedValue(true));

    await vi.advanceTimersByTimeAsync(LOOK_AGAIN_EVERY_MS * 4);

    expect(found).toHaveBeenCalledTimes(1);
  });
});
