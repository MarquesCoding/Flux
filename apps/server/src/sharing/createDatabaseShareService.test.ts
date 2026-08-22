import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '@ValenceServer/db/Database';
import { mediaItem, series, share, user } from '@ValenceServer/db/Schema';
import { columnsFor } from './createDatabaseShareService';

const NOWHERE = 'postgres://nobody@localhost:1/none';

/**
 * Builds the queries without running them. A pool connects at its first query and these never make
 * one, so the SQL can be read on a machine with no Postgres — which is what this is about, since the
 * fault was in the text of the query rather than in anything the database did with it.
 */
const asked = () => {
  const { db } = createDatabase(NOWHERE);

  const mine = db
    .select(columnsFor(db))
    .from(share)
    .leftJoin(mediaItem, eq(mediaItem.id, share.mediaItemId))
    .leftJoin(series, eq(series.id, share.seriesId))
    .where(eq(share.createdBy, 'ada'))
    .toSQL().sql;

  const everybody = db
    .select({ ...columnsFor(db), createdByName: user.name })
    .from(share)
    .innerJoin(user, eq(user.id, share.createdBy))
    .leftJoin(mediaItem, eq(mediaItem.id, share.mediaItemId))
    .leftJoin(series, eq(series.id, share.seriesId))
    .toSQL().sql;

  return { mine, everybody };
};

describe('counting how far a link has been used', () => {
  it('correlates the count to the share outside it, in a query over one table', () => {
    expect(asked().mine).toContain('"share"."id"');
  });

  it('does the same in a query that joins, so both listings agree', () => {
    expect(asked().everybody).toContain('"share"."id"');
  });

  it('never compares the visit’s own columns to each other, which counts nothing at all', () => {
    const { mine, everybody } = asked();

    expect(mine).not.toMatch(/where "shareId" = "id"/);
    expect(everybody).not.toMatch(/where "shareId" = "id"/);
  });

  it('reads the visits rather than any other table', () => {
    expect(asked().mine).toContain('"share_visit"');
  });
});

describe('reading what a link points at', () => {
  it('joins the title rather than asking once per link', () => {
    const { mine } = asked();

    expect(mine).toContain('"media_item"."title"');
    expect(mine).toContain('"series"."title"');
  });

  it('reaches both kinds of subject from one query, since a listing holds either', () => {
    const { mine } = asked();

    expect(mine).toContain('left join "media_item"');
    expect(mine).toContain('left join "series"');
  });

  it('joins them for everybody’s links too, which is the longer list of the two', () => {
    const { everybody } = asked();

    expect(everybody).toContain('left join "media_item"');
    expect(everybody).toContain('left join "series"');
  });
});
