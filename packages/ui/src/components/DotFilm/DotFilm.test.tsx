import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { silhouetteFilm } from '@FluxUI/silhouetteFilm';
import { DotFilm } from './DotFilm';

const canvasOf = (container: HTMLElement): HTMLCanvasElement | null =>
  container.querySelector('canvas');

/**
 * Lets the fetch of the film settle. It is a promise rather than a wait, so this runs it out by
 * hand rather than by the clock — which keeps the tests that stop the clock honest.
 *
 * @param container - What was rendered, which is where the film turns up.
 */
const fetched = async (container: HTMLElement) => {
  for (let tick = 0; tick < 20 && canvasOf(container) === null; tick += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

/**
 * Renders it playing, with the film fetched and on screen.
 *
 * @param onEnd - Told when it stops.
 * @returns What was rendered.
 */
const playing = async (onEnd: () => void) => {
  const view = render(<DotFilm isPlaying onEnd={onEnd} />);

  await fetched(view.container);

  expect(canvasOf(view.container)).toBeInTheDocument();

  return view;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('DotFilm', () => {
  it('draws nothing at all until somebody has found it', () => {
    const { container } = render(<DotFilm isPlaying={false} onEnd={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('fetches the film only once it is asked for', async () => {
    const { container } = render(<DotFilm isPlaying={false} onEnd={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(canvasOf(container)).not.toBeInTheDocument();
  });

  it('covers the page and plays the film on the dots', async () => {
    const { container } = await playing(vi.fn());

    expect(container.firstElementChild?.className).toContain('fixed inset-0');
    expect(canvasOf(container)).toBeInTheDocument();
  });

  it('is decoration, so nothing reading the page aloud mentions it', async () => {
    const { container } = await playing(vi.fn());

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('ends on any key at all, not only the one somebody guesses', async () => {
    const onEnd = vi.fn();

    await playing(onEnd);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));

    expect(onEnd).toHaveBeenCalled();
  });

  it('ends on a tap, so a phone is not stuck with it', async () => {
    const onEnd = vi.fn();

    await playing(onEnd);
    window.dispatchEvent(new Event('pointerdown'));

    expect(onEnd).toHaveBeenCalled();
  });

  it('ends itself when the film runs out', async () => {
    const onEnd = vi.fn();

    vi.useFakeTimers();
    await playing(onEnd);

    expect(onEnd).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime((silhouetteFilm.seconds + 1) * 1000);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stops listening once it has stopped', async () => {
    const onEnd = vi.fn();
    const { rerender } = await playing(onEnd);

    rerender(<DotFilm isPlaying={false} onEnd={onEnd} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('tells whoever asked for it about the end it was last given', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = await playing(first);

    rerender(<DotFilm isPlaying onEnd={second} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
