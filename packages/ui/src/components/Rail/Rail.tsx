import { motion } from 'motion/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@ValenceUI/cn';
import { groupVariants } from '@ValenceUI/animations/reveal';
import { usePagedScroller } from '@ValenceUI/usePagedScroller';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { PageDots } from '@ValenceUI/PageDots';
import type { RailProps } from './Rail.types';

const TURN = [
  'absolute inset-y-6 z-10 flex w-12 items-center justify-center',
  'bg-shade/55 text-on-scrim backdrop-blur-sm',
  'pointer-events-none opacity-0',
  'transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'motion-reduce:transition-none',
  'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100',
  'focus-visible:pointer-events-auto focus-visible:opacity-100',
].join(' ');

const TURN_BACK = `${TURN} left-0 rounded-r-lg`;

const TURN_ON = `${TURN} right-0 rounded-l-lg`;

/**
 * One titled row of a library, scrolling sideways rather than wrapping, which is how a shelf is
 * read: along, not down. The title can lead somewhere when there is more than the row shows, and
 * the caller can hang a control off the right of it.
 *
 * A page turn leaves part of a card showing rather than landing flush on one, which is what tells
 * somebody the row goes on — see `usePagedScroller`. The arrows sit over that part-card at either
 * end, so the thing that says there is more is also the thing that fetches it.
 *
 * They are drawn only for a pointer that can hover, and take no presses while they are hidden: a
 * touch never raises a hover, so an arrow that stayed in the way would be an invisible control
 * swallowing taps meant for the card beneath it. The row is still scrolled by dragging it there, and
 * the markers above it still work everywhere.
 *
 * @param title - What the row holds.
 * @param children - The cards in it.
 * @param action - A control for the right of the title bar, such as a way to see everything.
 * @param onOpenTitle - Told when the title was pressed, where the row leads somewhere fuller.
 * @param className - Extra classes for the caller's own layout.
 */
const Rail = ({ title, children, action, onOpenTitle, className }: RailProps) => {
  const { trackRef, pages, measure, scrollTo } = usePagedScroller<HTMLUListElement>([children]);

  const isFirst = pages.at <= 0;
  const isLast = pages.at >= pages.count - 1;

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
          className="valence-rail -my-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-1 scroll-smooth px-1 py-6"
        >
          {children}
        </motion.ul>

        {isFirst ? null : (
          <Button
            variant="bare"
            size="none"
            label={`Back a page of ${title}`}
            onClick={() => {
              scrollTo(pages.at - 1);
            }}
            className={TURN_BACK}
          >
            <Icon of={ArrowLeft01Icon} size={28} />
          </Button>
        )}

        {isLast ? null : (
          <Button
            variant="bare"
            size="none"
            label={`Forward a page of ${title}`}
            onClick={() => {
              scrollTo(pages.at + 1);
            }}
            className={TURN_ON}
          >
            <Icon of={ArrowRight01Icon} size={28} />
          </Button>
        )}
      </div>
    </section>
  );
};

Rail.displayName = 'Rail';

export { Rail };
