import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';

/**
 * jsdom has no layout, and therefore no ResizeObserver.
 *
 * Components that measure themselves are perfectly reasonable; a test
 * environment that cannot lay anything out is the unusual thing, so it is the
 * environment that gets filled in rather than the component that gets a guard
 * it would never need in a browser.
 *
 * Assigned rather than stubbed: a stub belongs to whichever test is running,
 * and a suite that calls `unstubAllGlobals` would take this with it.
 */
class LayoutlessResizeObserver implements ResizeObserver {
  observe(): void {
    return undefined;
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = LayoutlessResizeObserver;
}

/**
 * Motion animates on frames jsdom never paints.
 *
 * Without this, anything waiting for an animation to finish — a presence that
 * holds the outgoing element until it has left — waits forever, and the test
 * asserts on a screen frozen mid-transition. Skipping animations makes them
 * settle instantly, so tests describe what ends up on screen rather than how
 * long it took to get there.
 */
MotionGlobalConfig.skipAnimations = true;

/**
 * jsdom has no pointer events either.
 *
 * Motion synthesises one when a control is activated from the keyboard, so a
 * button that can be pressed with the space bar throws in an environment that
 * has never heard of pointers. A mouse event carries everything the gesture
 * reads, and defining it this way keeps the fill-in free of the type
 * assertions the standards forbid.
 */
if (!('PointerEvent' in globalThis)) {
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    value: MouseEvent,
  });
}

/**
 * jsdom plays nothing, and says so by returning undefined.
 *
 * A browser answers `play()` with a promise, which is what everything here
 * waits on and catches: a preview that is refused falls back to its still
 * frame rather than failing. Filled in for the same reason as the rest —
 * production code should not carry a guard for an environment nobody runs.
 *
 * Only defined where jsdom left a gap, so a test that wants to watch these
 * can still replace them.
 */
if (typeof HTMLMediaElement !== 'undefined') {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });

  // A track list that can be listened to, which jsdom's cannot: the surface
  // waits for cues arriving after the element already has its track.
  Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', {
    configurable: true,
    writable: true,
    value: Object.assign([], {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

/**
 * jsdom has no layout, so it cannot scroll, and no media pipeline, so it
 * cannot load. Both are things the application does for real reasons — a new
 * section starts at its top, and a stream that has not produced a segment is
 * asked again — and neither should have to check whether it is being tested.
 */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

if (typeof Element !== 'undefined') {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

if (typeof HTMLMediaElement !== 'undefined') {
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

/*
 * jsdom draws nothing, and says so loudly: asking it for a drawing context
 * raises an error it never handles, which fails a run in which every test
 * passed. The interface reads the light it is under off whatever is on screen,
 * so a great many tests ask.
 *
 * Answers with nothing, which is the same answer a browser refusing a context
 * gives, and the same one everything reading a frame is written to expect.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  });
}

afterEach(() => {
  cleanup();
});
