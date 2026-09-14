import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotField } from './DotField';
import type { DotFieldFrame } from './DotField.types';
import type * as MotionReact from 'motion/react';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof MotionReact>('motion/react');

  return { ...actual, useReducedMotionConfig: () => true };
});

const context = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  scale: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
};

const observe = vi.fn();
const disconnect = vi.fn();

class FakeResizeObserver {
  observe = observe;

  disconnect = disconnect;

  unobserve = vi.fn();
}

/**
 * A canvas with a size, which jsdom lays out as nothing.
 */
const sizeCanvas = () => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
    configurable: true,
    value: 600,
  });
};

const canvasOf = (container: HTMLElement): HTMLCanvasElement | null =>
  container.querySelector('canvas');

beforeEach(() => {
  context.clearRect.mockClear();
  context.fillRect.mockClear();
  observe.mockClear();
  disconnect.mockClear();

  sizeCanvas();

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  });

  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DotField', () => {
  it('draws one element rather than ten thousand', () => {
    const { container } = render(<DotField />);

    expect(canvasOf(container)).toBeInTheDocument();
    expect(container.querySelectorAll('*')).toHaveLength(1);
  });

  it('is decoration, so nothing reading the page aloud mentions it', () => {
    const { container } = render(<DotField />);

    expect(canvasOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('never takes a press meant for what is behind it', () => {
    const { container } = render(<DotField />);

    expect(canvasOf(container)?.className).toContain('pointer-events-none');
  });

  it('draws the dots', () => {
    render(<DotField />);

    expect(context.fillRect).toHaveBeenCalled();
  });

  it('draws more of them the finer the grid is asked to be', () => {
    render(<DotField spacing={64} />);

    const coarse = context.fillRect.mock.calls.length;

    context.fillRect.mockClear();
    render(<DotField spacing={16} />);

    expect(context.fillRect.mock.calls.length).toBeGreaterThan(coarse);
  });

  it('holds still for somebody who asked for less motion, but is still a grid', () => {
    render(<DotField />);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalled();
  });

  it('lays the grid out again when the window changes shape', () => {
    render(<DotField />);

    expect(observe).toHaveBeenCalled();
  });

  it('asks a frame source how lit every dot is, rather than working it out from ripples', () => {
    const frame = vi.fn<DotFieldFrame>();

    render(<DotField frame={frame} />);

    expect(frame).toHaveBeenCalled();

    const [lifts, columns, rows] = frame.mock.calls[0] ?? [new Float32Array(0), 0, 0];

    expect(lifts).toBeInstanceOf(Float32Array);
    expect(columns * rows).toBe(lifts.length);
  });

  it('draws what the frame source said and nothing of its own', () => {
    const frame = (lifts: Float32Array) => {
      lifts.fill(0);
      lifts[0] = 1;
    };

    render(<DotField frame={frame} />);

    const drawn = context.fillRect.mock.calls;
    const biggest = Math.max(...drawn.map((call) => Number(call[2])));

    expect(drawn.length).toBeGreaterThan(1);
    expect(biggest).toBeGreaterThan(2);
  });

  it('lights the bottom of a picture as brightly as the top, unlike the ripples', () => {
    const frame = (lifts: Float32Array) => {
      lifts.fill(1);
    };

    render(<DotField frame={frame} />);

    const sizes = new Set(context.fillRect.mock.calls.map((call) => Number(call[2])));

    expect(sizes.size).toBe(1);
  });

  it('stops drawing once it is gone', () => {
    const { unmount } = render(<DotField />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
