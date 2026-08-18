import { useRef } from 'react';

/**
 * Keeps the last value something had while it is on its way out, so that a panel goes on showing
 * what it was showing until it has finished leaving.
 *
 * A dialog here is dismissed by the thing it was opened for becoming nothing, and everything drawn
 * from that thing becomes nothing in the same render — the overview, the cast, the seasons. The
 * panel is still on screen for the length of its exit, so it spends that time as an empty box, and
 * an empty box fading out reads as the dialog having been cut rather than closed.
 *
 * While it is present the value is passed straight through, so a panel that is open and loading
 * something new shows that it is loading rather than the last thing it held.
 *
 * @param value - What to show now.
 * @param isPresent - Whether the thing being shown is still there, as opposed to leaving.
 * @returns The value while it is present, and the last one it had while it is not.
 */
const useHeldWhileLeaving = <Value>(value: Value, isPresent: boolean): Value => {
  const held = useRef(value);

  if (isPresent) {
    held.current = value;
  }

  return isPresent ? value : held.current;
};

export { useHeldWhileLeaving };
