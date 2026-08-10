import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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

afterEach(() => {
  cleanup()
})
