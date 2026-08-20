import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rampVolume, STEP_MILLISECONDS } from './rampVolume';

const OVER_MILLISECONDS = 700;

const aClip = (volume: number): HTMLVideoElement => {
  const element = document.createElement('video');

  element.volume = volume;

  return element;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rampVolume', () => {
  it('arrives at once where it is already there', async () => {
    const element = aClip(1);

    await rampVolume(element, 1, OVER_MILLISECONDS);

    expect(element.volume).toBe(1);
  });

  it('jumps straight there when given no time', async () => {
    const element = aClip(0);

    await rampVolume(element, 1, 0);

    expect(element.volume).toBe(1);
  });

  it('climbs to where it was asked for', async () => {
    const element = aClip(0);
    const climbing = rampVolume(element, 1, OVER_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(OVER_MILLISECONDS + STEP_MILLISECONDS);
    await climbing;

    expect(element.volume).toBe(1);
  });

  it('is part way up part way through rather than arriving at the end', async () => {
    const element = aClip(0);
    const climbing = rampVolume(element, 1, OVER_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(OVER_MILLISECONDS / 2);

    expect(element.volume).toBeGreaterThan(0);
    expect(element.volume).toBeLessThan(1);

    await vi.advanceTimersByTimeAsync(OVER_MILLISECONDS);
    await climbing;
  });

  it('falls as readily as it climbs', async () => {
    const element = aClip(1);
    const falling = rampVolume(element, 0, OVER_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(OVER_MILLISECONDS + STEP_MILLISECONDS);
    await falling;

    expect(element.volume).toBe(0);
  });

  it('starts from wherever the clip already was', async () => {
    const element = aClip(0.5);
    const climbing = rampVolume(element, 1, OVER_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(STEP_MILLISECONDS);

    expect(element.volume).toBeGreaterThan(0.5);

    await vi.advanceTimersByTimeAsync(OVER_MILLISECONDS);
    await climbing;
  });
});
