import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDotFilm } from './useDotFilm';

const SECONDS = 12;

vi.mock('@ValenceUI/badAppleFilm', () => ({
  loadBadAppleFilm: async () =>
    Promise.resolve({
      seconds: SECONDS,
      lift: (lifts: Float32Array) => {
        lifts.fill(1);
      },
    }),
}));
import type { DotFieldFrame } from '@ValenceUI/DotField.types';

/**
 * Lets the fetch of the film settle. It is a promise rather than a wait, so this runs it out by
 * hand rather than by the clock — which keeps the test that stops the clock honest.
 *
 * @param read - What the hook is answering with.
 */
const fetched = async (read: () => DotFieldFrame | null) => {
  for (let tick = 0; tick < 20 && read() === null; tick += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

/**
 * Renders it playing, with the film fetched and ready to draw.
 *
 * @param onEnd - Told when it stops.
 * @returns What the hook answered.
 */
const playing = async (onEnd: () => void) => {
  const view = renderHook(({ isPlaying }: { isPlaying: boolean }) => useDotFilm(isPlaying, onEnd), {
    initialProps: { isPlaying: true },
  });

  await fetched(() => view.result.current);

  expect(view.result.current).toBeTypeOf('function');

  return view;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('useDotFilm', () => {
  it('has nothing to draw until somebody has found it', async () => {
    const view = renderHook(() => useDotFilm(false, vi.fn()));

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.result.current).toBeNull();
  });

  it('hands back a frame source once the film has been fetched', async () => {
    const view = await playing(vi.fn());
    const lifts = new Float32Array(40 * 30);

    view.result.current?.(lifts, 40, 30, 10);

    expect(lifts.some((lift) => lift > 0)).toBe(true);
  });

  it('ends on Escape', async () => {
    const onEnd = vi.fn();

    await playing(onEnd);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onEnd).toHaveBeenCalled();
  });

  it('sits through any other key, so a stray press does not cut the film short', async () => {
    const onEnd = vi.fn();

    await playing(onEnd);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('sits through a tap, which is what the way out on screen is for', async () => {
    const onEnd = vi.fn();

    await playing(onEnd);
    window.dispatchEvent(new Event('pointerdown'));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ends itself when the film runs out', async () => {
    const onEnd = vi.fn();

    vi.useFakeTimers();
    await playing(onEnd);

    expect(onEnd).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime((SECONDS + 1) * 1000);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('gives the dots nothing to draw once it has stopped', async () => {
    const view = await playing(vi.fn());

    view.rerender({ isPlaying: false });

    expect(view.result.current).toBeNull();
  });

  it('stops listening once it has stopped', async () => {
    const onEnd = vi.fn();
    const view = await playing(onEnd);

    view.rerender({ isPlaying: false });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('tells whoever asked for it about the end it was last given', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook(({ onEnd }: { onEnd: () => void }) => useDotFilm(true, onEnd), {
      initialProps: { onEnd: first },
    });

    await fetched(() => view.result.current);
    view.rerender({ onEnd: second });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
