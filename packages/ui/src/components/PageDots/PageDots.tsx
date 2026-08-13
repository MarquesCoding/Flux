import { Button } from '@FluxUI/Button';
import { Tooltip } from '@FluxUI/Tooltip';
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
 * Where something is moving on by itself, the current marker fills as its time
 * runs out. A carousel that changes on a timer otherwise changes without
 * warning — the thing being read is replaced mid-sentence — and the filling
 * doubles as the answer to how long there is left, which is what somebody
 * deciding whether to press Play wants to know. Drawn by the browser from a
 * keyframe rather than by counting in JavaScript: this runs for as long as the
 * page is open, and a bar that costs a render a frame to draw is a bar that
 * costs more than everything it sits on.
 *
 * Where a marker has a name, it appears above the one being pointed at —
 * choosing the next thing should be a decision rather than a guess. It is the
 * platform's tooltip rather than a label of this component's own, because
 * these markers sit in the corner of a card that clips what overflows it, and
 * a name written into that card is a name cut off at the edge. A tooltip is
 * drawn outside the page's layout entirely and can say as much as it needs to.
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
