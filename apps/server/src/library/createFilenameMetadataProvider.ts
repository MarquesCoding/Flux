import { readTitleFromPath } from './readTitleFromPath';
import type { MetadataProvider } from './MetadataProvider';

/**
 * The provider Flux ships with.
 *
 * Reads a title and year from the filename. Always answers, so it belongs last
 * in the list: a plugin that knows better should be asked first.
 */
const createFilenameMetadataProvider = (): MetadataProvider => ({
  name: 'filename',
  describe: (facts) => Promise.resolve(readTitleFromPath(facts.path)),
});

export { createFilenameMetadataProvider };
