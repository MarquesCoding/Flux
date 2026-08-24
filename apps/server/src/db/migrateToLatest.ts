import { planMigration } from '@ValenceServer/db/planMigration';
import type { MigrationPlan } from '@ValenceServer/db/planMigration';

type MigrateToLatestOptions = {
  pending: () => Promise<readonly string[]>;
  apply: () => Promise<void>;
  isAllowed: boolean;
  say: (level: 'info' | 'error', line: string) => void;
};

/**
 * Brings a database up to the migrations this release carries, before anything reads it.
 *
 * The order is the point. A scan is enqueued as soon as the job queue starts, and a scan against a
 * half-migrated schema is the failure this exists to prevent — `column "probeVersion" does not
 * exist` and `relation "book" does not exist` are both on record. So this runs ahead of the queue
 * rather than beside it, and a failure to migrate stops the server rather than letting it come up
 * to serve errors from the tables that moved.
 *
 * Safe to run unattended because of ADR-0006: one box, one container, one server, so there is no
 * second instance to race. Drizzle takes a lock regardless.
 *
 * @param pending - Reads which migrations this database has not run.
 * @param apply - Runs them.
 * @param isAllowed - Whether this server may apply them itself.
 * @param say - Where to report what happened.
 * @returns What it decided to do.
 * @throws If the migrations could not be applied, since coming up on a schema that half moved is
 * worse than not coming up.
 */
const migrateToLatest = async ({
  pending,
  apply,
  isAllowed,
  say,
}: MigrateToLatestOptions): Promise<MigrationPlan> => {
  const plan = planMigration({ pending: await pending(), isAllowed });

  if (plan.kind === 'inStep') {
    return plan;
  }

  if (plan.kind === 'refuse') {
    say('error', plan.saying);

    return plan;
  }

  say('info', plan.saying);

  await apply();

  say('info', `The database is up to date with this release.`);

  return plan;
};

export type { MigrateToLatestOptions };

export { migrateToLatest };
