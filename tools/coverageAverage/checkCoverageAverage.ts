import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readCoverageAverage, MEASURES } from './readCoverageAverage';
import type { CoverageCounts } from './readCoverageAverage';

const ROOT = join(import.meta.dirname, '..', '..');

const PACKAGES = [
  'packages/client',
  'packages/contracts',
  'packages/core',
  'packages/plugin-sdk',
  'packages/screens',
  'packages/ui',
  'apps/server',
  'apps/web',
] as const;

const FLOOR = 90;

const MeasureSchema = z.object({ covered: z.number(), total: z.number() });

const SummarySchema = z.object({
  total: z.object({
    statements: MeasureSchema,
    branches: MeasureSchema,
    functions: MeasureSchema,
    lines: MeasureSchema,
  }),
});

/**
 * Reads one package's coverage summary, answering with nothing where it has not been written yet so
 * that every missing package can be named at once rather than one per run.
 *
 * @param path - The package, relative to the repository root.
 * @returns Its counts, or null where it has no summary.
 */
const read = (path: string): CoverageCounts | null => {
  const file = join(ROOT, path, 'coverage', 'coverage-summary.json');

  if (!existsSync(file)) {
    return null;
  }

  return SummarySchema.parse(JSON.parse(readFileSync(file, 'utf8'))).total;
};

/**
 * Writes one row of the table, in columns wide enough that the figures line up down the page.
 *
 * @param name - What the row is for.
 * @param of - Its measures and their average.
 */
const say = (name: string, of: ReturnType<typeof readCoverageAverage>) => {
  const measures = MEASURES.map((measure) => of[measure].toFixed(1).padStart(7)).join('');

  process.stdout.write(`${name.padEnd(22)}${measures}${of.average.toFixed(1).padStart(9)}\n`);
};

const found = PACKAGES.map((path) => ({ path, counts: read(path) }));
const missing = found.filter((one) => one.counts === null).map((one) => one.path);

if (missing.length > 0) {
  process.stderr.write(
    `No coverage summary for ${missing.join(', ')}. Run \`pnpm test:coverage\` first.\n`,
  );
  process.exit(1);
}

const summaries = found.flatMap((one) => (one.counts === null ? [] : [one.counts]));
const overall = readCoverageAverage(summaries);

process.stdout.write(
  `${'package'.padEnd(22)}${MEASURES.map((measure) => measure.slice(0, 5).padStart(7)).join('')}${'mean'.padStart(9)}\n`,
);

for (const { path, counts } of found) {
  if (counts !== null) {
    say(path, readCoverageAverage([counts]));
  }
}

say('everything', overall);

if (overall.average < FLOOR) {
  process.stderr.write(
    `\nCoverage averages ${overall.average.toFixed(2)}%, below the ${FLOOR.toString()}% this repository is held to.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `\nAveraging ${overall.average.toFixed(2)}%, at or above the ${FLOOR.toString()}% this repository is held to.\n`,
);
