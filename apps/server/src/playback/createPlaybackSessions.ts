type PlaybackSessions = {
  claim: (sessionId: string, profileId: string) => void;
  isClaimedBy: (sessionId: string, profileId: string) => boolean;
  isHeld: (sessionId: string) => boolean;
  release: (sessionId: string, profileId: string) => void;
};

/**
 * Remembers which viewers started which playback session, so that a manifest and the segments it
 * points at can be checked against whoever is asking for them.
 *
 * A session identifier is the only thing those addresses carry — there is no item in the path and
 * nothing about who it was made for — so without this, naming another viewer's session served it.
 * What that leaks is which session exists and what it is playing rather than the film itself, since
 * every signed-in account may already read any item; it is somebody's viewing, and it is theirs.
 *
 * Several viewers at once, not one. A session is addressed by what it contains, so two people
 * watching the same film at the same quality share one — recording a single claimant would let the
 * second to press play throw the first out of their own stream, which is the bug two links to one
 * film already had.
 *
 * Held in memory rather than in Postgres because a session is already an in-memory, ephemeral thing:
 * a restart ends every session, and a claim that outlived one would be a claim on nothing.
 *
 * @returns The registry.
 */
const createPlaybackSessions = (): PlaybackSessions => {
  const claimed = new Map<string, Set<string>>();

  return {
    claim: (sessionId, profileId) => {
      const holding = claimed.get(sessionId);

      if (holding === undefined) {
        claimed.set(sessionId, new Set([profileId]));

        return;
      }

      holding.add(profileId);
    },

    isClaimedBy: (sessionId, profileId) => claimed.get(sessionId)?.has(profileId) ?? false,

    isHeld: (sessionId) => (claimed.get(sessionId)?.size ?? 0) > 0,

    release: (sessionId, profileId) => {
      const holding = claimed.get(sessionId);

      if (holding === undefined) {
        return;
      }

      holding.delete(profileId);

      if (holding.size === 0) {
        claimed.delete(sessionId);
      }
    },
  };
};

export type { PlaybackSessions };

export { createPlaybackSessions };
