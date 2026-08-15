import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

type Aimed = { target: EventTarget | null };

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SlidingHighlight = {
  containerRef: RefObject<HTMLDivElement | null>;
  rect: HighlightRect | null;
  name: string | null;
  follow: (event: Aimed) => void;
  clear: () => void;
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

export type { HighlightRect };

export { useSlidingHighlight };
