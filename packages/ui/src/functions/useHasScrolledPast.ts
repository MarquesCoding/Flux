import { useEffect, useState } from 'react';

/**
 * The thing actually doing the scrolling above an element, which is what its position has to be
 * judged against.
 *
 * @param from - The element to look upwards from.
 * @returns The scrolling ancestor, or the document where nothing nearer scrolls.
 */
const scrollerAbove = (from: HTMLElement): HTMLElement => {
  let above = from.parentElement;

  while (above !== null) {
    const { overflowY } = getComputedStyle(above);

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return above;
    }

    above = above.parentElement;
  }

  return document.documentElement;
};

/**
 * Whether something has been scrolled up out of sight, for anything that should appear only once it
 * has — a condensed bar standing in for a heading that has gone.
 *
 * Measured against the thing scrolling rather than against the window. Inside a dialog those are
 * not the same: content scrolls away under the dialog's own edge while staying comfortably within
 * the window, so a check against the window says nothing has moved and the bar never arrives.
 *
 * Hands back something to attach rather than taking a ref, because a dialog's contents are not
 * there until it opens. A ref object is the same object before and after that, so an effect
 * watching one runs once against nothing and never runs again; this is told the moment the element
 * appears, and told again when it goes.
 *
 * @returns What to attach to a sentinel at the foot of the heading, and whether it has gone.
 */
const useHasScrolledPast = (): {
  mark: (node: HTMLElement | null) => void;
  hasPassed: boolean;
} => {
  const [watched, setWatched] = useState<HTMLElement | null>(null);
  const [hasPassed, setHasPassed] = useState(false);

  useEffect(() => {
    if (watched === null) {
      setHasPassed(false);

      return;
    }

    const scroller = scrollerAbove(watched);

    let asked = 0;

    const read = () => {
      asked = 0;
      setHasPassed(watched.getBoundingClientRect().top < scroller.getBoundingClientRect().top);
    };

    const ask = () => {
      if (asked === 0) {
        asked = requestAnimationFrame(read);
      }
    };

    read();
    scroller.addEventListener('scroll', ask, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', ask);

      if (asked !== 0) {
        cancelAnimationFrame(asked);
      }
    };
  }, [watched]);

  return { mark: setWatched, hasPassed };
};

export { useHasScrolledPast };
