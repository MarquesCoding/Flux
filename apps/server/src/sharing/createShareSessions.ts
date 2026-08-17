type ShareSessions = {
  claim: (sessionId: string, shareId: string) => void;
  shareOf: (sessionId: string) => string | null;
  release: (sessionId: string) => void;
};

/**
 * Remembers which share started which playback session, so that the delivery URLs a manifest points
 * at can be checked against the link that opened them. A session identifier is the only thing those
 * URLs carry — there is no item in the path — so without this a guest holding one share could fetch
 * the segments of a session belonging to another.
 *
 * Held in memory rather than in Postgres because a session is already an in-memory, ephemeral thing:
 * a restart ends every session, and a claim that outlived one would be a claim on nothing.
 *
 * @returns The registry.
 */
const createShareSessions = (): ShareSessions => {
  const claimed = new Map<string, string>();

  return {
    claim: (sessionId, shareId) => {
      claimed.set(sessionId, shareId);
    },

    shareOf: (sessionId) => claimed.get(sessionId) ?? null,

    release: (sessionId) => {
      claimed.delete(sessionId);
    },
  };
};

export type { ShareSessions };

export { createShareSessions };
