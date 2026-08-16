/**
 * Whether this device is being driven by something that can point precisely — a mouse or a trackpad
 * rather than a finger. Asked before offering anything that depends on hovering, since on a touch
 * screen a hover is either impossible or an accident. Answers no where there is no window at all,
 * which is how it behaves under a server render.
 *
 * @returns Whether hovering is something this device can do.
 */
const hasFinePointer = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export { hasFinePointer };
