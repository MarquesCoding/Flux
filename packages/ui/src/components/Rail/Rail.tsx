import { motion } from 'motion/react';
import { cn } from '@ValenceUI/cn';
import { groupVariants } from '@ValenceUI/animations/reveal';
import { usePagedScroller } from '@ValenceUI/usePagedScroller';
import { Button } from '@ValenceUI/Button';
import { PageDots } from '@ValenceUI/PageDots';
import type { RailProps } from './Rail.types';

/**
 * One titled row of a library, scrolling sideways rather than wrapping, which is how a shelf is
 * read: along, not down. The title can lead somewhere when there is more than the row shows, and
 * the caller can hang a control off the right of it.
 *
 * @param title - What the row holds.
 * @param children - The cards in it.
 * @param action - A control for the right of the title bar, such as a way to see everything.
 * @param onOpenTitle - Told when the title was pressed, where the row leads somewhere fuller.
 * @param className - Extra classes for the caller's own layout.
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

      <motion.ul
        ref={trackRef}
        onScroll={measure}
        variants={groupVariants}
        initial="hidden"
        animate="shown"
        className="valence-rail -my-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-1 scroll-smooth px-1 py-6"
      >
        {children}
      </motion.ul>
    </section>
  );
};

Rail.displayName = 'Rail';

export { Rail };
