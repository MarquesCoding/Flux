import { motion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import { groupVariants } from '@FluxUI/animations/reveal';
import { usePagedScroller } from '@FluxUI/usePagedScroller';
import { Button } from '@FluxUI/Button';
import { PageDots } from '@FluxUI/PageDots';
import type { RailProps } from './Rail.types';

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
 * The cards arrive in order rather than all at once, which gives the eye the
 * left-hand end to start at — a row that appears complete has no beginning.
 * They are `RevealItem`s, handed in by whoever fills the row.
 *
 * The track's `-my-6 py-6` is load-bearing: a browser will not give one axis a
 * scrollbar and leave the other free, so scrolling sideways clips the top of a
 * card that lifts on hover. The padding is the room it lifts into and the
 * negative margin gives that space back to the page.
 */
const Rail = ({ title, children, action, onOpenTitle, className }: RailProps) => {
  const { trackRef, pages, measure, scrollTo } = usePagedScroller<HTMLUListElement>([children]);

  return (
    <section className={cn('group/rail flex flex-col gap-3', className)} aria-label={title}>
      <header className="flex items-end justify-between gap-4 px-1">
        <h2 className="text-lg font-semibold tracking-tight text-text">
          {onOpenTitle === undefined ? (
            title
          ) : (
            <Button variant="link" size="none" onClick={onOpenTitle} className="text-left">
              {title}
            </Button>
          )}
        </h2>

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
        <motion.ul
          ref={trackRef}
          onScroll={measure}
          variants={groupVariants}
          initial="hidden"
          animate="shown"
          className="flux-rail -my-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-1 scroll-smooth px-1 py-6"
        >
          {children}
        </motion.ul>
      </div>
    </section>
  );
};

Rail.displayName = 'Rail';

export { Rail };
