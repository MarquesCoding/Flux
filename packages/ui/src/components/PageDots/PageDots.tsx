import { Button } from '@ValenceUI/Button';
import { Tooltip } from '@ValenceUI/Tooltip';
import { cn } from '@ValenceUI/cn';
import type { PageDotsProps } from './PageDots.types';

/**
 * Shows which of several pages is on screen and offers a way to each of the others. Where the pages
 * advance on their own, a dot can fill over the time each one is shown, so the row says how long is
 * left as well as where you are — and stops filling while something is paused.
 *
 * @param count - How many pages there are.
 * @param selectedIndex - Which page is showing, counting from zero.
 * @param onSelect - Told which page was asked for.
 * @param labels - What each page is, where they have names worth reading out.
 * @param label - What the row of dots is for, as a whole.
 * @param fillMilliseconds - How long each page is shown, where they advance on their own.
 * @param isFillPaused - Whether to hold the fill where it is.
 * @param className - Extra classes for the caller's own layout.
 */
const PageDots = ({
  count,
  selectedIndex,
  onSelect,
  labels,
  label,
  className,
  fillMilliseconds,
  isFillPaused = false,
}: PageDotsProps) => {
  if (count <= 1) {
    return null;
  }

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
                  ? fillMilliseconds === undefined
                    ? 'w-6 bg-text'
                    : 'w-6 bg-text/25'
                  : 'w-1.5 bg-text-muted/40 group-hover:bg-text-muted',
              )}
            >
              {selectedIndex === index && fillMilliseconds !== undefined ? (
                <span
                  key={selectedIndex}
                  className="flux-dot-fill block h-full w-full origin-left rounded-full bg-text"
                  style={{
                    animationDuration: `${fillMilliseconds.toString()}ms`,
                    animationPlayState: isFillPaused ? 'paused' : 'running',
                  }}
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
