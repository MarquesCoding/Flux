import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The only part of an event this needs.
 *
 * Narrow on purpose: a pointer moving and a key moving focus are the same
 * question — what is under this now — and both carry a target.
 */
type Aimed = { target: EventTarget | null };

/**
 * Where the highlight should sit, measured against its container.
 */
type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SlidingHighlight = {
  containerRef: RefObject<HTMLDivElement | null>;
  /**
   * Null until a pointer rests on something worth highlighting.
   */
  rect: HighlightRect | null;
  /**
   * Which item the highlight is on, by its `data-highlight` name.
   *
   * Reported so that a group can move more than the background — a dock moves
   * the word as well, so that what is named is always what is lit.
   */
  name: string | null;
  follow: (event: Aimed) => void;
  clear: () => void;
  /**
   * Puts the highlight on a named item without a pointer.
   *
   * A keyboard moves through a menu without ever moving a pointer, and a
   * highlight that only answers to the mouse leaves that person with no idea
   * where they are.
   */
  moveTo: (name: string) => void;
};

const ITEM = '[data-highlight]';

const elementOf = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target : null;

const isSamePlace = (left: HighlightRect | null, right: HighlightRect): boolean =>
  left !== null &&
  left.left === right.left &&
  left.top === right.top &&
  left.width === right.width &&
  left.height === right.height;

/**
 * Where an item sits inside its container, in the container's own coordinates.
 *
 * A rectangle read from the document is measured against the viewport, while
 * the highlight is drawn inside the container and scrolls with its contents —
 * so however far the container has been scrolled has to be added back, or the
 * mark sits that far adrift of the row it is meant to be on.
 */
const measure = (item: Element, container: Element): HighlightRect => {
  const bounds = item.getBoundingClientRect();
  const within = container.getBoundingClientRect();

  return {
    left: bounds.left - within.left + container.scrollLeft,
    top: bounds.top - within.top + container.scrollTop,
    width: bounds.width,
    height: bounds.height,
  };
};

/**
 * One background that slides between the things a pointer rests on.
 *
 * A menu where every row paints its own hover has as many backgrounds as rows,
 * and moving between them is one appearing as another disappears. Sharing a
 * single rectangle and moving it makes the pointer feel like it is dragging
 * the highlight along, which is the whole effect.
 *
 * Items are found by a `data-highlight` attribute rather than by being passed
 * in, so this works for a row, a link, a tab or a button without any of them
 * knowing about each other, and a container can hold things that are not
 * highlighted at all.
 *
 * A measurement that has not moved is dropped rather than stored again. A
 * caller that re-measures whenever its container resizes would otherwise loop:
 * measuring sets state, state redraws, redrawing resizes, and the highlight
 * sits there flickering.
 */
const useSlidingHighlight = (): SlidingHighlight => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [name, setName] = useState<string | null>(null);

  const follow = useCallback((event: Aimed) => {
    const container = containerRef.current;
    const item = elementOf(event.target)?.closest(ITEM) ?? null;

    if (container === null || item === null || !container.contains(item)) {
      return;
    }

    const next = measure(item, container);

    setRect((held) => (isSamePlace(held, next) ? held : next));
    setName(item.getAttribute('data-highlight'));
  }, []);

  const moveTo = useCallback((name: string) => {
    const container = containerRef.current;
    const item = container?.querySelector(`[data-highlight="${name}"]`) ?? null;

    if (container === null || item === null) {
      return;
    }

    const next = measure(item, container);

    setRect((held) => (isSamePlace(held, next) ? held : next));
    setName(name);
  }, []);

  const clear = useCallback(() => {
    setRect(null);
    setName(null);
  }, []);

  return { containerRef, rect, name, follow, clear, moveTo };
};

export type { Aimed, HighlightRect, SlidingHighlight };

export { useSlidingHighlight };
