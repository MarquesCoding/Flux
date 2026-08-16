import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { fixtureArguments } from './fixtureArguments';
import { fixtureFileName, fixturesUpTo } from './fixtureMatrix';
import type { Fixture, FixtureTier } from './fixtureMatrix';
import { fixturesDirectoryHere } from './fixturesDirectory';
import { fetchedUpTo } from './fetchedFixtures';
import type { FetchedFixture } from './fetchedFixtures';

const ManifestEntrySchema = z.object({
  name: z.string().min(1),
  file: z.string().min(1),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  licence: z.string().min(1),
  sha256: z.string().length(64),
  bytes: z.number().int().nonnegative(),
  source: z.string().optional(),
});

const ManifestSchema = z.object({
  generatedBy: z.string(),
  fixtures: z.array(ManifestEntrySchema),
});

type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

type Manifest = z.infer<typeof ManifestSchema>;

const MANIFEST_PATH = join(import.meta.dirname, '..', '..', 'fixtures.manifest.json');

const ffmpeg = (): string => process.env['FLUX_FFMPEG'] ?? 'ffmpeg';

/**
 * The version string of the FFmpeg that built the corpus.
 *
 * Recorded in the manifest because generated fixtures are only reproducible against the build that
 * produced them: an upgrade that changes an encoder's output should be visible as fixture churn
 * rather than as a checksum failure nobody can explain.
 *
 * @returns The first line of `ffmpeg -version`, or a marker when it cannot be run.
 */
const ffmpegVersion = (): string => {
  const result = spawnSync(ffmpeg(), ['-version'], { encoding: 'utf8' });

  return result.stdout.split('\n')[0]?.trim() ?? 'unknown';
};

/**
 * The SHA-256 of a file on disk.
 *
 * @param path - The file to read.
 * @returns Its digest, hex encoded.
 */
const digestOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const entryFor = (fixture: Fixture, file: string, path: string): ManifestEntry => ({
  name: fixture.name,
  file,
  tier: fixture.tier,
  licence: fixture.licence,
  sha256: digestOf(path),
  bytes: statSync(path).size,
});

/**
 * Builds one fixture, unless it is already on disk and intact.
 *
 * A build that fails takes its half-written output with it. Leaving it behind is what made a
 * previous run report two broken fixtures as present and zero bytes long, which is exactly the
 * "skipped mistaken for passed" that ADR-0012 forbids.
 *
 * @param fixture - What to build.
 * @param directory - Where the corpus lives.
 * @param force - Whether to rebuild a fixture that is already present.
 * @param recorded - What the manifest says this fixture should be, where it says anything.
 * @returns The manifest entry, or the reason it could not be built.
 */
const buildFixture = (
  fixture: Fixture,
  directory: string,
  force: boolean,
  recorded: ManifestEntry | undefined,
): { kind: 'built' | 'kept'; entry: ManifestEntry } | { kind: 'failed'; reason: string } => {
  const file = fixtureFileName(fixture);
  const path = join(directory, file);
  const present = existsSync(path) && statSync(path).size > 0;

  if (!force && present) {
    const entry = entryFor(fixture, file, path);

    if (recorded !== undefined && recorded.sha256 !== entry.sha256) {
      return {
        kind: 'failed',
        reason: [
          'checksum does not match the manifest.',
          `  manifest ${recorded.sha256}`,
          `  on disk  ${entry.sha256}`,
          '  Rebuild it with --force if the FFmpeg build changed, or delete it if it was tampered with.',
        ].join('\n'),
      };
    }

    return { kind: 'kept', entry };
  }

  const result = spawnSync(ffmpeg(), fixtureArguments(fixture, path), { encoding: 'utf8' });

  if (result.status !== 0 || !existsSync(path) || statSync(path).size === 0) {
    if (existsSync(path)) {
      rmSync(path);
    }

    return {
      kind: 'failed',
      reason: result.stderr.trim().split('\n').slice(-3).join('\n'),
    };
  }

  return { kind: 'built', entry: entryFor(fixture, file, path) };
};

/**
 * Reads the tier a run was asked for.
 *
 * @param argv - The process arguments.
 * @returns The highest tier to build.
 */
const requestedTier = (argv: readonly string[]): FixtureTier => {
  const flag = argv.indexOf('--tier');
  const value = flag === -1 ? '' : (argv[flag + 1] ?? '');

  return value === '1' ? 1 : value === '2' ? 2 : 0;
};

