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
  'group/turn absolute inset-y-0 z-10 hidden items-center justify-center hover-hover:flex',
  'bg-shade/55 text-on-scrim',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'motion-reduce:transition-none group-hover/rail:bg-shade/70',
  'pointer-events-none hover-hover:pointer-events-auto',
].join(' ');

const CHEVRON = [
  'size-14',
  'opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'motion-reduce:transition-none',
  'group-hover/rail:opacity-100 group-focus-visible/turn:opacity-100',
].join(' ');

const LEAST_REACH = 44;

const TOKENS = [
  '[--rail-gap:1rem] [--rail-peek:2rem] sm:[--rail-peek:5rem]',
  '[--rail-lane:2.5rem] sm:[--rail-lane:4.5rem]',
].join(' ');

const PER = {
  wide: '[--rail-per:2] sm:[--rail-per:3] md:[--rail-per:4] lg:[--rail-per:5] xl:[--rail-per:6]',
  portrait:
    '[--rail-per:2] sm:[--rail-per:3] md:[--rail-per:4] lg:[--rail-per:5] xl:[--rail-per:6]',
} as const;

const FITTED = [
  '[&>*]:w-[calc((100%-var(--rail-peek)-var(--rail-per)*var(--rail-gap))/var(--rail-per))]',
  '[&>*]:shrink-0 [&>*]:snap-start',
].join(' ');

const LANE = 'pl-[var(--rail-lane)] pr-0 scroll-pl-[var(--rail-lane)]';

/**
 * One titled row of a library, scrolling sideways rather than wrapping, which is how a shelf is
 * read: along, not down. The title can lead somewhere when there is more than the row shows, and
 * the caller can hang a control off the right of it.
 *
 * As many whole cards as fit, and the front of the next one past them. Nothing is ever cut down the
 * middle: a page turn moves by whole cards, so what hangs over the edge is always the next card
 * rather than the remains of one — see `usePagedScroller`.
 *
 * The arrow stands on that hanging card, and is exactly as wide as the part of it that shows. That
 * width is the point rather than a detail: it covers the only reachable part of that card, so the
 * card beneath never lights up under the pointer. A card that lifted and previewed itself under the
 * arrow would be two things answering one hover, and the arrow is the one being aimed at.
 *
 * It sits there darkened rather than appearing on hover, which is what makes the hanging card read
 * as the edge of the row rather than as a card somebody forgot to finish. Only the chevron waits to
 * be hovered.
 *
 * It takes presses from a pointer that can hover and from nothing else. A touch screen raises no
 * hover, so there the arrow is a dark edge and the row is dragged instead — a control that swallowed
 * taps there would be taking them from the card underneath.
 *
 * Which is also why the row is only dragged there. Where the arrows work the row does not scroll to
 * the hand at all, so a trackpad cannot leave it resting between pages with cards cut down the middle
 * — the arrows are the way through, and they land on whole cards every time. Where the arrows do not
 * work the drag is the only way through, and it stays.
 *
 * @param title - What the row holds.
 * @param children - The cards in it.
 * @param count - How many there are, drawn beside the title, where a row wants that said outright
 *   rather than left to be counted.
 * @param action - A control for the right of the title bar, such as a way to see everything.
 * @param onOpenTitle - Told when the title was pressed, where the row leads somewhere fuller.
 * @param hasArrows - Whether the row turns by an arrow at all. A row inside a dialog already sits in
 *   something that scrolls, and a lane held open for an arrow it never shows there reads as a stray
 *   margin rather than as a control waiting to be noticed.
 * @param className - Extra classes for the caller's own layout.
 */
const Rail = ({
  title,
  children,
  count,
  action,
  onOpenTitle,
  sizesCards = false,
  cards = 'wide',
  hasArrows = true,
  className,
}: RailProps) => {
  const { trackRef, pages, peek, behind, measure, scrollTo } = usePagedScroller<HTMLUListElement>([
    children,
  ]);

  const isFirst = pages.at <= 0;
  const isLast = pages.at >= pages.count - 1;
  const reach = Math.max(peek, LEAST_REACH);
  const reachBack = Math.max(behind, LEAST_REACH);

  return (
    <section
      className={cn(
        'group/rail flex flex-col gap-3',
        sizesCards ? cn(TOKENS, PER[cards]) : '',
        className,
      )}
      aria-label={title}
    >
      <header
        className={cn(
          'flex items-end justify-between gap-4',
          sizesCards ? cn(hasArrows ? 'pl-[var(--rail-lane)]' : '', 'pr-2') : 'px-1',
        )}
      >
        <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight text-text">
          {onOpenTitle === undefined ? (
            title
          ) : (
            <Button variant="link" size="none" onClick={onOpenTitle} className="text-left">
              {title}
            </Button>
          )}

          {count === undefined ? null : (
            <span className="text-sm font-normal tabular-nums text-text-muted/70">{count}</span>
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
          className={cn(
            'valence-rail -my-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth py-6',
            'hover-hover:overflow-x-hidden',
            sizesCards ? cn(FITTED, hasArrows ? LANE : '') : 'scroll-p-1 px-1',
          )}
        >
          {children}
        </motion.ul>

        {!hasArrows || isFirst ? null : (
          <Button
            variant="bare"
            size="none"
            label={`Back a page of ${title}`}
            hasTooltip={false}
            onClick={() => {
              scrollTo(pages.at - 1);
            }}
            style={{ width: `${reachBack.toString()}px` }}
            className={cn(TURN, 'left-0')}
          >
            <Icon of={ArrowLeft01Icon} size={56} className={CHEVRON} />
          </Button>
        )}

        {!hasArrows || isLast ? null : (
          <Button
            variant="bare"
            size="none"
            label={`Forward a page of ${title}`}
            hasTooltip={false}
            onClick={() => {
              scrollTo(pages.at + 1);
            }}
            style={{ width: `${reach.toString()}px` }}
            className={cn(TURN, 'right-0')}
          >
            <Icon of={ArrowRight01Icon} size={56} className={CHEVRON} />
          </Button>
        )}
      </div>
    </section>
  );
};

Rail.displayName = 'Rail';

export { Rail };
