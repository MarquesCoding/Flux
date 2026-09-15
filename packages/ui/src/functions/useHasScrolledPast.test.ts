import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useHasScrolledPast } from './useHasScrolledPast';

/**
 * A sentinel inside something that scrolls, with both of their positions decided by the caller.
 *
 * @param markTop - Where the sentinel sits down the window.
 * @param scrollerTop - Where the scrolling box starts down the window.
 * @returns The sentinel and the box that scrolls it.
 */
const inAScroller = (markTop: number, scrollerTop: number) => {
  const scroller = document.createElement('div');

  scroller.style.overflowY = 'auto';
  scroller.getBoundingClientRect = () => new DOMRect(0, scrollerTop);

  const watched = document.createElement('span');

  watched.getBoundingClientRect = () => new DOMRect(0, markTop);

  scroller.append(watched);
  document.body.append(scroller);

  return { watched, scroller };
};

describe('useHasScrolledPast', () => {
  it('says nothing has gone before anything is attached, which is a dialog that is shut', () => {
    const { result } = renderHook(() => useHasScrolledPast());

    expect(result.current.hasPassed).toBe(false);
  });

  it('says nothing has gone while the mark is still below the top of what scrolls it', () => {
    const { watched } = inAScroller(300, 60);
    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(false);
  });

  it('says it has gone once the mark is above the top of what scrolls it', () => {
    const { watched } = inAScroller(20, 60);
    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(true);
  });

  it('judges against the scrolling box rather than the window, which a dialog sits inside of', () => {
    const { watched } = inAScroller(40, 60);
    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(true);
  });

  it('starts watching when the element arrives, rather than only when the hook first ran', () => {
    const { result } = renderHook(() => useHasScrolledPast());

    expect(result.current.hasPassed).toBe(false);

    const { watched } = inAScroller(10, 60);

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(true);
  });

  it('answers again when the box is scrolled', () => {
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
      run(0);

      return 1;
    });

    const { watched, scroller } = inAScroller(300, 60);
    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(false);

    watched.getBoundingClientRect = () => new DOMRect(0, 10);

    act(() => {
      scroller.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.hasPassed).toBe(true);

    vi.unstubAllGlobals();
  });

  it('judges against the top of the window where the page itself is what scrolls', () => {
    const watched = document.createElement('span');

    watched.getBoundingClientRect = () => new DOMRect(0, -40);
    document.body.append(watched);

    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(true);
  });

  it('says nothing has gone while the mark is still down the page', () => {
    const watched = document.createElement('span');

    watched.getBoundingClientRect = () => new DOMRect(0, 120);
    document.body.append(watched);

    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(false);
  });

  it('forgets what it knew when the element goes', () => {
    const { watched } = inAScroller(10, 60);
    const { result } = renderHook(() => useHasScrolledPast());

    act(() => {
      result.current.mark(watched);
    });

    expect(result.current.hasPassed).toBe(true);

    act(() => {
      result.current.mark(null);
    });

    expect(result.current.hasPassed).toBe(false);
  });
});
