import { Progress } from '@base-ui/react/progress';
import { cn } from '@FluxUI/cn';
import type { ProgressBarProps } from './ProgressBar.types';

/**
 * Shows how far through a piece of long-running work something is. A null value means the work has
 * started but has not said how much there is to do, which is drawn as movement without a position
 * rather than as an empty bar — an empty bar reads as nothing having happened.
 *
 * @param label - What the work is, read out to anybody who cannot see the bar.
 * @param value - How much is done, or null where the total is not yet known.
 * @param max - The total to measure against, defaulting to a hundred.
 * @param children - Anything to draw beneath the bar, such as what is being worked on now.
 * @param readout - The figure to show beside the bar, where a caller wants one of its own.
 * @param className - Extra classes for the caller's own layout.
 */
const ProgressBar = ({
  label,
  value,
  max = 100,
  children,
  readout,
  className,
}: ProgressBarProps) => (
  <Progress.Root
    value={value}
    max={max}
    className={cn('flex shrink-0 items-center gap-2', className)}
  >
    <Progress.Label className="sr-only">{label}</Progress.Label>

    {children}

    <Progress.Track className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
      <Progress.Indicator
        className={cn(
          'block h-full rounded-full bg-accent',
          value === null ? 'w-full animate-pulse' : 'transition-[width] duration-300',
        )}
      />
    </Progress.Track>

    {readout}
  </Progress.Root>
);

ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
