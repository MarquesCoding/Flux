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
import { derivedArguments, derivedUpTo } from './derivedFixtures';
import type { DerivedFixture } from './derivedFixtures';
import {
  baseStreamArguments,
  muxArguments,
  synthesisedUpTo,
  toolUrl,
  TOOLS,
} from './synthesisedFixtures';
import type { SynthesisedFixture } from './synthesisedFixtures';
import { dolbyVisionConfig, hdr10PlusMetadata } from './synthesisedMetadata';

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

const ffmpeg = (): string => process.env['VALENCE_FFMPEG'] ?? 'ffmpeg';

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
 * "skipped mistaken for passed" that a corpus must never allow.
 *
 * A checksum that does not match is a signal rather than a failure here, unlike a fetched fixture
 * where it means somebody else's bytes changed underneath us. These bytes are ours: they differ
 * legitimately between an arm64 laptop and an amd64 runner, and between one FFmpeg build and the
 * next. What must hold is that a fixture is what the matrix claims, and that is asserted by probing
 * it rather than by hashing it. So a mismatch rebuilds and says so.
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

    if (recorded === undefined || recorded.sha256 === entry.sha256) {
      return { kind: 'kept', entry };
    }

    process.stdout.write(
      `  ~ ${fixture.name} differs from the manifest, rebuilding (a different FFmpeg build or architecture will do this)\n`,
    );
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
 * A checksum mismatch is a hard failure rather than a warning, because the
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

/**
 * Builds one fixture out of another, when the second cannot be made from nothing.
 *
 * Skipped rather than failed when its source is absent, because the source is fetched and a
 * contributor who declined the download should not be told a build broke.
 *
 * @param fixture - What to derive.
 * @param directory - Where the corpus lives.
 * @param force - Whether to rebuild one already present.
 * @returns The manifest entry, the reason it failed, or that its source was not there.
 */
const deriveFixture = (
  fixture: DerivedFixture,
  directory: string,
  force: boolean,
):
  | { kind: 'built' | 'kept'; entry: ManifestEntry }
  | { kind: 'failed'; reason: string }
  | { kind: 'no-source' } => {
  const source = join(directory, fixture.from);
  const path = join(directory, fixture.file);

  if (!existsSync(source)) {
    return { kind: 'no-source' };
  }

  const describe = (): ManifestEntry => ({
    name: fixture.name,
    file: fixture.file,
    tier: fixture.tier,
    licence: fixture.licence,
    sha256: digestOf(path),
    bytes: statSync(path).size,
    source: fixture.from,
  });

  if (!force && existsSync(path) && statSync(path).size > 0) {
    return { kind: 'kept', entry: describe() };
  }

  const result = spawnSync(ffmpeg(), derivedArguments(fixture, source, path), {
    encoding: 'utf8',
  });

  if (result.status !== 0 || !existsSync(path) || statSync(path).size === 0) {
    if (existsSync(path)) {
      rmSync(path);
    }

    return { kind: 'failed', reason: result.stderr.trim().split('\n').slice(-2).join('\n') };
  }

  return { kind: 'built', entry: describe() };
};

const mkvmerge = (): string => process.env['VALENCE_MKVMERGE'] ?? 'mkvmerge';

/**
 * Fetches a metadata tool for this machine, unless it is already here.
 *
 * @param tool - Which tool.
 * @param directory - Where the corpus lives.
 * @returns The path to the binary, or the reason it could not be had.
 */
const fetchTool = async (
  tool: keyof typeof TOOLS,
  directory: string,
): Promise<{ kind: 'ready'; path: string } | { kind: 'failed'; reason: string }> => {
  const bin = join(directory, 'tools', TOOLS[tool].binary);

  if (existsSync(bin)) {
    return { kind: 'ready', path: bin };
  }

  const source = toolUrl(tool, process.platform, process.arch);

  if (source === null) {
    return { kind: 'failed', reason: `no ${TOOLS[tool].binary} build for ${process.platform}` };
  }

  mkdirSync(join(directory, 'tools'), { recursive: true });

  const archive = join(directory, 'tools', `${TOOLS[tool].binary}.download`);

  try {
    const response = await fetch(source.url);

    if (!response.ok) {
      return { kind: 'failed', reason: `${source.url} answered ${response.status.toString()}` };
    }

    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return { kind: 'failed', reason: `${source.url} could not be reached: ${String(error)}` };
  }

  const unpack =
    source.archive === 'zip'
      ? spawnSync('unzip', ['-oj', archive, TOOLS[tool].binary, '-d', join(directory, 'tools')], {
          encoding: 'utf8',
        })
      : spawnSync('tar', ['-xzf', archive, '-C', join(directory, 'tools')], { encoding: 'utf8' });

  rmSync(archive, { force: true });

  if (unpack.status !== 0 || !existsSync(bin)) {
    return { kind: 'failed', reason: `could not unpack ${TOOLS[tool].binary}` };
  }

  spawnSync('chmod', ['+x', bin]);

  return { kind: 'ready', path: bin };
};

/**
 * Writes the HDR metadata FFmpeg cannot author, and puts it in a container that keeps it.
 *
 * Three steps and three tools. FFmpeg encodes an HDR10 base stream; `dovi_tool` or
 * `hdr10plus_tool` writes the metadata onto it from a description rather than from any real file;
 * and mkvmerge muxes the result, because FFmpeg's own muxers lose it.
 *
 * @param fixture - What to synthesise.
 * @param directory - Where the corpus lives.
 * @param tools - Where the metadata tools were put.
 * @param force - Whether to rebuild one already present.
 * @returns The manifest entry, or the reason it could not be made.
 */
