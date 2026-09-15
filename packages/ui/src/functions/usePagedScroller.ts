import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, RefObject } from 'react';

const SCROLL_FRACTION = 0.85;

type PagedScroller<Element extends HTMLElement> = {
  trackRef: RefObject<Element | null>;
  pages: { count: number; at: number };
  peek: number;
  behind: number;
  measure: () => void;
  scrollTo: (page: number) => void;
};

type Measured = { step: number; peek: number; behind: number };

/**
 * How far one press moves the row, and how much of the next card is left showing.
 *
 * As many whole cards as fit, rather than a fraction of the track. A row that scrolls by a share of
 * its own width leaves a card cut down the middle wherever it stops, and the next press cuts a
 * different one; stepping by whole cards means every card the row settles on is a whole card, and
 * what hangs over the edge is always the next one rather than the middle of one.
 *
 * What hangs over is the point. The row is wider than the cards that fit it, and the remainder shows
 * the front of the next card — which is what says the row goes on without needing to be told.
 *
 * Past the first page it hangs over at both ends, because by then there is as much behind as ahead.
 * That is the row's own doing rather than this one's: a row that holds a lane open down its left side
 * has somewhere for the card behind to sit, and a page turn lands against that lane instead of
 * against the edge. A row that holds no lane open pages flush, as it always did.
 *
 * Measured from the first card rather than from a number, because a card is a share of the window on
 * a phone and a fixed width on a desktop, and only the element knows which it is at the moment.
 * Falls back to a fraction of the track where there is nothing to measure — an empty row, or one
 * whose children have not been laid out.
 *
 * What shows of the hanging card is what the eye can see of it, which is less than the room left over
 * once whole cards are counted: the row starts a little in from its own edge, and there is a gap in
 * front of the hanging card. Both sit in the remainder without being part of the card, and a measure
 * that forgot them would draw the arrow wider than the card it stands on.
 *
 * @param track - The scrolling element.
 * @returns How far one page is, how much of the hanging card shows, how many cards fit, and the gap
 *   and inset that separate them.
 */
const measureOf = (track: HTMLElement): Measured => {
  const first = track.firstElementChild;

  if (!(first instanceof HTMLElement) || first.offsetWidth === 0) {
    return { step: Math.max(1, track.clientWidth * SCROLL_FRACTION), peek: 0, behind: 0 };
  }

  const style = getComputedStyle(track);
  const gap = Number.parseFloat(style.columnGap) || 0;
  const inset = Number.parseFloat(style.paddingLeft) || 0;
  const card = first.offsetWidth + gap;
  const fit = Math.max(1, Math.floor((track.clientWidth + gap) / card));
  const step = Math.max(1, fit * card);

  return {
    step,
    peek: Math.max(0, track.clientWidth - inset - step),
    behind: Math.max(0, inset - gap),
  };
};

/**
 * Turns a horizontally scrolling row into one that can be paged through, measuring how many pages
 * its contents come to and which is showing. Measured from the element rather than calculated from
 * the item count, since what fits depends on the window rather than on the data.
 *
 * @param watching - What the contents depend on, so the measurement is taken again when they change.
 * @returns A ref for the track, the pages found, how much of the next card shows, and ways to
 *   measure and move it.
 */
const usePagedScroller = <Element extends HTMLElement>(
  watching: DependencyList = [],
): PagedScroller<Element> => {
  const trackRef = useRef<Element>(null);
  const [pages, setPages] = useState({ count: 1, at: 0 });
  const [peek, setPeek] = useState(0);
  const [behind, setBehind] = useState(0);

  const measure = useCallback(() => {
    const track = trackRef.current;

    if (track === null) {
      return;
    }

    const { step, peek: showing, behind: trailing } = measureOf(track);
    const beyond = Math.max(0, track.scrollWidth - track.clientWidth);

    const found = {
      count: Math.max(1, Math.ceil(beyond / step) + 1),
      at: Math.round(track.scrollLeft / step),
    };

    setPages((current) =>
      current.count === found.count && current.at === found.at ? current : found,
    );
    setPeek((current) => (current === showing ? current : showing));
    setBehind((current) => (current === trailing ? current : trailing));
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

    if (track === null) {
      return;
    }

    track.scrollTo({ left: Math.max(0, page * measureOf(track).step), behavior: 'smooth' });
  };

  return { trackRef, pages, peek, behind, measure, scrollTo };
};

export { usePagedScroller };
