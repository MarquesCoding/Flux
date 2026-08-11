import cnModule from '@FluxUI/cn'
import type { SkeletonProps } from './Skeleton.types'

const { cn } = cnModule

/**
 * The shape of something that has not arrived yet.
 *
 * Placeholders rather than a spinner, so a panel keeps its layout while it
 * fills in: content that appears into a space already the right size does not
 * shove everything else down the page.
 *
 * Hidden from assistive technology by default. A screen reader announcing five
 * grey rectangles is worse than it announcing nothing, so the region around
 * them says what is coming instead.
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
)

Skeleton.displayName = 'Skeleton'

export default { Skeleton }
