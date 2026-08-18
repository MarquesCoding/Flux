import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { MotionGlobalConfig } from 'motion/react';
import { JSDOM } from 'jsdom';
import { installATestClient } from './src/testing/installATestClient';

/**
 * Gives the tests web storage back, on a Node that has taken it away.
 *
 * Node 26 declares `localStorage` on the global itself, as a stub that returns
 * undefined unless the process was started with `--localstorage-file`. Vitest
 * builds the test global by copying jsdom's window across, and skips any key
 * already present unless it is on its own allowlist — which `localStorage` is
 * not. So jsdom's perfectly good implementation is dropped in favour of Node's
 * empty one, and every test touching storage fails on a Node nobody chose.
 *
 * The repository asks for Node 22 and the image builds on it, so this only
 * bites a developer running something newer. Fixed here rather than only in
 * `.nvmrc` because the failure is baffling — `window.localStorage` is undefined
 * while `window` and `Storage` both exist — and costs an hour to work out.
 *
 * Taken from a throwaway jsdom rather than hand-written, so the tests get real
 * `Storage` semantics: quota, `key()`, `length`, and the same coercion of
 * non-string values a browser does.
 */
const restoreWebStorage = (): void => {
  if (typeof globalThis.localStorage !== 'undefined') {
    return;
  }

  const { window: storage } = new JSDOM('', { url: 'http://localhost:3000/' });

  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      value: storage[name],
      configurable: true,
      writable: true,
    });
  }
};

restoreWebStorage();

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
 * Answers questions about the display, on a jsdom that has none.
 *
 * Anything asking whether the viewer prefers dark, or less motion, or a coarse pointer, gets a no.
 * jsdom implements no media queries at all, so without this a component that merely asks the
 * question throws — which is a test failing for the absence of a screen rather than for anything the
 * component did.
 */
const answerMediaQueries = (): void => {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'function') {
    return;
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => ({
      media,
      matches: false,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

answerMediaQueries();

/**
 * Gives elements the pointer-capture methods, on a jsdom that has none.
 *
 * A control that tracks a drag captures the pointer so that leaving its bounds does not drop the
 * gesture. jsdom implements no part of that, so a slider merely being dragged throws — which is a
 * test failing for the absence of a pointer rather than for anything the component did.
 */
const answerPointerCapture = (): void => {
  if (typeof Element === 'undefined' || typeof Element.prototype.hasPointerCapture === 'function') {
    return;
  }

  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
};

answerPointerCapture();

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

/**
 * Takes back everything that outlives the component that made it.
 *
 * Sonner keeps its toasts in a module rather than in a component, so one raised by a test is still
 * on screen for the next — which fails a later test for something an earlier one did.
 */
const forgetWhatOutlivesATest = (): void => {
  toast.dismiss();
};

afterEach(forgetWhatOutlivesATest);

beforeEach(installATestClient);

installATestClient();
