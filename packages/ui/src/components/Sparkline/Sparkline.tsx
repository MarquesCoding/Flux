import { cn } from '@FluxUI/cn'
import type { SparklineProps } from './Sparkline.types'

/**
 * A short history, drawn as columns.
 *
 * Columns of markup rather than a chart: the shape of the last minute is the
 * whole point, and a bar per reading says it without a drawing library or a
 * canvas. The most recent reading is on the right, which is where a person
 * reading left to right expects now to be.
 */
const Sparkline = ({ values, ceiling, label, className }: SparklineProps) => {
  const highest = Math.max(ceiling, 1)

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('flex h-12 items-end gap-px overflow-hidden', className)}
    >
      {values.map((value, index) => (
        <span
          // Readings have no identity of their own — they are a position in a
          // window that slides — so the position is the key.
          key={index}
          style={{ height: `${(Math.min(Math.max(value / highest, 0), 1) * 100).toString()}%` }}
          className="min-h-px w-full flex-1 rounded-sm bg-accent/70"
        />
      ))}
    </div>
  )
}

Sparkline.displayName = 'Sparkline'

export { Sparkline }
