import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { mediaItem, series, share, shareVisit, user } from '@FluxServer/db/Schema';
import { isShareLive } from '@FluxContracts/schemas/Share';
import { hashShareToken, makeShareToken } from './shareToken';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { AdminShare, Share, ShareKind } from '@FluxContracts/schemas/Share';
import type { ResolvedShare, ShareService } from './ShareService';

const LIMIT = 500;

const GONE = 'Something no longer here';

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
 * The columns every listing reads, including how far a link has been used.
 *
 * The count is asked for with `$count` rather than written out as a correlated subquery, because
 * Drizzle omits table qualifiers in a select over one table: a hand-written
 * `where "shareId" = "id"` then resolves both names against the subquery's own table rather than
 * the share outside it, and counts nothing at all. It is right by accident in a query that
 * happens to join, which is exactly how it stayed wrong in one listing and not the other.
 *
 * @param db - The database, which is what knows how to build the count.
 * @returns The selection both listings read.
 */
const columnsFor = (db: FluxDatabase) => ({
  id: share.id,
  kind: share.kind,
  mediaItemId: share.mediaItemId,
  seriesId: share.seriesId,
  createdAt: share.createdAt,
  expiresAt: share.expiresAt,
  viewCap: share.viewCap,
  revokedAt: share.revokedAt,
  views: db.$count(shareVisit, eq(shareVisit.shareId, share.id)),
});

type ShareRow = {
  id: string;
  kind: string;
  mediaItemId: string | null;
  seriesId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  viewCap: number | null;
  revokedAt: Date | null;
  views: number;
};

/**
 * The links somebody has handed out, held in Postgres. Tokens are stored hashed and never read
 * back — resolving a link hashes what arrived and looks for the match, so a copy of the database is
 * not a set of working keys to the library.
 *
 * @param db - The database to read and write.
 * @returns The share service.
 */
const createDatabaseShareService = (db: FluxDatabase): ShareService => {
  const COLUMNS = columnsFor(db);

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

  const describe = async (row: ShareRow, now: Date): Promise<Share | null> => {
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
      title: (await titleOf(kind, subjectId)) ?? GONE,
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
        .select(COLUMNS)
        .from(share)
        .where(eq(share.createdBy, createdBy))
        .orderBy(desc(share.createdAt))
        .limit(LIMIT);

      const now = new Date();
      const described = await Promise.all(rows.map(async (row) => describe(row, now)));

      return described.filter((one) => one !== null);
    },

    listEverybody: async () => {
      const rows = await db
        .select({ ...COLUMNS, createdBy: share.createdBy, createdByName: user.name })
        .from(share)
        .innerJoin(user, eq(user.id, share.createdBy))
        .orderBy(desc(share.createdAt))
        .limit(LIMIT);

      const now = new Date();

      const described = await Promise.all(
        rows.map(async (row) => {
          const one = await describe(row, now);

          return one === null
            ? null
            : ({
                ...one,
                createdBy: row.createdBy,
                createdByName: row.createdByName,
              } satisfies AdminShare);
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

    revokeAnybody: async (shareId) => {
      const changed = await db
        .update(share)
        .set({ revokedAt: new Date() })
        .where(and(eq(share.id, shareId), isNull(share.revokedAt)))
        .returning({
          createdBy: share.createdBy,
          kind: share.kind,
          mediaItemId: share.mediaItemId,
          seriesId: share.seriesId,
        });

      const row = changed[0];

      if (row === undefined) {
        return null;
      }

      const kind = readKind(row.kind);
      const subjectId = row.mediaItemId ?? row.seriesId;

      const title = kind === null || subjectId === null ? null : await titleOf(kind, subjectId);

      return { createdBy: row.createdBy, title: title ?? GONE };
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
        title: (await titleOf(kind, subjectId)) ?? GONE,
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

export { createDatabaseShareService, columnsFor, LIMIT };
