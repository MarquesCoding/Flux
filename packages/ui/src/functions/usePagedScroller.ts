import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, RefObject } from 'react';

const SCROLL_FRACTION = 0.85;

type PagedScroller<Element extends HTMLElement> = {
  trackRef: RefObject<Element | null>;
  pages: { count: number; at: number };
  measure: () => void;
  scrollTo: (page: number) => void;
};

/**
 * Turns a horizontally scrolling row into one that can be paged through, measuring how many pages
 * its contents come to and which is showing. Measured from the element rather than calculated from
 * the item count, since what fits depends on the window rather than on the data.
 *
 * @param dependencies - What the contents depend on, so the measurement is taken again when they
 *   change.
 * @returns A ref for the track, the pages found, a way to measure again, and a way to scroll to one.
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

export { usePagedScroller };
