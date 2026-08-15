import { motion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import { groupVariants } from '@FluxUI/animations/reveal';
import { usePagedScroller } from '@FluxUI/usePagedScroller';
import { Button } from '@FluxUI/Button';
import { PageDots } from '@FluxUI/PageDots';
import type { RailProps } from './Rail.types';

/**
 * A horizontally scrolling row of items.
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
