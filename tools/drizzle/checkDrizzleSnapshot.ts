import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describeSnapshotDrift } from './describeSnapshotDrift';

const ROOT = join(import.meta.dirname, '..', '..');

const SERVER = join(ROOT, 'apps', 'server');

const MIGRATIONS = join(SERVER, 'drizzle');

const JOURNAL = join(MIGRATIONS, 'meta', '_journal.json');

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * Every migration and snapshot presently on disk, as paths relative to the migrations directory.
 *
 * @returns The paths, sorted.
 */
const whatIsThere = (): string[] =>
  readdirSync(MIGRATIONS, { recursive: true, withFileTypes: true })
    .filter((one) => one.isFile())
    .map((one) => relative(MIGRATIONS, join(one.parentPath, one.name)))
    .sort();

/**
 * Asks drizzle-kit to generate, which writes nothing when the newest snapshot already describes the
 * schema.
 *
 * Generating needs no database — it diffs the schema against the snapshot on disk — so the address
 * is deliberately one nothing answers on, rather than letting a developer's own `.env` decide
 * whether this check can run.
 *
 * @throws If drizzle-kit could not be run at all.
 */
const generate = (): void => {
  const outcome = spawnSync('npx', ['drizzle-kit', 'generate'], {
    cwd: SERVER,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'postgres://nobody:nobody@127.0.0.1:1/nothing' },
  });

  if (outcome.error !== undefined) {
    throw new Error('drizzle-kit could not be run, so the snapshot could not be checked.');
  }
};

/**
 * Checks that the newest snapshot in `drizzle/meta` still describes the schema.
 *
 * Generating on a tree that is in step writes nothing at all, so anything it produces here is a
 * snapshot somebody did not commit — most often because the migration beside it was written by hand.
 * See VAL-193 for what that costs: generation stays silent and starts recreating tables that already
 * exist.
 *
 * Whatever generating wrote is removed again, and the journal put back as it was, so that running
 * this leaves the tree exactly as it found it whether it passes or fails.
 */
const checkDrizzleSnapshot = (): void => {
  const before = whatIsThere();
  const journal = readFileSync(JOURNAL, 'utf8');

  generate();

  const produced = whatIsThere().filter((one) => !before.includes(one));

  for (const one of produced) {
    rmSync(join(MIGRATIONS, one), { force: true });
  }

  writeFileSync(JOURNAL, journal);

  const drift = describeSnapshotDrift(produced);

  if (drift === null) {
    say('The newest Drizzle snapshot still describes the schema.');

    return;
  }

  process.exitCode = 1;
  process.stderr.write(`${drift}\n`);
};

checkDrizzleSnapshot();
