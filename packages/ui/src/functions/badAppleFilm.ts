import { readMaskFrames } from '@FluxUI/readMaskFrames';
import type { DotFieldFilm } from '@FluxUI/DotField.types';

const STAGE = 4 / 3;

/**
 * Fetches the mask, unpacks it, and hands back a film the dots can play. The mask is a separate
 * file rather than part of any bundle, so it is asked for once somebody has entered the code and
 * never on the way to anything else.
 *
 * @returns The film, and how long it runs for.
 */
const loadBadAppleFilm = async (): Promise<DotFieldFilm> => {
  const answer = await fetch(new URL('../assets/badApple.bin', import.meta.url));

  if (answer.body === null) {
    throw new Error('The mask came back empty.');
  }

  const unpacked = await new Response(
    answer.body.pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
  const mask = readMaskFrames(new Uint8Array(unpacked));

  return {
    seconds: mask.frames / mask.fps,
    lift: (lifts: Float32Array, columns: number, rows: number, seconds: number): void => {
      const bits = mask.at(Math.floor(seconds * mask.fps));
      const across = Math.min(columns, rows * STAGE);
      const left = (columns - across) / 2;

      for (let row = 0; row < rows; row += 1) {
        const down = rows <= 1 ? 0 : row / (rows - 1);
        const line = Math.round(down * (mask.height - 1)) * mask.width;

        for (let column = 0; column < columns; column += 1) {
          const along = (column - left) / across;
          const into = row * columns + column;

          lifts[into] =
            along < 0 || along > 1 ? 0 : (bits[line + Math.round(along * (mask.width - 1))] ?? 0);
        }
      }
    },
  };
};

export { loadBadAppleFilm };
