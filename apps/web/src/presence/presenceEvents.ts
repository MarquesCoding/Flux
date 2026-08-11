type PresenceEvent =
  { kind: 'stopped'; reason: string } | { kind: 'paused'; reason: string } | { kind: 'resumed' };

type PresenceEventListener = (event: PresenceEvent) => void;

const listeners = new Set<PresenceEventListener>();

/**
 * Passes an admin action from this tab's presence connection to whichever
 * player is currently mounted.
 *
 * A plain module rather than context: the connection lives once at the app
 * root and the player mounts and unmounts beneath it, so there is no single
 * component tree both sides could share a context through — the same reason
 * viewer identity is a module here rather than a provider.
 */
const emitPresenceEvent = (event: PresenceEvent): void => {
  for (const listener of listeners) {
    listener(event);
  }
};

/**
 * Listens for admin actions pushed down this tab's presence connection.
 *
 * Returns the function that stops listening.
 */
const onPresenceEvent = (listener: PresenceEventListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export type { PresenceEvent };

export { emitPresenceEvent, onPresenceEvent };
