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

const FILM_RESTING = 0.05;

const FILM_LIT = 0.98;

const WINDOW = 0.12;

const FADE_BY = 0.92;

const LEVELS = 10;

/**
 * Works out how bright one dot is at a point in a ripple's cycle, fading up and back down so a
 * ripple has no hard edge.
 *
 * @param phase - How far through its cycle this dot is, from nothing to one.
 * @returns The brightness to draw it at.
 */
const brightnessAt = (phase: number): number => {
  if (phase > WINDOW) {
    return 0;
  }

  const along = phase / WINDOW;

  return Math.sin(along * Math.PI) ** 2;
};

/**
 * Draws a field of dots with ripples running through it, as the backdrop for a screen with nothing
 * else on it yet — sign-in, setup, an empty library. Movement rather than a static pattern, so a
 * screen that is waiting looks alive rather than stalled.
 *
 * Given a frame source it stops rippling and becomes a display instead, asking that source how lit
 * every dot is and drawing the answer. Everything below that — the layout, the resize handling, the
 * buckets it draws in — is the same either way.
 *
 * @param spacing - How far apart the dots sit, in pixels.
 * @param sources - How many ripples run at once.
 * @param seconds - How long one ripple takes to cross.
 * @param frame - Where to read the picture from, if it is showing one rather than rippling.
 * @param className - Extra classes for the caller's own layout.
 */
const DotField = ({
  spacing = SPACING,
  sources = SOURCES,
  seconds = SECONDS,
  frame,
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

    const showing = frame !== undefined;
    const resting = showing ? FILM_RESTING : RESTING;
    const brightest = showing ? FILM_LIT : LIT;

    let request = 0;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let delays: Float32Array[] = [];
    let fades = new Float32Array(0);
    let lifts = new Float32Array(0);
    let columns = 0;
    let rows = 0;
    let width = 0;
    let height = 0;

    /**
     * Works out where every dot sits and when each ripple reaches it, once, so that the animation itself
     * is a matter of reading a number per frame rather than measuring anything.
     */
    const lay = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);

      width = canvas.clientWidth;
      height = canvas.clientHeight;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      columns = Math.ceil(width / spacing) + 1;
      rows = Math.ceil(height / spacing) + 1;

      const count = columns * rows;

      xs = new Float32Array(count);
      ys = new Float32Array(count);
      fades = new Float32Array(count);
      lifts = new Float32Array(count);
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

    /**
     * How lit one dot is from the ripples running through the field.
     *
     * @param index - Which dot this is.
     * @param elapsed - How long the field has been running, in seconds.
     * @returns How lit it is, from nothing to one.
     */
    const rippleAt = (index: number, elapsed: number): number => {
      let lift = 0;

      for (const row of delays) {
        const delay = row[index] ?? 0;
        const phase = ((elapsed - delay) / seconds) % 1;

        if (phase >= 0) {
          lift = Math.max(lift, brightnessAt(phase));
        }
      }

      return lift;
    };

    const draw = (elapsed: number) => {
      context.clearRect(0, 0, width, height);

      for (const bucket of buckets) {
        bucket.length = 0;
      }

      if (frame !== undefined) {
        frame(lifts, columns, rows, elapsed);
      }

      for (let index = 0; index < xs.length; index += 1) {
        const fade = showing ? 1 : (fades[index] ?? 0);

        if (fade <= 0) {
          continue;
        }

        const lift = showing ? (lifts[index] ?? 0) : rippleAt(index, elapsed);
        const alpha = (resting + (brightest - resting) * lift) * fade;
        const level = Math.min(LEVELS - 1, Math.floor((alpha / brightest) * LEVELS));

        buckets[level]?.push(index);
      }

      for (const [level, bucket] of buckets.entries()) {
        if (bucket.length === 0) {
          continue;
        }

        const alpha = ((level + 0.5) / LEVELS) * brightest;
        const size = showing ? 1 + (level / LEVELS) * spacing * 0.55 : 1.2 + (level / LEVELS) * 1.1;

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
      request = requestAnimationFrame(tick);
    };

    lay();

    if (prefersReducedMotion === true) {
      draw(0);
    } else {
      request = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      lay();

      if (prefersReducedMotion === true) {
        draw(0);
      }
    });

    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
    };
  }, [spacing, sources, seconds, frame, prefersReducedMotion]);

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
