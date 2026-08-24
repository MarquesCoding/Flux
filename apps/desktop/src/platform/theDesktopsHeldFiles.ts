import { z } from 'zod';
import { HeldFileSchema } from '@ValenceContracts/schemas/HeldFile';
import type { HeldFiles } from '@ValenceClient/platform/Platform.types';

const HeldFilesSchema = z.array(HeldFileSchema).catch([]);

/**
 * What this machine is holding, asked of the process that holds it.
 *
 * Nothing here knows where a file is or how it got there. The window is not given a path, and could
 * not open one if it were: a renderer reads what its own scheme serves it and nothing else, which is
 * the point of a renderer. So a file is addressed the same way a poster or a segment is — as a path
 * on this client's own origin — and the process that owns the disk decides what that means.
 *
 * What comes back across the bridge is parsed rather than trusted. It is our own main process at the
 * other end, but it is reading a file on disk that anything with a text editor can reach, and a
 * download list that will not draw is a worse outcome than one that is short.
 *
 * @returns Where this client's files are kept.
 */
const theDesktopsHeldFiles = (): HeldFiles => {
  const { held } = window.valence;

  return {
    all: async () => HeldFilesSchema.parse(await held.all()),
    keep: async (what) => {
      await held.keep(what);
    },
    drop: async (downloadId) => {
      await held.drop(downloadId);
    },
    pause: async (downloadId, isPaused) => {
      await held.pause(downloadId, isPaused);
    },
    sourceFor: (downloadId) => `/held/${downloadId}`,
    posterFor: (downloadId) => `/held/${downloadId}/poster`,
    whenChanged: (listener) =>
      held.whenChanged((said) => {
        listener(HeldFilesSchema.parse(said));
      }),
  };
};

export { theDesktopsHeldFiles };
