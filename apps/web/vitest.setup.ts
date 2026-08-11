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

MotionGlobalConfig.skipAnimations = true;

if (!('PointerEvent' in globalThis)) {
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    value: MouseEvent,
  });
}

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

  Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', {
    configurable: true,
    writable: true,
    value: Object.assign([], {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

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
