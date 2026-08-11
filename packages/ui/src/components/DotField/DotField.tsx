import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@FluxUI/cn'
import type { DotFieldProps } from './DotField.types'

/**
 * How far apart dots sit by default.
 *
 * Fine, because the cost of a dot on a canvas is an addition and a fill: a
 * screen of ten thousand of them is a few hundredths of a millisecond, where
 * ten thousand elements would be unusable.
 */
const SPACING = 16

/**
 * How long one ripple takes to cross the field.
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
 * This is what makes a ripple a ripple rather than a flash: every dot follows
 * the same cycle and enters it late in proportion to how far it is from where
 * the ripple started.
 */
const DELAY_PER_PIXEL = 0.0016

/**
 * How bright a dot is when nothing is happening to it.
 */
const RESTING = 0.18

/**
 * How bright a dot is as the wave front passes.
 *
 * A rise rather than a flare. The wave should read as light moving over a
 * texture, not as the texture switching on.
 */
const LIT = 0.42

/**
 * How much of a cycle a dot spends lit.
 *
 * A narrow window, because a dot lit for half of every pass reads as a
 * flashing grid rather than as a wave going by.
 */
const WINDOW = 0.12

/**
 * How far down the field the dots have faded out entirely.
 */
const FADE_BY = 0.92

/**
 * How many levels of brightness are drawn.
 *
 * Quantised so the whole field can be painted in a handful of passes rather
 * than one per dot: setting the alpha is far more expensive than filling a
 * two pixel square, so dots are grouped by how bright they are and each group
 * drawn in one go.
 */
const LEVELS = 10

/**
 * How bright a dot is at a point in its cycle.
 *
 * Rests dark, rises steeply as the front arrives, and falls away behind it.
 */
const brightnessAt = (phase: number): number => {
  if (phase > WINDOW) {
    return 0
  }

  // A curve rather than a triangle: the front should arrive faster than it
  // leaves, which is what makes it read as travelling in a direction.
  const along = phase / WINDOW

  return Math.sin(along * Math.PI) ** 2
}

/**
 * A field of dots that ripples.
 *
 * Drawn onto a canvas rather than as elements. The effect wants a fine grid —
 * several thousand dots on a large screen — and several thousand elements each
 * carrying their own animations is several thousand things for the browser to
 * lay out, composite and keep track of. One canvas is one element, and the
 * arithmetic behind it is a few thousand additions a frame, which costs
 * nothing.
 *
 * Every dot follows the same cycle and differs only in when it enters it,
 * which is decided by its distance from a ripple's source. Sources are picked
 * once and keep rippling, so the field reads as weather rather than as
 * something being triggered.
 */
const DotField = ({
  spacing = SPACING,
  sources = SOURCES,
  seconds = SECONDS,
  className,
}: DotFieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current

    if (canvas === null) {
      return
    }

    const context = canvas.getContext('2d')

    if (context === null) {
      return
    }

    let frame = 0
    let xs = new Float32Array(0)
    let ys = new Float32Array(0)
    let delays: Float32Array[] = []
    let fades = new Float32Array(0)
    let width = 0
    let height = 0

    /**
     * Works out where every dot is and when each ripple reaches it.
     *
     * Done once per size change rather than per frame: the positions and the
     * distances are fixed, and only the clock moves.
     */
    const lay = () => {
      const ratio = Math.min(window.devicePixelRatio, 2)

      width = canvas.clientWidth
      height = canvas.clientHeight

      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const columns = Math.ceil(width / spacing) + 1
      const rows = Math.ceil(height / spacing) + 1
      const count = columns * rows

      xs = new Float32Array(count)
      ys = new Float32Array(count)
      fades = new Float32Array(count)
      delays = Array.from({ length: Math.max(sources, 1) }, () => new Float32Array(count))

      const origins = delays.map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
      }))

      for (let index = 0; index < count; index += 1) {
        const x = (index % columns) * spacing
        const y = Math.floor(index / columns) * spacing

        xs[index] = x
        ys[index] = y
        // The same fade the rest of the page uses, so the grid dies out
        // rather than stopping at an edge.
        fades[index] = Math.max(0, 1 - y / (height * FADE_BY))

        for (const [at, origin] of origins.entries()) {
          const away = Math.hypot(x - origin.x, y - origin.y)
          const row = delays[at]

          if (row !== undefined) {
            row[index] = away * DELAY_PER_PIXEL
          }
        }
      }
    }

    /**
     * The colour the dots are drawn in.
     *
     * Read from the page rather than hard coded, so the field belongs to
     * whatever theme is in force.
     */
    const ink = getComputedStyle(canvas).color

    const buckets: number[][] = Array.from({ length: LEVELS }, () => [])

    const draw = (elapsed: number) => {
      context.clearRect(0, 0, width, height)

      for (const bucket of buckets) {
        bucket.length = 0
      }

      for (let index = 0; index < xs.length; index += 1) {
        const fade = fades[index] ?? 0

        if (fade <= 0) {
          continue
        }

        let lift = 0

        for (const row of delays) {
          const delay = row[index] ?? 0
          const phase = ((elapsed - delay) / seconds) % 1

          // A ripple has not reached this dot yet on its first pass.
          if (phase >= 0) {
            lift = Math.max(lift, brightnessAt(phase))
          }
        }

        const alpha = (RESTING + (LIT - RESTING) * lift) * fade
        const level = Math.min(LEVELS - 1, Math.floor((alpha / LIT) * LEVELS))

        buckets[level]?.push(index)
      }

      for (const [level, bucket] of buckets.entries()) {
        if (bucket.length === 0) {
          continue
        }

        const alpha = ((level + 0.5) / LEVELS) * LIT
        // The brightest dots are drawn larger as well, which is what gives the
        // front its weight.
        const size = 1.2 + (level / LEVELS) * 1.1

        context.globalAlpha = alpha
        context.fillStyle = ink

        for (const index of bucket) {
          context.fillRect((xs[index] ?? 0) - size / 2, (ys[index] ?? 0) - size / 2, size, size)
        }
      }

      context.globalAlpha = 1
    }

    const started = performance.now()

    const tick = (now: number) => {
      draw((now - started) / 1000)
      frame = requestAnimationFrame(tick)
    }

    lay()

    if (prefersReducedMotion === true) {
      // Still a grid, just a still one.
      draw(0)
    } else {
      frame = requestAnimationFrame(tick)
    }

    const observer = new ResizeObserver(() => {
      lay()

      if (prefersReducedMotion === true) {
        draw(0)
      }
    })

    observer.observe(canvas)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [spacing, sources, seconds, prefersReducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full text-text', className)}
    />
  )
}

DotField.displayName = 'DotField'

export { DotField }
