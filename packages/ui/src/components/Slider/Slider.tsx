import { useCallback, useRef, useState } from 'react'
import { Slider as BaseSlider } from '@base-ui-components/react/slider'
import cnModule from '@FluxUI/cn'
import type { SliderProps } from './Slider.types'

const { cn } = cnModule

/**
 * A track with a handle on it.
 *
 * Built on the Base UI slider so dragging, arrow keys and the ARIA wiring come
 * from a primitive that already gets them right, rather than from a div with a
 * pointer handler that keyboard users cannot reach.
 *
 * Hovering reports the value under the pointer so a caller can draw a preview
 * there. That is measured from the track's own rectangle, because the pointer
 * event's offset is relative to whichever child element it landed on.
 */
const Slider = ({
  label,
  value,
  max,
  step = 1,
  onValueChange,
  renderPreview,
  className,
}: SliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ value: number; ratio: number } | null>(null)

  const track = useCallback(
    (clientX: number) => {
      const element = trackRef.current

      if (element === null || max <= 0) {
        return
      }

      const box = element.getBoundingClientRect()

      if (box.width === 0) {
        return
      }

      const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1)

      setHover({ value: ratio * max, ratio })
    },
    [max],
  )

  return (
    <div className={cn('relative w-full', className)}>
      {hover === null || renderPreview === undefined ? null : (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2"
          style={{ left: `${(hover.ratio * 100).toString()}%` }}
        >
          {renderPreview(hover.value)}
        </div>
      )}

      <BaseSlider.Root
        value={value}
        min={0}
        max={max <= 0 ? 1 : max}
        step={step}
        disabled={max <= 0}
        onValueChange={(next) => {
          onValueChange(next)
        }}
      >
        <BaseSlider.Control
          className="flex w-full touch-none items-center py-2"
          onPointerMove={(event) => {
            track(event.clientX)
          }}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          <BaseSlider.Track
            ref={trackRef}
            className="h-1 w-full rounded-full bg-surface-raised select-none"
          >
            <BaseSlider.Indicator className="rounded-full bg-accent select-none" />
            <BaseSlider.Thumb
              aria-label={label}
              className={cn(
                'size-3 rounded-full bg-accent select-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    </div>
  )
}

Slider.displayName = 'Slider'

export default { Slider }
