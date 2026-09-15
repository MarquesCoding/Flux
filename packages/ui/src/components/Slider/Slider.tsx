import { useCallback, useEffect, useRef, useState } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '@ValenceUI/cn';
import { Tooltip } from '@ValenceUI/Tooltip';
import type { SliderProps, SliderTone } from './Slider.types';

const TRACK_CLASSES: Record<SliderTone, string> = {
  default: 'bg-surface-raised',
  overlay: 'bg-on-scrim/30',
};

const FILL_CLASSES: Record<SliderTone, string> = {
  default: 'bg-primary',
  overlay: 'bg-on-scrim',
};

/**
 * A track with a handle on it, for choosing one number from a range — a volume, a position in a
 * film, an offset. A caller can draw something above the handle as it moves, which is how scrubbing
 * a film shows the frame being scrubbed to.
 *
 * The pointer is followed on entering as well as on moving. Tracked on movement alone, a pointer
 * already over the track when it appears has entered without moving — which is what happens every
 * time a player's controls fade out and come back under a still hand — so nothing was drawn until
 * the pointer moved again, and the preview read as appearing at random.
 *
 * @param label - What is being chosen, read out to anybody who cannot see the track.
 * @param value - Where the handle sits now.
 * @param max - The largest value the track reaches.
 * @param step - How far each press of an arrow key moves it.
 * @param onValueChange - Told the new value as the handle moves.
 * @param renderPreview - Draws something above the handle for the value being pointed at.
 * @param valueLabel - Names the value the handle is at, shown while the handle is under the pointer
 *   or holding focus. Says where the handle is rather than where the pointer is, which is the
 *   difference between this and a preview: a preview answers "what is there", and this answers
 *   "what have I set". Shown without the pause a tooltip usually takes, since a figure that arrives
 *   half a second after the handle has moved is describing the past.
 * @param tone - Whether it sits on the page or over video.
 * @param className - Extra classes for the caller's own layout.
 */
const Slider = ({
  label,
  value,
  max,
  step = 1,
  onValueChange,
  renderPreview,
  valueLabel,
  tone = 'default',
  className,
}: SliderProps) => {
  const prefersReducedMotion = useReducedMotionConfig();
  const trackRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ value: number; ratio: number; left: number } | null>(null);
  const [isOnHandle, setIsOnHandle] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const letGo = (): void => {
      setIsDragging(false);
    };

    window.addEventListener('pointerup', letGo);
    window.addEventListener('pointercancel', letGo);

    return () => {
      window.removeEventListener('pointerup', letGo);
      window.removeEventListener('pointercancel', letGo);
    };
  }, [isDragging]);

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

  const handle = (
    <RadixSlider.Thumb
      aria-label={label}
      aria-disabled={max <= 0}
      onPointerEnter={() => {
        setIsOnHandle(true);
      }}
      onPointerLeave={() => {
        setIsOnHandle(false);
      }}
      className={cn(
        'block size-3.5 w-8 rounded-full shadow outline-none select-none',
        'transition-transform duration-[var(--duration-instant)] ease-[var(--ease-out)]',
        'motion-reduce:transition-none hover-hover:hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring',
        FILL_CLASSES[tone],
      )}
    />
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

      <RadixSlider.Root
        value={[value]}
        min={0}
        max={max <= 0 ? 1 : max}
        step={step}
        disabled={max <= 0}
        data-slot="slider"
        className="flex w-full touch-none items-center py-2 select-none"
        onValueChange={(next) => {
          onValueChange(next[0] ?? 0);
        }}
        onPointerDown={() => {
          setIsDragging(true);
        }}
        onPointerEnter={(event) => {
          track(event.clientX);
        }}
        onPointerMove={(event) => {
          track(event.clientX);
        }}
        onPointerLeave={() => {
          setHover(null);
        }}
      >
        <RadixSlider.Track
          ref={trackRef}
          className={cn(
            'relative h-1.5 w-full grow overflow-hidden rounded-full select-none',
            TRACK_CLASSES[tone],
          )}
        >
          <RadixSlider.Range
            className={cn('absolute h-full rounded-full select-none', FILL_CLASSES[tone])}
          />
        </RadixSlider.Track>

        {valueLabel === undefined ? (
          handle
        ) : (
          <Tooltip
            label={valueLabel(value)}
            delayMilliseconds={0}
            isOpen={isOnHandle || isDragging}
          >
            {handle}
          </Tooltip>
        )}
      </RadixSlider.Root>
    </div>
  );
};

Slider.displayName = 'Slider';

export { Slider };
