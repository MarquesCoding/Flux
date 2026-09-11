import { motion } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { Tooltip } from '@ValenceUI/Tooltip';
import { cn } from '@ValenceUI/cn';
import type { PageDotsProps } from './PageDots.types';

const TONES = {
  page: {
    lit: 'bg-text',
    track: 'bg-text/25',
    rest: 'bg-text-muted/40 group-hover:bg-text-muted',
  },
  overlay: {
    lit: 'bg-on-scrim',
    track: 'bg-on-scrim/30',
    rest: 'bg-on-scrim/45 group-hover:bg-on-scrim/80',
  },
} as const;

/**
 * Shows which of several pages is on screen and offers a way to each of the others. Where the pages
 * advance on their own, the chosen dot fills over the time each one is shown, so the row says how
 * long is left as well as where you are.
 *
 * How far it has filled is handed in rather than timed here. Whatever advances the pages already
 * keeps that count, and a second clock beside it — a fill left to run on its own — drifts from the
 * first the moment either is paused, restarted or skipped, so the dot says one thing and the page
 * does another.
 *
 * @param count - How many pages there are.
 * @param selectedIndex - Which page is showing, counting from zero.
 * @param onSelect - Told which page was asked for.
 * @param labels - What each page is, where they have names worth reading out.
 * @param label - What the row of dots is for, as a whole.
 * @param progress - How far through its turn the page showing is, from nothing to one, where the
 *   pages advance on their own.
 * @param tone - What the dots are drawn over: the page, or a picture, where they are drawn light
 *   whatever the theme.
 * @param className - Extra classes for the caller's own layout.
 */
const PageDots = ({
  count,
  selectedIndex,
  onSelect,
  labels,
  label,
  className,
  progress,
  tone = 'page',
}: PageDotsProps) => {
  if (count <= 1) {
    return null;
  }

  const ink = TONES[tone];

  return (
    <ul aria-label={label} className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: count }, (_, index) => index).map((index) => {
        const named = labels?.[index];

        const marker = (
          <Button
            variant="bare"
            size="none"
            aria-label={`Show ${named ?? `page ${(index + 1).toString()}`}`}
            aria-current={selectedIndex === index ? 'true' : undefined}
            onClick={() => {
              onSelect(index);
            }}
            className="group relative flex items-center px-0.5 py-2"
          >
            <span
              className={cn(
                'block h-1.5 overflow-hidden rounded-full',
                'transition-[width,background-color] duration-[var(--duration-base)] ease-[var(--ease-out)]',
                'motion-reduce:transition-none',
                selectedIndex === index
                  ? cn('w-6', progress === undefined ? ink.lit : ink.track)
                  : cn('w-1.5', ink.rest),
              )}
            >
              {selectedIndex === index && progress !== undefined ? (
                <motion.span
                  data-slot="page-dots-fill"
                  style={{ scaleX: progress }}
                  className={cn('block h-full w-full origin-left rounded-full', ink.lit)}
                />
              ) : null}
            </span>
          </Button>
        );

        return (
          <li key={index}>
            {named === undefined ? marker : <Tooltip label={named}>{marker}</Tooltip>}
          </li>
        );
      })}
    </ul>
  );
};

PageDots.displayName = 'PageDots';

export { PageDots };
