import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@FluxUI/cn';
import { PageDots } from '@FluxUI/PageDots';
import type { RailProps } from './Rail.types';

/**
 * How much of the visible width one page is.
 *
 * Not quite the whole of it: leaving a card partly visible tells a viewer the
 * row carried on, where a clean page turn loses their place in it.
 */
const SCROLL_FRACTION = 0.85;

/**
 * A horizontally scrolling row of items.
 *
 * Rows rather than a grid because a library is browsed by mood, not by index:
 * a viewer skims along a theme until something catches them.
 *
 * Scrolling is a real overflow rather than a transform, so a trackpad, a touch
 * screen and a keyboard all work without being taught to. The markers exist
 * for a mouse, which has none of those, and they are told where they are by
 * whatever else did the scrolling.
 *
 * The track's `-my-6 py-6` is load-bearing: a browser will not give one axis a
 * scrollbar and leave the other free, so scrolling sideways clips the top of a
 * card that lifts on hover. The padding is the room it lifts into and the
 * negative margin gives that space back to the page.
 */
const Rail = ({ title, children, action, className }: RailProps) => {
  const trackRef = useRef<HTMLUListElement>(null);
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
  }, [measure, children]);

  const scrollTo = (page: number) => {
    const track = trackRef.current;

    if (track !== null) {
      track.scrollTo({ left: page * track.clientWidth * SCROLL_FRACTION, behavior: 'smooth' });
    }
  };

  return (
    <section className={cn('group/rail flex flex-col gap-3', className)} aria-label={title}>
      <header className="flex items-end justify-between gap-4 px-1">
        <h2 className="text-lg font-semibold tracking-tight text-text">{title}</h2>

        <div className="flex items-center gap-2">
          {action}

          <PageDots
            count={pages.count}
            selectedIndex={pages.at}
            label={`Pages of ${title}`}
            onSelect={scrollTo}
            className="hidden md:flex"
          />
        </div>
      </header>

      <div className="relative">
        <ul
          ref={trackRef}
          onScroll={measure}
          className="flux-rail -my-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-1 scroll-smooth px-1 py-6"
        >
          {children}
        </ul>
      </div>
    </section>
  );
};

Rail.displayName = 'Rail';

export { Rail };
