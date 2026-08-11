import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, RefObject } from 'react';

/**
 * How much of the visible width one page is.
 *
 * Not quite the whole of it: leaving something partly visible tells a reader
 * the row carried on, where a clean page turn loses their place in it.
 */
const SCROLL_FRACTION = 0.85;

type PagedScroller<Element extends HTMLElement> = {
  trackRef: RefObject<Element | null>;
  /**
   * How many screenfuls the row is, and which one is being looked at.
   *
   * Worked out from the scroller rather than from the number of items, because
   * how many fit is a question about this window rather than about this row.
   */
  pages: { count: number; at: number };
  /**
   * Re-reads the row. Give this to the scroller's own scroll handler so the
   * markers follow a trackpad, a touch screen or a keyboard.
   */
  measure: () => void;
  scrollTo: (page: number) => void;
};

/**
 * A horizontally scrolling row that can be paged through.
 *
 * The scrolling is a real overflow rather than a transform or a swapped slice,
 * so a trackpad, a touch screen and a keyboard all work without being taught
 * to, and paging is the same row moving rather than different items appearing.
 * The markers exist for a mouse, which has none of those.
 *
 * Shared because a row of cards and a row of faces are the same problem, and
 * the second one written by hand is the one whose scrolling is not smooth.
 *
 * `watching` is what changes the row's contents, which only the caller knows:
 * the row is measured again whenever one of them moves.
 */
const usePagedScroller = <Element extends HTMLElement>(
  watching: DependencyList = [],
): PagedScroller<Element> => {
  const trackRef = useRef<Element>(null);
  const [pages, setPages] = useState({ count: 1, at: 0 });

  const measure = useCallback(() => {
    const track = trackRef.current;

    if (track === null) {
      return;
    }

    const step = Math.max(1, track.clientWidth * SCROLL_FRACTION);
    const beyond = Math.max(0, track.scrollWidth - track.clientWidth);

    setPages({
      count: Math.max(1, Math.ceil(beyond / step) + 1),
      at: Math.round(track.scrollLeft / step),
    });
  }, []);

  useEffect(() => {
    measure();

    const track = trackRef.current;

    if (track === null) {
      return;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(track);

    return () => {
      observer.disconnect();
    };
  }, [measure, ...watching]);

  const scrollTo = (page: number) => {
    const track = trackRef.current;

    if (track !== null) {
      track.scrollTo({ left: page * track.clientWidth * SCROLL_FRACTION, behavior: 'smooth' });
    }
  };

  return { trackRef, pages, measure, scrollTo };
};

export { usePagedScroller, SCROLL_FRACTION };
export type { PagedScroller };
