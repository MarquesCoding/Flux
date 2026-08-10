import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import IconButtonModule from '@FluxUI/IconButton'
import type { RailProps } from './Rail.types'

const { cn } = cnModule
const { IconButton } = IconButtonModule

/**
 * How much of the visible width one press moves.
 *
 * Not the whole width: leaving a card partly visible tells a viewer the row
 * carried on, where a clean page turn loses their place in it.
 */
const SCROLL_FRACTION = 0.85

/**
 * A horizontally scrolling row of items.
 *
 * Rows rather than a grid because a library is browsed by mood, not by index:
 * a viewer skims along a theme until something catches them.
 *
 * Scrolling is a real overflow rather than a transform, so a trackpad, a touch
 * screen and a keyboard all work without being taught to. The arrows exist for
 * a mouse, which has none of those.
 */
const Rail = ({ title, children, action, className }: RailProps) => {
  const trackRef = useRef<HTMLUListElement>(null)
  const [reach, setReach] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const track = trackRef.current

    if (track === null) {
      return
    }

    setReach({
      start: track.scrollLeft > 8,
      end: track.scrollLeft + track.clientWidth < track.scrollWidth - 8,
    })
  }, [])

  useEffect(() => {
    measure()

    const track = trackRef.current

    if (track === null) {
      return
    }

    const observer = new ResizeObserver(measure)

    observer.observe(track)

    return () => {
      observer.disconnect()
    }
  }, [measure, children])

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current

    if (track !== null) {
      track.scrollBy({ left: direction * track.clientWidth * SCROLL_FRACTION, behavior: 'smooth' })
    }
  }

  return (
    <section className={cn('group/rail flex flex-col gap-3', className)} aria-label={title}>
      <header className="flex items-end justify-between gap-4 px-1">
        <h2 className="text-lg font-semibold tracking-tight text-text">{title}</h2>

        <div className="flex items-center gap-2">
          {action}

          <span className="hidden items-center gap-1 md:flex">
            <IconButton
              label={`Scroll ${title} left`}
              size="sm"
              disabled={!reach.start}
              onClick={() => {
                scrollBy(-1)
              }}
            >
              <IconChevronLeft size={18} aria-hidden />
            </IconButton>

            <IconButton
              label={`Scroll ${title} right`}
              size="sm"
              disabled={!reach.end}
              onClick={() => {
                scrollBy(1)
              }}
            >
              <IconChevronRight size={18} aria-hidden />
            </IconButton>
          </span>
        </div>
      </header>

      <ul
        ref={trackRef}
        onScroll={measure}
        className="flux-rail flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {children}
      </ul>
    </section>
  )
}

Rail.displayName = 'Rail'

export default { Rail }
