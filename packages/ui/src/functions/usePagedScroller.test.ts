import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePagedScroller } from './usePagedScroller';

/**
 * jsdom lays nothing out and scrolls nothing, so a row has to be described:
 * how wide it looks, and how wide it really is.
 */
const rowOf = (visible: number, whole: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: visible,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    value: whole,
  });
};

const attached = () => {
  const { result } = renderHook(() => usePagedScroller<HTMLDivElement>());
  const track = document.createElement('div');

  document.body.append(track);
  result.current.trackRef.current = track;

  return { result, track };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('usePagedScroller', () => {
  it('reads one page from a row that does not run off the edge', () => {
    rowOf(1000, 1000);

    const { result } = attached();

    act(() => {
      result.current.measure();
    });

    expect(result.current.pages.count).toBe(1);
  });

  it('counts the screenfuls a longer row runs to', () => {
    rowOf(1000, 2700);

    const { result } = attached();

    act(() => {
      result.current.measure();
    });

    expect(result.current.pages.count).toBeGreaterThan(1);
  });

  it('scrolls smoothly, since a page turn is the row moving', () => {
    rowOf(1000, 2700);

    const { result, track } = attached();
    const scrollTo = vi.fn();

    track.scrollTo = scrollTo;

    act(() => {
      result.current.scrollTo(1);
    });

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('leaves a little of the next page showing, so the row reads as continuing', () => {
    rowOf(1000, 2700);

    const { result, track } = attached();
    const scrollTo = vi.fn();

    track.scrollTo = scrollTo;

    act(() => {
      result.current.scrollTo(1);
    });

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 850 }));
  });

  it('does nothing when there is no row yet', () => {
    const { result } = renderHook(() => usePagedScroller<HTMLDivElement>());

    expect(() => {
      result.current.measure();
      result.current.scrollTo(2);
    }).not.toThrow();
  });

  it('says which page is being looked at, read from where the row is scrolled', () => {
    rowOf(1000, 2700);

    const { result, track } = attached();

    Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 850 });

    act(() => {
      result.current.measure();
    });

    expect(result.current.pages.at).toBe(1);
  });
});
