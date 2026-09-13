import { homedir } from 'node:os';
import { join } from 'node:path';

type FixturesDirectoryOptions = {
  configured: string | undefined;
  home: string;
};

/**
 * Where the corpus lives.
 *
 * Outside the working tree, always. The bytes stay out of the repository so that cloning
 * stays fast for the majority who never touch the media pipeline, and a cache inside the tree would
 * give that back the first time somebody forgot to ignore it.
 *
 * @param options - An explicit location, and the home directory to fall back beneath.
 * @returns The directory fixtures are built into and read from.
 */
const fixturesDirectory = ({ configured, home }: FixturesDirectoryOptions): string => {
  const named = configured?.trim() ?? '';

  return named.length > 0 ? named : join(home, '.cache', 'valence-fixtures');
};

/**
 * Where the corpus lives on this machine.
 *
 * @returns The directory, honouring `VALENCE_FIXTURES_DIR` where it is set.
 */
const fixturesDirectoryHere = (): string =>
  fixturesDirectory({ configured: process.env['VALENCE_FIXTURES_DIR'], home: homedir() });

export { fixturesDirectory, fixturesDirectoryHere };
