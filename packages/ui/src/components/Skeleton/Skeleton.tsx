import { cn } from '@FluxUI/cn';
import type { SkeletonProps } from './Skeleton.types';

/**
 * The shape of something that has not arrived yet.
 */
const Skeleton = ({ label, className }: SkeletonProps) => (
  <span
    role={label === undefined ? 'presentation' : 'status'}
    aria-label={label}
    aria-hidden={label === undefined}
    className={cn(
      'block animate-pulse rounded-lg bg-white/[0.07] motion-reduce:animate-none',
      className,
    )}
  />
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
