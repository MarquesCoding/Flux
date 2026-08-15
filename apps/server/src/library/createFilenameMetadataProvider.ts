import { readTitleFromPath } from './readTitleFromPath';
import type { MetadataProvider } from './MetadataProvider';

/**
 * The provider Flux ships with.
 */
const createFilenameMetadataProvider = (): MetadataProvider => ({
  name: 'filename',
  describe: (facts) => Promise.resolve(readTitleFromPath(facts.path)),
});

export { createFilenameMetadataProvider };