const synthesiseFixture = (
  fixture: SynthesisedFixture,
  directory: string,
  tools: { dovi: string; hdr10plus: string },
  force: boolean,
): { kind: 'built' | 'kept'; entry: ManifestEntry } | { kind: 'failed'; reason: string } => {
  const path = join(directory, fixture.file);

  const describe = (): ManifestEntry => ({
    name: fixture.name,
    file: fixture.file,
    tier: fixture.tier,
    licence: fixture.licence,
    sha256: digestOf(path),
    bytes: statSync(path).size,
  });

  if (!force && existsSync(path) && statSync(path).size > 0) {
    return { kind: 'kept', entry: describe() };
  }

  const stem = join(directory, `.synthesising-${fixture.name}`);
  const base = `${stem}.hevc`;
  const carrying = `${stem}-carrying.hevc`;
  const description = `${stem}.json`;

  const clean = () => {
    for (const file of [base, carrying, description, `${stem}.rpu`]) {
      rmSync(file, { force: true });
    }
  };

  const encoded = spawnSync(ffmpeg(), baseStreamArguments(fixture, base), { encoding: 'utf8' });

  if (encoded.status !== 0) {
    clean();

    return { kind: 'failed', reason: encoded.stderr.trim().split('\n').slice(-2).join('\n') };
  }

  if (fixture.system === 'DolbyVision') {
    writeFileSync(description, `${JSON.stringify(dolbyVisionConfig(fixture.frames), null, 2)}\n`);

    const rpu = spawnSync(tools.dovi, ['generate', '-j', description, '-o', `${stem}.rpu`], {
      encoding: 'utf8',
    });

    const injected =
      rpu.status === 0
        ? spawnSync(
            tools.dovi,
            ['inject-rpu', '-i', base, '--rpu-in', `${stem}.rpu`, '-o', carrying],
            { encoding: 'utf8' },
          )
        : rpu;

    if (injected.status !== 0) {
      clean();

      return {
        kind: 'failed',
        reason: `dovi_tool: ${injected.stderr.trim().split('\n').pop() ?? ''}`,
      };
    }
  } else {
    writeFileSync(description, `${JSON.stringify(hdr10PlusMetadata(fixture.frames))}\n`);

    const injected = spawnSync(
      tools.hdr10plus,
      ['inject', '-i', base, '-j', description, '-o', carrying],
      { encoding: 'utf8' },
    );

    if (injected.status !== 0) {
      clean();

      return {
        kind: 'failed',
        reason: `hdr10plus_tool: ${injected.stderr.trim().split('\n').pop() ?? ''}`,
      };
    }
  }

  const muxed = spawnSync(mkvmerge(), muxArguments(carrying, path), { encoding: 'utf8' });

  clean();

  if (muxed.status !== 0 || !existsSync(path) || statSync(path).size === 0) {
    rmSync(path, { force: true });

    return { kind: 'failed', reason: `mkvmerge: ${muxed.stderr.trim().split('\n').pop() ?? ''}` };
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

  const derived = derivedUpTo(tier);

  if (derived.length > 0) {
    process.stdout.write(`\nDeriving ${derived.length.toString()} fixtures from fetched ones\n`);

    for (const fixture of derived) {
      const outcome = deriveFixture(fixture, directory, force);

      if (outcome.kind === 'no-source') {
        process.stdout.write(`  · ${fixture.name} (needs ${fixture.from}, which is not here)\n`);

        continue;
      }

      if (outcome.kind === 'failed') {
        failures.push(`${fixture.name}: ${outcome.reason}`);
        process.stdout.write(`  ✗ ${fixture.name}\n`);

        continue;
      }

      entries.push(outcome.entry);
      process.stdout.write(
        `  ${outcome.kind === 'built' ? '→' : '='} ${fixture.name} (${(outcome.entry.bytes / 1024).toFixed(0)}kb) — ${fixture.covers}\n`,
      );
    }
  }

  const synthesised = synthesisedUpTo(tier);

  if (synthesised.length > 0) {
    process.stdout.write(
      `\nSynthesising ${synthesised.length.toString()} fixtures FFmpeg cannot author alone\n`,
    );

    const hasMkvmerge = spawnSync(mkvmerge(), ['--version'], { encoding: 'utf8' }).status === 0;
    const dovi = await fetchTool('dovi', directory);
    const hdr10plus = await fetchTool('hdr10plus', directory);

    if (!hasMkvmerge || dovi.kind === 'failed' || hdr10plus.kind === 'failed') {
      const missing = [
        hasMkvmerge ? '' : 'mkvmerge (install mkvtoolnix)',
        dovi.kind === 'failed' ? `dovi_tool (${dovi.reason})` : '',
        hdr10plus.kind === 'failed' ? `hdr10plus_tool (${hdr10plus.reason})` : '',
      ].filter((line) => line !== '');

      process.stdout.write(`  · skipped, needing: ${missing.join(', ')}\n`);
    } else {
      for (const fixture of synthesised) {
        const outcome = synthesiseFixture(
          fixture,
          directory,
          { dovi: dovi.path, hdr10plus: hdr10plus.path },
          force,
        );

        if (outcome.kind === 'failed') {
          failures.push(`${fixture.name}: ${outcome.reason}`);
          process.stdout.write(`  ✗ ${fixture.name}\n`);

          continue;
        }

        entries.push(outcome.entry);
        process.stdout.write(
          `  ${outcome.kind === 'built' ? '✦' : '='} ${fixture.name} (${(outcome.entry.bytes / 1024).toFixed(0)}kb) — ${fixture.covers}\n`,
        );
      }
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
