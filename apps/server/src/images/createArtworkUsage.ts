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
  /**
   * How often to count. Artwork arrives at the speed a library is scanned, so
   * a figure an hour old is as good as a live one and costs a thousandth as
   * much to keep.
   */
  everyMs?: number;
};

/**
 * How many files to ask about at once.
 *
 * A library of a few thousand items is a few thousand `stat` calls. All at
 * once exhausts the file handles the process is allowed; one at a time takes
 * long enough to be worth avoiding even on a timer.
 */
const AT_ONCE = 32;

const HOUR = 60 * 60 * 1000;

/**
 * How much disk the cached artwork is taking.
 *
 * Artwork is the one part of what Flux hoards that the media service cannot
 * see: posters are fetched and kept by this server, not by the transcoder, so
 * the figure has to be counted here and joined to the rest on the page.
 *
 * Counted on a timer and remembered, never on the request that asks for it.
 * The point of the section this feeds is to show what the cache costs, and a
 * section that walks a disk every time somebody opens the dashboard would cost
 * more than the thing it is reporting on.
 *
 * Nothing until the first count finishes, so a server that has just started
 * says it is still counting rather than claiming there is no artwork.
 *
 * `refresh` counts once and now, so the first reading does not wait an hour
 * for the timer. `watch` keeps counting and answers with the way to stop; its
 * timer is unreferenced, because a server that will not shut down while it
 * measures its posters is a worse problem than an unmeasured poster.
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
export type { ArtworkUsage };