/**
 * Fetches one fixture that cannot be generated, unless it is already on disk and intact.
 *
 * A checksum mismatch is a hard failure rather than a warning, as ADR-0012 requires, because the
 * bytes are coming from somebody else's server and a silent substitution is the thing a checksum
 * exists to catch.
 *
 * @param fixture - What to fetch.
 * @param directory - Where the corpus lives.
 * @param force - Whether to fetch again over a file already present.
 * @param recorded - What the manifest says this fixture should be, where it says anything.
 * @returns The manifest entry, or the reason it could not be fetched.
 */
const fetchFixture = async (
  fixture: FetchedFixture,
  directory: string,
  force: boolean,
  recorded: ManifestEntry | undefined,
): Promise<
  { kind: 'built' | 'kept'; entry: ManifestEntry } | { kind: 'failed'; reason: string }
> => {
  const path = join(directory, fixture.file);

  const describe = (): ManifestEntry => ({
    name: fixture.name,
    file: fixture.file,
    tier: fixture.tier,
    licence: fixture.licence,
    sha256: digestOf(path),
    bytes: statSync(path).size,
    source: fixture.url,
  });

  if (!force && existsSync(path) && statSync(path).size > 0) {
    const entry = describe();

    if (recorded !== undefined && recorded.sha256 !== entry.sha256) {
      return {
        kind: 'failed',
        reason: `checksum does not match the manifest.\n  manifest ${recorded.sha256}\n  on disk  ${entry.sha256}`,
      };
    }

    return { kind: 'kept', entry };
  }

  try {
    const response = await fetch(fixture.url);

    if (!response.ok) {
      return { kind: 'failed', reason: `${fixture.url} answered ${response.status.toString()}` };
    }

    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return { kind: 'failed', reason: `${fixture.url} could not be reached: ${String(error)}` };
  }

  if (statSync(path).size === 0) {
    rmSync(path);

    return { kind: 'failed', reason: `${fixture.url} returned nothing` };
  }

  return { kind: 'built', entry: describe() };
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const tier = requestedTier(argv);
  const force = argv.includes('--force');
  const directory = fixturesDirectoryHere();

  mkdirSync(directory, { recursive: true });

  const recorded = new Map<string, ManifestEntry>(
    (existsSync(MANIFEST_PATH)
      ? ManifestSchema.parse(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))).fixtures
      : []
    ).map((entry) => [entry.name, entry]),
  );

  const wanted = fixturesUpTo(tier);
  const entries: ManifestEntry[] = [];
  const failures: string[] = [];

  process.stdout.write(`Building ${wanted.length.toString()} fixtures into ${directory}\n`);

  for (const fixture of wanted) {
    const outcome = buildFixture(fixture, directory, force, recorded.get(fixture.name));

    if (outcome.kind === 'failed') {
      failures.push(`${fixture.name}: ${outcome.reason}`);
      process.stdout.write(`  ✗ ${fixture.name}\n`);

      continue;
    }

    entries.push(outcome.entry);
    process.stdout.write(
      `  ${outcome.kind === 'built' ? '+' : '='} ${fixture.name} (${(outcome.entry.bytes / 1024).toFixed(0)}kb)\n`,
    );
  }

  const fetched = fetchedUpTo(tier);

  if (fetched.length > 0) {
    process.stdout.write(`\nFetching ${fetched.length.toString()} fixtures nothing can generate\n`);

    for (const fixture of fetched) {
      const outcome = await fetchFixture(fixture, directory, force, recorded.get(fixture.name));

      if (outcome.kind === 'failed') {
        failures.push(`${fixture.name}: ${outcome.reason}`);
        process.stdout.write(`  ✗ ${fixture.name}\n`);

        continue;
      }

      entries.push(outcome.entry);
      process.stdout.write(
        `  ${outcome.kind === 'built' ? '↓' : '='} ${fixture.name} (${(outcome.entry.bytes / 1024).toFixed(0)}kb) — ${fixture.covers}\n`,
      );
    }
  }

  const manifest: Manifest = { generatedBy: ffmpegVersion(), fixtures: entries };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(
    `\n${entries.length.toString()} fixtures, ${(entries.reduce((total, entry) => total + entry.bytes, 0) / 1024 / 1024).toFixed(1)}mb total\n`,
  );

  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length.toString()} failed:\n${failures.join('\n\n')}\n`);
    process.exit(1);
  }
};

void main();

export type { Manifest, ManifestEntry };
