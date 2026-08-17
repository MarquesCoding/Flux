import { and, count, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { logRecord } from '@FluxServer/db/Schema';
import { LogLevelSchema, LogSourceSchema } from '@FluxContracts/schemas/Log';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { LogQuery, LogRecord } from '@FluxContracts/schemas/Log';
import type { LogStore, StoredLog } from './Logger';

type Row = typeof logRecord.$inferSelect;

const asRecord = (row: Row): LogRecord => ({
  id: row.id,
  atMs: row.at.getTime(),
  level: LogLevelSchema.catch('info').parse(row.level),
  source: LogSourceSchema.catch('server').parse(row.source),
  message: row.message,
  detail: row.detail,
  count: row.count,
  context: {
    jobId: row.jobId,
    jobKind: row.jobKind,
    libraryId: row.libraryId,
    mediaId: row.mediaId,
    sessionId: row.sessionId,
    requestId: row.requestId,
  },
});

/**
 * Keeps log records in Postgres, where they can be searched with the tools already in use rather
 * than needing a reading path of their own.
 *
 * Reads are bounded and ordered newest first, because the question an operator has is almost always
 * about what just happened, and an unbounded query against a table that grows all day is its own
 * outage.
 *
 * @param db - The database.
 * @returns The store.
 */
const createDatabaseLogStore = (db: FluxDatabase): LogStore => ({
  save: async (records: readonly StoredLog[]) => {
    if (records.length === 0) {
      return;
    }

    await db.insert(logRecord).values(
      records.map((record) => ({
        id: record.id,
        at: new Date(record.atMs),
        level: record.level,
        source: record.source,
        message: record.message,
        detail: record.detail,
        count: 1,
        sameEventKey: record.sameEventKey,
        jobId: record.context.jobId,
        jobKind: record.context.jobKind,
        libraryId: record.context.libraryId,
        mediaId: record.context.mediaId,
        sessionId: record.context.sessionId,
        requestId: record.context.requestId,
        forgetAfter: new Date(record.forgetAfterMs),
      })),
    );
  },

  countAgain: async (ids: readonly string[]) => {
    if (ids.length === 0) {
      return;
    }

    const tally = new Map<string, number>();

    for (const id of ids) {
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }

    for (const [id, more] of tally) {
      await db
        .update(logRecord)
        .set({ count: sql`${logRecord.count} + ${more}` })
        .where(eq(logRecord.id, id));
    }
  },

  read: async (query: LogQuery) => {
    const wheres = [
      query.levels.length === 0 ? undefined : inArray(logRecord.level, [...query.levels]),
      query.sources.length === 0 ? undefined : inArray(logRecord.source, [...query.sources]),
      query.search === ''
        ? undefined
        : sql`${logRecord.message} ILIKE ${`%${query.search}%`} OR ${logRecord.detail} ILIKE ${`%${query.search}%`}`,
      query.sinceMs === null ? undefined : gte(logRecord.at, new Date(query.sinceMs)),
      query.untilMs === null ? undefined : lte(logRecord.at, new Date(query.untilMs)),
      query.jobId === null ? undefined : eq(logRecord.jobId, query.jobId),
    ].filter((one) => one !== undefined);

    const where = wheres.length === 0 ? undefined : and(...wheres);

    const rows = await db
      .select()
      .from(logRecord)
      .where(where)
      .orderBy(desc(logRecord.at))
      .limit(query.limit);

    const [counted] = await db.select({ total: count() }).from(logRecord).where(where);

    return { records: rows.map(asRecord), total: Number(counted?.total ?? 0) };
  },

  forgetExpired: async (nowMs: number) => {
    const gone = await db
      .delete(logRecord)
      .where(lt(logRecord.forgetAfter, new Date(nowMs)))
      .returning({ id: logRecord.id });

    return gone.length;
  },
});

export { createDatabaseLogStore };
