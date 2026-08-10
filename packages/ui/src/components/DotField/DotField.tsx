import { useEffect, useRef, useState } from 'react'
import cnModule from '@FluxUI/cn'
import type { CSSProperties } from 'react'
import type { DotFieldProps } from './DotField.types'

const { cn } = cnModule

/**
 * How far apart dots sit by default.
 *
 * Fine enough to read as a texture rather than as scattered points, and
 * weighed against the cost of drawing them: one element per dot, so this is
 * the difference between a couple of thousand nodes and ten thousand.
 */
const SPACING = 26

/**
 * How long a ripple takes to cross the field.
 */
const SECONDS = 7

/**
 * How many places ripples come from.
 */
const SOURCES = 2

/**
 * How long the wave front takes to reach a dot, per pixel away from its
 * source.
 *
 * This is what makes a ripple a ripple rather than a flash: the whole field
 * shares one animation, and each dot enters it late in proportion to how far
 * it is from where the ripple started.
 */
const DELAY_PER_PIXEL = 0.0016

/**
 * A dot's own place in the field, as the stylesheet reads it.
 */
type DotStyle = CSSProperties & Record<string, string>

/**
 * A field of dots that ripples.
 *
 * Drawn as real elements rather than as a repeating background, because the
 * whole point is that each dot has its own timing: a texture can only be
 * moved or faded as a whole, where a field of dots can carry a wave across
 * itself. Every dot runs the same animation and differs only in when it
 * starts, which is a delay the browser handles rather than anything running
 * per frame.
 *
 * The sources are picked once and keep rippling, so the field reads as
 * weather rather than as something being triggered.
 */
const DotField = ({
  spacing = SPACING,
  sources = SOURCES,
  seconds = SECONDS,
  className,
}: DotFieldProps) => {
  const holderRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const holder = holderRef.current

    if (holder === null) {
      return
    }

    const measure = () => {
      setSize({ width: holder.clientWidth, height: holder.clientHeight })
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(holder)

    return () => {
      observer.disconnect()
    }
  }, [])

  const columns = size === null ? 0 : Math.ceil(size.width / spacing) + 1
  const rows = size === null ? 0 : Math.ceil(size.height / spacing) + 1

  // Where the ripples come from, in dots. Fixed for the life of the field so
  // that its rhythm is steady: sources that move would read as something
  // chasing the viewer around the screen.
  const [origins] = useState(() =>
    Array.from({ length: Math.max(sources, 1) }, () => ({
      x: Math.random(),
      y: Math.random(),
    })),
  )

  return (
    <div ref={holderRef} className={cn('pointer-events-none absolute inset-0', className)}>
      <div
        aria-hidden
        // Told to stay off the main thread's critical path: the field never
        // reacts to anything, so the browser is free to raster it once and
        // leave it alone.
        className="flux-dots absolute inset-0 [contain:strict]"
        style={{
          gridTemplateColumns: `repeat(${columns.toString()}, ${spacing.toString()}px)`,
          gridAutoRows: `${spacing.toString()}px`,
          // The animation is the same for every dot; only its delay differs.
          ...({ '--flux-dot-seconds': `${seconds.toString()}s` } satisfies Record<string, string>),
        }}
      >
        {Array.from({ length: columns * rows }, (_, index) => {
          const column = index % columns
          const row = Math.floor(index / columns)
          const style: DotStyle = {}

          for (const [at, origin] of origins.entries()) {
            const distance = Math.hypot(
              column * spacing - origin.x * (size?.width ?? 0),
              row * spacing - origin.y * (size?.height ?? 0),
            )

            style[`--dot-delay-${at}`] = `${(distance * DELAY_PER_PIXEL).toFixed(3)}s`
          }

          return (
            <span
              key={index}
              className={`flux-dot flux-dot--${origins.length.toString()}`}
              style={style}
            />
          )
        })}
      </div>
    </div>
  )
}

DotField.displayName = 'DotField'

export default { DotField }
