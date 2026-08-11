import { useCallback, useRef, useState } from 'react';
import { Slider as BaseSlider } from '@base-ui/react/slider';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { SliderProps, SliderTone } from './Slider.types';

const TRACK_CLASSES: Record<SliderTone, string> = {
  default: 'bg-surface-raised',
  overlay: 'bg-white/30',
};

const FILL_CLASSES: Record<SliderTone, string> = {
  default: 'bg-accent',
  overlay: 'bg-white',
};

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
  tone = 'default',
  className,
}: SliderProps) => {
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ value: number; ratio: number; left: number } | null>(null);

  const track = useCallback(
    (clientX: number) => {
      const element = trackRef.current;

      if (element === null || max <= 0) {
        return;
      }

      const box = element.getBoundingClientRect();

      if (box.width === 0) {
        return;
      }

      const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);

      const half = (previewRef.current?.offsetWidth ?? 0) / 2;
      const left = Math.min(Math.max(ratio * box.width, half), Math.max(box.width - half, half));

      setHover({ value: ratio * max, ratio, left });
    },
    [max],
  );

  return (
    <div data-tone={tone} className={cn('group/slider relative w-full', className)}>
      <AnimatePresence>
        {hover === null || renderPreview === undefined ? null : (
          <motion.div
            ref={previewRef}
            initial={{
              opacity: 0,
              y: prefersReducedMotion === true ? 0 : 6,
              scale: prefersReducedMotion === true ? 1 : 0.96,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: prefersReducedMotion === true ? 0 : 6,
              scale: prefersReducedMotion === true ? 1 : 0.96,
            }}
            transition={{ duration: prefersReducedMotion === true ? 0 : 0.16, ease: 'easeOut' }}
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2"
            style={{ left: `${hover.left.toString()}px` }}
          >
            {renderPreview(hover.value)}
          </motion.div>
        )}
      </AnimatePresence>

      <BaseSlider.Root
        value={value}
        min={0}
        max={max <= 0 ? 1 : max}
        step={step}
        disabled={max <= 0}
        onValueChange={(next) => {
          onValueChange(next);
        }}
      >
        <BaseSlider.Control
          className="flex w-full touch-none items-center py-2"
          onPointerMove={(event) => {
            track(event.clientX);
          }}
          onPointerLeave={() => {
            setHover(null);
          }}
        >
          <BaseSlider.Track
            ref={trackRef}
            className={cn('h-1.5 w-full rounded-full select-none', TRACK_CLASSES[tone])}
          >
            <BaseSlider.Indicator className={cn('rounded-full select-none', FILL_CLASSES[tone])} />
            <BaseSlider.Thumb
              aria-label={label}
              className={cn('size-3.5 rounded-full shadow select-none', FILL_CLASSES[tone])}
            />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    </div>
  );
};

Slider.displayName = 'Slider';

export { Slider };
