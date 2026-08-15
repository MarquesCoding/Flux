type PresenceEvent =
  { kind: 'stopped'; reason: string } | { kind: 'paused'; reason: string } | { kind: 'resumed' };

type PresenceEventListener = (event: PresenceEvent) => void;

const listeners = new Set<PresenceEventListener>();

/**
 * Passes an admin action from this tab's presence connection to whichever player is currently
 * mounted.
 */
const emitPresenceEvent = (event: PresenceEvent): void => {
  for (const listener of listeners) {
    listener(event);
  }
};

/**
 * Listens for admin actions pushed down this tab's presence connection.
 */
const onPresenceEvent = (listener: PresenceEventListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export type { PresenceEvent };

export { emitPresenceEvent, onPresenceEvent };
