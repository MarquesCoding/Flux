import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MotionGlobalConfig } from 'motion/react'

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
    return undefined
  }

  unobserve(): void {
    return undefined
  }

  disconnect(): void {
    return undefined
  }
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = LayoutlessResizeObserver
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
MotionGlobalConfig.skipAnimations = true

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
  })
}

afterEach(() => {
  cleanup()
})
