import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotField } from './DotField';

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

  it('stops drawing once it is gone', () => {
    const { unmount } = render(<DotField />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
