import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSlidingHighlight } from './useSlidingHighlight';

/**
 * A container holding two items, measured as though it had been laid out.
 *
 * jsdom gives every element a zero-sized rectangle, so the measurements are
 * planted. What is being tested is which element gets measured and when, not
 * the arithmetic of a layout engine.
 */
const layOut = () => {
  const container = document.createElement('div');
  const first = document.createElement('button');
  const second = document.createElement('button');

  first.setAttribute('data-highlight', 'first');
  second.setAttribute('data-highlight', 'second');
  container.append(first, second);
  document.body.append(container);

  container.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
  first.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40);
  second.getBoundingClientRect = () => new DOMRect(100, 0, 100, 40);

  return { container, first, second };
};

describe('useSlidingHighlight', () => {
  it('sits nowhere until a pointer arrives', () => {
    const { result } = renderHook(() => useSlidingHighlight());

    expect(result.current.rect).toBeNull();
  });

  it('measures the item under the pointer, against its container', () => {
    const { container, second } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.follow({ target: second });
    });

    expect(result.current.rect).toEqual({ left: 100, top: 0, width: 100, height: 40 });
  });

  it('finds the item from something inside it, since a pointer lands on the label', () => {
    const { container, first } = layOut();
    const label = document.createElement('span');

    first.append(label);

    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.follow({ target: label });
    });

    expect(result.current.rect).toEqual({ left: 0, top: 0, width: 100, height: 40 });
  });

  it('stays where it was when the pointer is over nothing worth highlighting', () => {
    const { container, first } = layOut();
    const gap = document.createElement('span');

    container.append(gap);

    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.follow({ target: first });
      result.current.follow({ target: gap });
    });

    expect(result.current.rect).not.toBeNull();
  });

  it('moves to a named item, so a keyboard drags the same highlight a mouse does', () => {
    const { container } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.moveTo('second');
    });

    expect(result.current.rect).toEqual({ left: 100, top: 0, width: 100, height: 40 });
  });

  it('leaves when the pointer does', () => {
    const { container, first } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.follow({ target: first });
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.rect).toBeNull();
  });

  it('ignores an item belonging to some other group', () => {
    const { container } = layOut();
    const stranger = document.createElement('button');

    stranger.setAttribute('data-highlight', 'elsewhere');
    document.body.append(stranger);

    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.follow({ target: stranger });
    });

    expect(result.current.rect).toBeNull();
  });

  it('does nothing before the container it measures against exists', () => {
    const { first } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.follow({ target: first });
    });

    expect(result.current.rect).toBeNull();
  });
});

describe('the moments there is nothing to measure', () => {
  it('stays put when asked to move to a name nothing carries', () => {
    const { container } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.moveTo('first');
    });

    const held = result.current.rect;

    act(() => {
      result.current.moveTo('nothing-here');
    });

    expect(result.current.rect).toBe(held);
  });

  it('stays put when asked to move before there is anything to move within', () => {
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.moveTo('first');
    });

    expect(result.current.rect).toBeNull();
  });

  it('holds the same measurement rather than a new one that says the same thing', () => {
    const { container } = layOut();
    const { result } = renderHook(() => useSlidingHighlight());

    act(() => {
      result.current.containerRef.current = container;
      result.current.moveTo('first');
    });

    const held = result.current.rect;

    act(() => {
      result.current.moveTo('first');
    });

    expect(result.current.rect).toBe(held);
  });
});
