import { randomUUID } from 'node:crypto';
import { isShareLive } from '@FluxContracts/schemas/Share';
import { hashShareToken, makeShareToken } from './shareToken';
import type { ShareKind } from '@FluxContracts/schemas/Share';
import type { ResolvedShare, ShareService } from './ShareService';

type MemoryShare = {
  id: string;
  tokenHash: string;
  kind: ShareKind;
  mediaId: string | null;
  seriesId: string | null;
  title: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  viewCap: number | null;
  revokedAt: Date | null;
  joiners: Set<string>;
};

type MemoryState = {
  shares: MemoryShare[];
  titles?: Record<string, string>;
};

/**
 * Links held in memory, so the routes can be exercised without Postgres. Hashes tokens exactly as
 * the database version does, since a twin that stored them plainly would let a test pass while
 * describing a server that keeps working keys in the clear.
 *
 * @param state - Any links already handed out, and the titles of what they name.
 * @returns The share service, and the state behind it.
 */
const createMemoryShareService = (
  state: MemoryState = { shares: [] },
): ShareService & { state: MemoryState } => {
  const describe = (held: MemoryShare, now: Date) => ({
    id: held.id,
    kind: held.kind,
    mediaId: held.mediaId,
    seriesId: held.seriesId,
    title: held.title,
    createdAt: held.createdAt.toISOString(),
    expiresAt: held.expiresAt === null ? null : held.expiresAt.toISOString(),
    viewCap: held.viewCap,
    views: held.joiners.size,
    isRevoked: held.revokedAt !== null,
    isSpent: !isShareLive(
      {
        expiresAt: held.expiresAt,
        viewCap: held.viewCap,
        views: held.joiners.size,
        revokedAt: held.revokedAt,
      },
      now,
    ),
  });

  return {
    state,

    create: (createdBy, asked) => {
      const subjectId = asked.kind === 'item' ? asked.mediaId : asked.seriesId;

      if (subjectId === undefined) {
        return Promise.resolve(null);
      }

      const title = state.titles?.[subjectId];

      if (title === undefined) {
        return Promise.resolve(null);
      }

      const token = makeShareToken();

      const held: MemoryShare = {
        id: randomUUID(),
        tokenHash: hashShareToken(token),
        kind: asked.kind,
        mediaId: asked.kind === 'item' ? subjectId : null,
        seriesId: asked.kind === 'series' ? subjectId : null,
        title,
        createdBy,
        createdAt: new Date(0),
        expiresAt:
          asked.expiresAt === null || asked.expiresAt === undefined
            ? null
            : new Date(asked.expiresAt),
        viewCap: asked.viewCap ?? null,
        revokedAt: null,
        joiners: new Set(),
      };

      state.shares.push(held);

      return Promise.resolve({ ...describe(held, new Date()), token });
    },

    list: (createdBy) =>
      Promise.resolve(
        state.shares
          .filter((held) => held.createdBy === createdBy)
          .map((held) => describe(held, new Date())),
      ),

    revoke: (createdBy, shareId) => {
      const held = state.shares.find((one) => one.id === shareId && one.createdBy === createdBy);

      if (held === undefined) {
        return Promise.resolve(false);
      }

      held.revokedAt = new Date();

      return Promise.resolve(true);
    },

    resolve: (token) => {
      const hash = hashShareToken(token);
      const held = state.shares.find((one) => one.tokenHash === hash);

      if (held === undefined) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id: held.id,
        kind: held.kind,
        mediaId: held.mediaId,
        seriesId: held.seriesId,
        title: held.title,
        expiresAt: held.expiresAt,
        viewCap: held.viewCap,
        views: held.joiners.size,
        revokedAt: held.revokedAt,
      } satisfies ResolvedShare);
    },

    join: (shareId, joiner) => {
      state.shares.find((one) => one.id === shareId)?.joiners.add(joiner);

      return Promise.resolve();
    },
  };
};

export type { MemoryState, MemoryShare };

export { createMemoryShareService };
