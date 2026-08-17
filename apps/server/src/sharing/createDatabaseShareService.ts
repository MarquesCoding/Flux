import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { mediaItem, series, share, shareVisit } from '@FluxServer/db/Schema';
import { isShareLive } from '@FluxContracts/schemas/Share';
import { hashShareToken, makeShareToken } from './shareToken';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { Share, ShareKind } from '@FluxContracts/schemas/Share';
import type { ResolvedShare, ShareService } from './ShareService';

const LIMIT = 500;

/**
 * Reads a stored kind back as one Flux recognises, so a row written by a later version does not
 * arrive as a share of some kind this code has never heard of.
 *
 * @param stored - The kind as the column holds it.
 * @returns The kind, or null where it is not one.
 */
const readKind = (stored: string): ShareKind | null =>
  stored === 'item' || stored === 'series' ? stored : null;

/**
 * The links somebody has handed out, held in Postgres. Tokens are stored hashed and never read
 * back — resolving a link hashes what arrived and looks for the match, so a copy of the database is
 * not a set of working keys to the library.
 *
 * @param db - The database to read and write.
 * @returns The share service.
 */
const createDatabaseShareService = (db: FluxDatabase): ShareService => {
  const countViews = async (shareId: string): Promise<number> => {
    const [found] = await db
      .select({ howMany: count() })
      .from(shareVisit)
      .where(eq(shareVisit.shareId, shareId));

    return found?.howMany ?? 0;
  };

  const titleOf = async (kind: ShareKind, subjectId: string): Promise<string | null> => {
    if (kind === 'series') {
      const rows = await db
        .select({ title: series.title })
        .from(series)
        .where(eq(series.id, subjectId))
        .limit(1);

      return rows[0]?.title ?? null;
    }

    const rows = await db
      .select({ title: mediaItem.title, seriesTitle: mediaItem.seriesTitle })
      .from(mediaItem)
      .where(eq(mediaItem.id, subjectId))
      .limit(1);

    const row = rows[0];

    return row === undefined ? null : (row.seriesTitle ?? row.title);
  };

  return {
    create: async (createdBy, asked) => {
      const subjectId = asked.kind === 'item' ? asked.mediaId : asked.seriesId;

      if (subjectId === undefined) {
        return null;
      }

      const title = await titleOf(asked.kind, subjectId);

      if (title === null) {
        return null;
      }

      const token = makeShareToken();
      const id = randomUUID();
      const createdAt = new Date();
      const expiresAt =
        asked.expiresAt === null || asked.expiresAt === undefined
          ? null
          : new Date(asked.expiresAt);

      await db.insert(share).values({
        id,
        tokenHash: hashShareToken(token),
        kind: asked.kind,
        mediaItemId: asked.kind === 'item' ? subjectId : null,
        seriesId: asked.kind === 'series' ? subjectId : null,
        createdBy,
        createdAt,
        expiresAt,
        viewCap: asked.viewCap ?? null,
        revokedAt: null,
      });

      return {
        id,
        token,
        kind: asked.kind,
        mediaId: asked.kind === 'item' ? subjectId : null,
        seriesId: asked.kind === 'series' ? subjectId : null,
        title,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt === null ? null : expiresAt.toISOString(),
        viewCap: asked.viewCap ?? null,
        views: 0,
        isRevoked: false,
        isSpent: false,
      };
    },

    list: async (createdBy) => {
      const rows = await db
        .select({
          id: share.id,
          kind: share.kind,
          mediaItemId: share.mediaItemId,
          seriesId: share.seriesId,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          viewCap: share.viewCap,
          revokedAt: share.revokedAt,
          views: sql<number>`(select count(*)::int from ${shareVisit} where ${shareVisit.shareId} = ${share.id})`,
        })
        .from(share)
        .where(eq(share.createdBy, createdBy))
        .orderBy(desc(share.createdAt))
        .limit(LIMIT);

      const now = new Date();

      const described = await Promise.all(
        rows.map(async (row) => {
          const kind = readKind(row.kind);
          const subjectId = row.mediaItemId ?? row.seriesId;

          if (kind === null || subjectId === null) {
            return null;
          }

          return {
            id: row.id,
            kind,
            mediaId: row.mediaItemId,
            seriesId: row.seriesId,
            title: (await titleOf(kind, subjectId)) ?? 'Something no longer here',
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
            viewCap: row.viewCap,
            views: row.views,
            isRevoked: row.revokedAt !== null,
            isSpent: !isShareLive(
              {
                expiresAt: row.expiresAt,
                viewCap: row.viewCap,
                views: row.views,
                revokedAt: row.revokedAt,
              },
              now,
            ),
          } satisfies Share;
        }),
      );

      return described.filter((one) => one !== null);
    },

    revoke: async (createdBy, shareId) => {
      const changed = await db
        .update(share)
        .set({ revokedAt: new Date() })
        .where(and(eq(share.id, shareId), eq(share.createdBy, createdBy)))
        .returning({ id: share.id });

      return changed.length > 0;
    },

    resolve: async (token) => {
      const rows = await db
        .select()
        .from(share)
        .where(eq(share.tokenHash, hashShareToken(token)))
        .limit(1);

      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      const kind = readKind(row.kind);
      const subjectId = row.mediaItemId ?? row.seriesId;

      if (kind === null || subjectId === null) {
        return null;
      }

      return {
        id: row.id,
        kind,
        mediaId: row.mediaItemId,
        seriesId: row.seriesId,
        title: (await titleOf(kind, subjectId)) ?? 'Something no longer here',
        expiresAt: row.expiresAt,
        viewCap: row.viewCap,
        views: await countViews(row.id),
        revokedAt: row.revokedAt,
      } satisfies ResolvedShare;
    },

    join: async (shareId, joiner) => {
      await db
        .insert(shareVisit)
        .values({
          id: randomUUID(),
          shareId,
          joiner,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shareVisit.shareId, shareVisit.joiner],
          set: { lastSeenAt: new Date() },
        });
    },
  };
};

export { createDatabaseShareService, LIMIT };
