import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '@ValenceUI/cn';
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
  <div className={cn('flex shrink-0 items-center gap-2', className)}>
    {children}

    <RadixProgress.Root
      value={value}
      max={max}
      aria-label={label}
      data-slot="progress"
      className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-track"
    >
      <RadixProgress.Indicator
        style={value === null ? undefined : { width: `${((value / max) * 100).toString()}%` }}
        className={cn(
          'block h-full rounded-full bg-primary',
          value === null
            ? 'w-full animate-pulse motion-reduce:animate-none'
            : 'transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)] motion-reduce:transition-none',
        )}
      />
    </RadixProgress.Root>

    {readout}
  </div>
);

ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
