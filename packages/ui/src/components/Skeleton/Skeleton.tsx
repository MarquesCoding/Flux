import { cn } from '@ValenceUI/cn';
import type { SkeletonProps } from './Skeleton.types';

/**
 * Holds the space something will occupy while it is still being fetched, so a page settles into
 * place rather than jumping as each part lands. Shaped by the caller, since only the caller knows
 * what is coming.
 *
 * @param label - What is being waited for, for anybody who cannot see the shape.
 * @param className - The size and shape to hold, as classes.
 */
const Skeleton = ({ label, className }: SkeletonProps) => (
  <span
    role={label === undefined ? 'presentation' : 'status'}
    aria-label={label}
    aria-hidden={label === undefined}
    className={cn('block animate-pulse rounded-lg bg-subtle motion-reduce:animate-none', className)}
  />
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
