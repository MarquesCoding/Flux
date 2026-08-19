import { z } from 'zod';

const JournalSchema = z.object({
  entries: z.array(z.object({ tag: z.string().min(1), when: z.number().int() })),
});

type FindPendingMigrationsOptions = {
  readJournal: () => Promise<string>;
  readAppliedAt: () => Promise<readonly number[]>;
};

/**
 * Names the migrations the repository carries that this database has not run.
 *
 * A migration that adds a column the code already selects breaks reads of that table and nothing
 * else, which reads as a bug in the endpoint rather than a database a release behind — `videoRangeBase`
 * cost an evening that way. Drizzle stamps each applied migration with the `when` its journal entry
 * carries, so the two can simply be compared.
 *
 * @param readJournal - How to read the migration journal drizzle writes beside the SQL.
 * @param readAppliedAt - How to read the stamps of the migrations this database has run.
 * @returns The tags of the migrations still to run, oldest first, or nothing where it is in step.
 */
const findPendingMigrations = async ({
  readJournal,
  readAppliedAt,
}: FindPendingMigrationsOptions): Promise<readonly string[]> => {
  const journal = JournalSchema.parse(JSON.parse(await readJournal()));
  const applied = new Set(await readAppliedAt());

  return journal.entries
    .filter((entry) => !applied.has(entry.when))
    .sort((left, right) => left.when - right.when)
    .map((entry) => entry.tag);
};

export type { FindPendingMigrationsOptions };

export { findPendingMigrations };
