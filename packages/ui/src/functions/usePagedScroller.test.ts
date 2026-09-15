import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePagedScroller } from './usePagedScroller';

/**
 * jsdom lays nothing out and scrolls nothing, so a row has to be described: how wide it looks, how
 * wide it really is, and how wide one card in it is. The card matters most — without it the hook
 * cannot tell where one card ends, and falls back to moving by a share of the track.
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

const cardsOf = (track: HTMLElement, width: number, gap: number) => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: width,
  });

  track.style.columnGap = `${gap.toString()}px`;
};

const attached = (cards = 1) => {
  const { result } = renderHook(() => usePagedScroller<HTMLDivElement>());
  const track = document.createElement('div');

  for (let made = 0; made < cards; made += 1) {
    track.append(document.createElement('span'));
  }

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

  it('moves by whole cards, so the row never settles on half of one', () => {
    rowOf(1000, 2700);

    const { result, track } = attached(9);

    cardsOf(track, 300, 16);

    const scrollTo = vi.fn();

    track.scrollTo = scrollTo;

    act(() => {
      result.current.scrollTo(1);
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * 316, behavior: 'smooth' });
  });

  it('leaves the front of the next card showing, which is what says the row goes on', () => {
    rowOf(1000, 2700);

    const { result, track } = attached(9);

    cardsOf(track, 300, 16);

    act(() => {
      result.current.measure();
    });

    expect(result.current.peek).toBe(1000 - 3 * 316);
  });

  it('counts what hangs over behind as the lane less the gap before the card', () => {
    rowOf(1000, 2700);

    const { result, track } = attached(9);

    cardsOf(track, 300, 16);
    track.style.paddingLeft = '72px';

    act(() => {
      result.current.measure();
    });

    expect(result.current.behind).toBe(72 - 16);
  });

  it('shows nothing behind a row that holds no lane open, since nothing can sit in one', () => {
    rowOf(1000, 2700);

    const { result, track } = attached(9);

    cardsOf(track, 300, 16);

    act(() => {
      result.current.measure();
    });

    expect(result.current.behind).toBe(0);
  });

  it('moves by a share of the track where there are no cards to measure', () => {
    rowOf(1000, 2700);

    const { result, track } = attached(0);
    const scrollTo = vi.fn();

    track.scrollTo = scrollTo;

    act(() => {
      result.current.scrollTo(1);
    });

    expect(scrollTo).toHaveBeenCalledWith({ left: 850, behavior: 'smooth' });
  });

  it('shows nothing hanging over where it could not measure a card', () => {
    rowOf(1000, 2700);

    const { result } = attached(0);

    act(() => {
      result.current.measure();
    });

    expect(result.current.peek).toBe(0);
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

    const { result, track } = attached(9);

    cardsOf(track, 300, 16);

    Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 3 * 316 });

    act(() => {
      result.current.measure();
    });

    expect(result.current.pages.at).toBe(1);
  });
});
