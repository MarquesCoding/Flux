import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fadeAudioOut, STEP_MILLISECONDS } from './fadeAudioOut';

const FADE_MILLISECONDS = 700;

const pause = vi.fn();

const aClip = ({ volume = 1, muted = false }: { volume?: number; muted?: boolean } = {}) => {
  const element = document.createElement('video');

  element.volume = volume;
  element.muted = muted;

  return element;
};

beforeEach(() => {
  vi.useFakeTimers();
  pause.mockClear();

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fadeAudioOut', () => {
  it('stops a muted clip without waiting, since there is nothing to fade', async () => {
    const element = aClip({ muted: true });

    await fadeAudioOut(element, FADE_MILLISECONDS);

    expect(pause).toHaveBeenCalledOnce();
    expect(element.volume).toBe(1);
  });

  it('stops a clip already turned all the way down without waiting', async () => {
    const element = aClip({ volume: 0 });

    await fadeAudioOut(element, FADE_MILLISECONDS);

    expect(pause).toHaveBeenCalledOnce();
  });

  it('stops at once when given no time to fade in', async () => {
    const element = aClip();

    await fadeAudioOut(element, 0);

    expect(pause).toHaveBeenCalledOnce();
    expect(element.volume).toBe(1);
  });

  it('takes an audible clip down to nothing and stops it', async () => {
    const element = aClip();
    const faded = fadeAudioOut(element, FADE_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(FADE_MILLISECONDS + STEP_MILLISECONDS);
    await faded;

    expect(element.volume).toBe(0);
    expect(pause).toHaveBeenCalledOnce();
  });

  it('is part way down part way through, rather than dropping at the end', async () => {
    const element = aClip();
    const faded = fadeAudioOut(element, FADE_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(FADE_MILLISECONDS / 2);

    expect(element.volume).toBeGreaterThan(0);
    expect(element.volume).toBeLessThan(0.6);
    expect(pause).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FADE_MILLISECONDS);
    await faded;

    expect(element.volume).toBe(0);
  });

  it('falls from wherever the clip was, not from full', async () => {
    const element = aClip({ volume: 0.5 });
    const faded = fadeAudioOut(element, FADE_MILLISECONDS);

    await vi.advanceTimersByTimeAsync(STEP_MILLISECONDS);

    expect(element.volume).toBeLessThan(0.5);

    await vi.advanceTimersByTimeAsync(FADE_MILLISECONDS);
    await faded;

    expect(element.volume).toBe(0);
  });
});
