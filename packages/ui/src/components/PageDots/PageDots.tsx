import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import type { PageDotsProps } from './PageDots.types';

/**
 * Which of several things is showing, and a way to any of the others.
 *
 * A row of markers rather than a pair of arrows: the dots say how much there
 * is as well as where you are, and going straight to the fourth of five is one
 * press rather than three. The current one stretches into a bar instead of
 * changing colour alone, so the answer is legible at a glance and from across
 * a room.
 *
 * Where a marker has a name, it appears above the one being pointed at —
 * choosing the next thing should be a decision rather than a guess. The name
 * is lifted out of the flow, because an invisible label still takes its full
 * width, which would push the markers as far apart as the names are long.
 */
const PageDots = ({ count, selectedIndex, onSelect, labels, label, className }: PageDotsProps) => {
  if (count <= 1) {
    return null;
  }

  return (
    <ul aria-label={label} className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: count }, (_, index) => index).map((index) => {
        const named = labels?.[index];

        return (
          <li key={index}>
            <Button
              variant="bare"
              size="none"
              // Named for what pressing it does rather than for what it points
              // at: the caption above says which thing this is, and a button
              // whose whole name is a film title does not say that it is a way
              // of getting there.
              aria-label={`Show ${named ?? `page ${(index + 1).toString()}`}`}
              aria-current={selectedIndex === index ? 'true' : undefined}
              onClick={() => {
                onSelect(index);
              }}
              className="group relative flex items-center px-0.5 py-2"
            >
              {named === undefined ? null : (
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-xs font-medium tracking-tight text-text opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {named}
                </span>
              )}

              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-300',
                  selectedIndex === index
                    ? 'w-6 bg-text'
                    : 'w-1.5 bg-text-muted/40 group-hover:bg-text-muted',
                )}
              />
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

PageDots.displayName = 'PageDots';

export { PageDots };
