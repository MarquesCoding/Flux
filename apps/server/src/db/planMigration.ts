type MigrationPlan =
  | { kind: 'inStep' }
  | { kind: 'apply'; pending: readonly string[]; saying: string }
  | { kind: 'refuse'; pending: readonly string[]; saying: string };

type PlanMigrationOptions = {
  pending: readonly string[];
  isAllowed: boolean;
};

const HOW_TO_MIGRATE_BY_HAND = 'docker compose exec valence node apps/server/dist/Migrate.js';

/**
 * Counts migrations in words that read the same for one as for several.
 *
 * @param pending - What is still to run.
 * @returns The count, worded.
 */
const counted = (pending: readonly string[]): string =>
  `${pending.length.toString()} migration${pending.length === 1 ? '' : 's'}`;

/**
 * Decides what to do about a database that is behind the migrations the release carries.
 *
 * Applying at startup is the whole point: an operator running the published image cannot run
 * drizzle-kit, because it is a devDependency the runtime stage never installs. A server that
 * detected the problem and named that command was describing an impossible action, and left a
 * database with a missing column to break reads of one table while the rest of the API answered
 * normally — which reads as a bug in an endpoint rather than a release that has not landed.
 *
 * Refusing has to stay available, because there is no rollback. An operator who would rather take a
 * dump first, or drive the change by hand, sets `MIGRATE_ON_START` to false and is told what is
 * waiting and how to run it — with a command that exists inside the container, which is the whole
 * complaint about the message this replaces.
 *
 * @param pending - The migrations this database has not run, oldest first.
 * @param isAllowed - Whether this server may apply them itself.
 * @returns What to do, and the line to say about it.
 */
const planMigration = ({ pending, isAllowed }: PlanMigrationOptions): MigrationPlan => {
  if (pending.length === 0) {
    return { kind: 'inStep' };
  }

  if (!isAllowed) {
    return {
      kind: 'refuse',
      pending,
      saying: `This database has not run ${counted(pending)} this release carries: ${pending.join(', ')}. MIGRATE_ON_START is false, so they have been left alone and reads of the tables they change will fail. Run them with \`${HOW_TO_MIGRATE_BY_HAND}\`, or set MIGRATE_ON_START to true and restart.`,
    };
  }

  return {
    kind: 'apply',
    pending,
    saying: `Applying ${counted(pending)} this database has not run: ${pending.join(', ')}.`,
  };
};

export type { MigrationPlan, PlanMigrationOptions };

export { HOW_TO_MIGRATE_BY_HAND, planMigration };
