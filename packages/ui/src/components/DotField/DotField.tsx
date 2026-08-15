import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { DotFieldProps } from './DotField.types';

const SPACING = 16;

const SECONDS = 7;

const SOURCES = 2;

const DELAY_PER_PIXEL = 0.0016;

const RESTING = 0.18;

const LIT = 0.42;

const WINDOW = 0.12;

const FADE_BY = 0.92;

const LEVELS = 10;

/**
 * How bright a dot is at a point in its cycle.
 */
const brightnessAt = (phase: number): number => {
  if (phase > WINDOW) {
    return 0;
  }

  const along = phase / WINDOW;

  return Math.sin(along * Math.PI) ** 2;
};

/**
 * A field of dots that ripples.
 */
const DotField = ({
  spacing = SPACING,
  sources = SOURCES,
  seconds = SECONDS,
  className,
}: DotFieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return;
    }

    const context = canvas.getContext('2d');

    if (context === null) {
      return;
    }

    let frame = 0;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let delays: Float32Array[] = [];
    let fades = new Float32Array(0);
    let width = 0;
    let height = 0;

    /**
     * Works out where every dot is and when each ripple reaches it.
     */
    const lay = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);

      width = canvas.clientWidth;
      height = canvas.clientHeight;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const columns = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const count = columns * rows;

      xs = new Float32Array(count);
      ys = new Float32Array(count);
      fades = new Float32Array(count);
      delays = Array.from({ length: Math.max(sources, 1) }, () => new Float32Array(count));

      const origins = delays.map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
      }));

      for (let index = 0; index < count; index += 1) {
        const x = (index % columns) * spacing;
        const y = Math.floor(index / columns) * spacing;

        xs[index] = x;
        ys[index] = y;
        fades[index] = Math.max(0, 1 - y / (height * FADE_BY));

        for (const [at, origin] of origins.entries()) {
          const away = Math.hypot(x - origin.x, y - origin.y);
          const row = delays[at];

          if (row !== undefined) {
            row[index] = away * DELAY_PER_PIXEL;
          }
        }
      }
    };

    const ink = getComputedStyle(canvas).color;

    const buckets: number[][] = Array.from({ length: LEVELS }, () => []);

    const draw = (elapsed: number) => {
      context.clearRect(0, 0, width, height);

      for (const bucket of buckets) {
        bucket.length = 0;
      }

      for (let index = 0; index < xs.length; index += 1) {
        const fade = fades[index] ?? 0;

        if (fade <= 0) {
          continue;
        }

        let lift = 0;

        for (const row of delays) {
          const delay = row[index] ?? 0;
          const phase = ((elapsed - delay) / seconds) % 1;

          if (phase >= 0) {
            lift = Math.max(lift, brightnessAt(phase));
          }
        }

        const alpha = (RESTING + (LIT - RESTING) * lift) * fade;
        const level = Math.min(LEVELS - 1, Math.floor((alpha / LIT) * LEVELS));

        buckets[level]?.push(index);
      }

      for (const [level, bucket] of buckets.entries()) {
        if (bucket.length === 0) {
          continue;
        }

        const alpha = ((level + 0.5) / LEVELS) * LIT;
        const size = 1.2 + (level / LEVELS) * 1.1;

        context.globalAlpha = alpha;
        context.fillStyle = ink;

        for (const index of bucket) {
          context.fillRect((xs[index] ?? 0) - size / 2, (ys[index] ?? 0) - size / 2, size, size);
        }
      }

      context.globalAlpha = 1;
    };

    const started = performance.now();

    const tick = (now: number) => {
      draw((now - started) / 1000);
      frame = requestAnimationFrame(tick);
    };

    lay();

    if (prefersReducedMotion === true) {
      draw(0);
    } else {
      frame = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      lay();

      if (prefersReducedMotion === true) {
        draw(0);
      }
    });

    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [spacing, sources, seconds, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full text-text', className)}
    />
  );
};

DotField.displayName = 'DotField';

export { DotField };
