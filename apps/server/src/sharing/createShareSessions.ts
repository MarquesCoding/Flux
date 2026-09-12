type ShareSessions = {
  claim: (sessionId: string, shareId: string) => void;
  isClaimedBy: (sessionId: string, shareId: string) => boolean;
  release: (sessionId: string, shareId: string) => void;
};

/**
 * Remembers which shares started which playback session, so that the delivery URLs a manifest
 * points at can be checked against the link that opened them. A session identifier is the only
 * thing those URLs carry — there is no item in the path — so without this a guest holding one share
 * could fetch the segments of a session belonging to another.
 *
 * Several shares at once, not one. A session is addressed by what it contains, so two links to the
 * same film send both guests to the same session, and recording a single claimant meant the second
 * to press play evicted the first: a guest was refused their own stream part way through because
 * somebody else had opened a different link to the same film. Every share that started a session
 * holds a claim on it, and lets go of its own.
 *
 * Held in memory rather than in Postgres because a session is already an in-memory, ephemeral thing:
 * a restart ends every session, and a claim that outlived one would be a claim on nothing.
 *
 * @returns The registry.
 */
const createShareSessions = (): ShareSessions => {
  const claimed = new Map<string, Set<string>>();

  return {
    claim: (sessionId, shareId) => {
      const holding = claimed.get(sessionId);

      if (holding === undefined) {
        claimed.set(sessionId, new Set([shareId]));

        return;
      }

      holding.add(shareId);
    },

    isClaimedBy: (sessionId, shareId) => claimed.get(sessionId)?.has(shareId) ?? false,

    release: (sessionId, shareId) => {
      const holding = claimed.get(sessionId);

      if (holding === undefined) {
        return;
      }

      holding.delete(shareId);

      if (holding.size === 0) {
        claimed.delete(sessionId);
      }
    },
  };
};

export type { ShareSessions };

export { createShareSessions };
