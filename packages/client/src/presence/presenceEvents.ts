type PresenceEvent =
  | { kind: 'stopped'; reason: string }
  | { kind: 'paused'; reason: string }
  | { kind: 'resumed' }
  | { kind: 'message'; text: string };

type PresenceEventListener = (event: PresenceEvent) => void;

const listeners = new Set<PresenceEventListener>();

/**
 * Passes an action an operator took — a stream stopped, a message sent — from this tab's presence
 * connection to whichever player is currently mounted.
 *
 * @param event - What the operator did.
 */
const emitPresenceEvent = (event: PresenceEvent): void => {
  for (const listener of listeners) {
    listener(event);
  }
};

/**
 * Listens for actions an operator takes against this tab, which arrive down the presence connection
 * rather than being asked for.
 *
 * @param listener - Told each action as it arrives.
 * @returns The function that stops listening.
 */
const onPresenceEvent = (listener: PresenceEventListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export type { PresenceEvent };

export { emitPresenceEvent, onPresenceEvent };
