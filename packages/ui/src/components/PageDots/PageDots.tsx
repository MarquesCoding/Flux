import { Button } from '@FluxUI/Button';
import { Tooltip } from '@FluxUI/Tooltip';
import { cn } from '@FluxUI/cn';
import type { PageDotsProps } from './PageDots.types';

/**
 * Which of several things is showing, and a way to any of the others.
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
                'block h-1.5 overflow-hidden rounded-full transition-all duration-300',
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
