import { useCallback, useRef, useState } from 'react'
import { Slider } from '@base-ui-components/react/slider'
import cnModule from '@FluxUI/cn'
import type { SeekBarProps } from './SeekBar.types'

const { cn } = cnModule

/**
 * The scrub bar.
 *
 * Built on the Base UI slider so dragging, arrow keys and the ARIA wiring come
 * from a primitive that already gets them right, rather than from a div with a
 * pointer handler that keyboard users cannot reach.
 *
 * Hovering reports the time under the pointer so a caller can draw a preview
 * there. That is measured from the track's own rectangle, because the pointer
 * event's offset is relative to whichever child element it landed on.
 */
const SeekBar = ({ label, position, duration, onSeek, renderPreview, className }: SeekBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ seconds: number; ratio: number } | null>(null)

  const track = useCallback(
    (clientX: number) => {
      const element = trackRef.current

      if (element === null || duration <= 0) {
        return
      }

      const box = element.getBoundingClientRect()

      if (box.width === 0) {
        return
      }

      const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1)

      setHover({ seconds: ratio * duration, ratio })
    },
    [duration],
  )

  return (
    <div className={cn('relative w-full', className)}>
      {hover === null || renderPreview === undefined ? null : (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2"
          style={{ left: `${(hover.ratio * 100).toString()}%` }}
        >
          {renderPreview(hover.seconds)}
        </div>
      )}

      <Slider.Root
        value={position}
        min={0}
        max={duration <= 0 ? 1 : duration}
        step={1}
        disabled={duration <= 0}
        onValueChange={(value) => {
          onSeek(value)
        }}
      >
        <Slider.Control
          className="flex w-full touch-none items-center py-2"
          onPointerMove={(event) => {
            track(event.clientX)
          }}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          <Slider.Track
            ref={trackRef}
            className="h-1 w-full rounded-full bg-surface-raised select-none"
          >
            <Slider.Indicator className="rounded-full bg-accent select-none" />
            <Slider.Thumb
              aria-label={label}
              className={cn(
                'size-3 rounded-full bg-accent select-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  )
}

SeekBar.displayName = 'SeekBar'

export default { SeekBar }
