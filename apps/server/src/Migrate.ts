import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase } from '@ValenceServer/db/Database';
import { findPendingMigrations } from '@ValenceServer/db/findPendingMigrations';
import { migrateToLatest } from '@ValenceServer/db/migrateToLatest';
import { readEnv } from '@ValenceServer/env/Env';

const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', 'drizzle');

const MIGRATION_JOURNAL = join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

const AppliedMigrationSchema = z.object({ created_at: z.union([z.string(), z.number()]) });

/**
 * Runs the migrations by hand, for an operator who turned off running them at startup.
 *
 * This exists because the instruction has to be performable where it is printed. `drizzle-kit` is a
 * devDependency and the runtime image installs only production dependencies, so the command the
 * server used to name could never be run by the person reading it. This one ships in the image, next
 * to the server it belongs to, and applies exactly what starting the server would have applied.
 *
 * `MIGRATE_ON_START` is deliberately not consulted. Running this is the consent that variable
 * withholds.
 */
const run = async (): Promise<void> => {
  const env = readEnv(process.env);
  const { db, pool } = createDatabase(env.DATABASE_URL);

  try {
    await migrateToLatest({
      pending: () =>
        findPendingMigrations({
          readJournal: () => readFile(MIGRATION_JOURNAL, 'utf8'),
          readAppliedAt: async () => {
            const applied = await db.execute(
              sql`select created_at from drizzle.__drizzle_migrations`,
            );

            return applied.rows.map((row) => Number(AppliedMigrationSchema.parse(row).created_at));
          },
        }),
      apply: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      isAllowed: true,
      say: (_level, line) => {
        process.stdout.write(`${line}\n`);
      },
    });
  } finally {
    await pool.end();
  }
};

try {
  await run();
} catch (problem) {
  process.stderr.write(
    `The migrations could not be applied: ${problem instanceof Error ? problem.message : 'no reason given'}\n`,
  );
  process.exitCode = 1;
}
