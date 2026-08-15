import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';

type ArtworkUsage = {
  count: number;
  bytes: number;
  atMs: number;
};

type CreateArtworkUsageOptions = {
  directory: string;
  everyMs?: number;
};

const AT_ONCE = 32;

const HOUR = 60 * 60 * 1000;

/**
 * How much disk the cached artwork is taking.
 */
const createArtworkUsage = ({ directory, everyMs = HOUR }: CreateArtworkUsageOptions) => {
  let last: ArtworkUsage | null = null;

  const measure = async (): Promise<ArtworkUsage> => {
    const names: string[] = await readdir(directory).catch(() => []);

    const sizes = await mapWithLimit(names, AT_ONCE, async (name) => {
      const found = await stat(join(directory, name)).catch(() => null);

      return found !== null && found.isFile() ? found.size : null;
    });

    return {
      count: names.filter((name, at) => sizes[at] !== null && !name.endsWith('.type')).length,
      bytes: sizes.reduce((total: number, size) => total + (size ?? 0), 0),
      atMs: Date.now(),
    };
  };

  return {
    read: (): ArtworkUsage | null => last,

    refresh: async (): Promise<ArtworkUsage> => {
      last = await measure();

      return last;
    },

    watch: (): (() => void) => {
      const timer = setInterval(() => {
        void measure().then((usage) => {
          last = usage;
        });
      }, everyMs);

      timer.unref();

      return () => {
        clearInterval(timer);
      };
    },
  };
};

export { createArtworkUsage };
