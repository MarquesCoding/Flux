/**
 * Says what generating a migration produced on a tree that should have had nothing left to produce.
 *
 * A snapshot is what `drizzle-kit generate` diffs the schema against, so a missing one does not
 * announce itself: generation succeeds, and the migration it writes recreates everything added since
 * the last snapshot it can see. That SQL reads plausibly. Applying it against a populated database
 * fails on the first `CREATE TABLE`, or half-applies if the statements are run one at a time.
 *
 * Migrations written by hand are what leaves the gap, because nothing then asks drizzle-kit for a
 * snapshot at all. This is the check that a hand-written migration was accompanied by one.
 *
 * @param produced - Paths generating created, relative to the migrations directory.
 * @returns What to say and fail with, or nothing where the tree was already in step.
 */
const describeSnapshotDrift = (produced: readonly string[]): string | null => {
  if (produced.length === 0) {
    return null;
  }

  const listed = [...produced].sort().map((one) => `  ${one}`);

  return [
    'Generating a migration on a clean tree produced files, which means the newest snapshot in',
    'drizzle/meta does not describe the current schema. Whatever generate writes next will recreate',
    'everything added since the last snapshot it can see.',
    '',
    ...listed,
    '',
    'A migration written by hand needs a snapshot written beside it. Run',
    '',
    '  pnpm --filter @valence/server db:generate',
    '',
    'and commit the snapshot it leaves in drizzle/meta, keeping your own SQL rather than the SQL it',
    'generates. See VAL-193.',
  ].join('\n');
};

export { describeSnapshotDrift };
