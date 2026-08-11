/**
 * Whether this is a device where hovering means anything.
 *
 * A touch screen reports a hover the moment a finger lands and keeps reporting
 * it after the finger has gone, so anything hung off hovering happens on every
 * tap and then stays happened. Asked of the browser rather than guessed from
 * the width of the window: a laptop with a touch screen is both, and a tablet
 * with a trackpad is neither.
 *
 * Answers false where there is no window, and where there is one that cannot
 * answer the question — a document being rendered on a server, or in a test.
 * That is the safe way round: nothing is drawn hovered before anything has
 * been drawn.
 */
const hasFinePointer = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

export { hasFinePointer }
