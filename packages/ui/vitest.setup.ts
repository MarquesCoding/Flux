import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';

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

/**
 * Says there is nothing to draw on, on a jsdom that cannot draw.
 *
 * jsdom implements no 2D canvas, and rather than answering the question it reports a
 * not-implemented error to the console the test runner is watching — which fails the run without
 * failing a test. Answering null is both true and the answer the components already handle, since a
 * real browser returns null for a context it cannot give either.
 */
const answerCanvasQuestions = (): void => {
  if (typeof HTMLCanvasElement === 'undefined') {
    return;
  }

  HTMLCanvasElement.prototype.getContext = () => null;
};

answerCanvasQuestions();

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

afterEach(() => {
  cleanup();
});
