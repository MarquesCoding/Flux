import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { JSDOM } from 'jsdom';

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
