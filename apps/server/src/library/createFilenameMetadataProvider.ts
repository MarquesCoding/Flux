import { readTitleFromPath } from './readTitleFromPath';
import type { MetadataProvider } from './MetadataProvider';

/**
 * The provider Valence ships with, which reads what it can out of the filename alone — the title, the
 * year, the season and episode. Always available and never wrong about anything it has not claimed,
 * which is what makes it the layer everything else is chosen against.
 */
const createFilenameMetadataProvider = (): MetadataProvider => ({
  name: 'filename',
  describe: (facts) => Promise.resolve(readTitleFromPath(facts.path)),
});

export { createFilenameMetadataProvider };
