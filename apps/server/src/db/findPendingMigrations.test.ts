import { describe, expect, it } from 'vitest';
import { findPendingMigrations } from './findPendingMigrations';

const journalOf = (...entries: { tag: string; when: number }[]) =>
  Promise.resolve(JSON.stringify({ version: '7', dialect: 'postgresql', entries }));

const ADD_COLUMN = { tag: '0037_glorious_dragon_man', when: 1787078328497 };

const REPROBE = { tag: '0038_reprobe_open_gop_copyability', when: 1787091219684 };

describe('findPendingMigrations', () => {
  it('names nothing where the database has run everything the repository carries', async () => {
    const pending = await findPendingMigrations({
      readJournal: () => journalOf(ADD_COLUMN, REPROBE),
      readAppliedAt: () => Promise.resolve([ADD_COLUMN.when, REPROBE.when]),
    });

    expect(pending).toEqual([]);
  });

  it('names the one a database a release behind has not run', async () => {
    const pending = await findPendingMigrations({
      readJournal: () => journalOf(ADD_COLUMN, REPROBE),
      readAppliedAt: () => Promise.resolve([ADD_COLUMN.when]),
    });

    expect(pending).toEqual([REPROBE.tag]);
  });

  it('names them oldest first, which is the order they have to be run in', async () => {
    const pending = await findPendingMigrations({
      readJournal: () => journalOf(REPROBE, ADD_COLUMN),
      readAppliedAt: () => Promise.resolve([]),
    });

    expect(pending).toEqual([ADD_COLUMN.tag, REPROBE.tag]);
  });

  it('says nothing about a stamp the database holds that the repository does not', async () => {
    const pending = await findPendingMigrations({
      readJournal: () => journalOf(ADD_COLUMN),
      readAppliedAt: () => Promise.resolve([ADD_COLUMN.when, 1700000000000]),
    });

    expect(pending).toEqual([]);
  });

  it('refuses a journal it cannot read rather than reporting everything as pending', async () => {
    await expect(
      findPendingMigrations({
        readJournal: () => Promise.resolve('{"entries":[{"tag":42}]}'),
        readAppliedAt: () => Promise.resolve([]),
      }),
    ).rejects.toThrow();
  });
});
