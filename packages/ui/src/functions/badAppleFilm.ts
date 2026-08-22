import { readMaskFrames } from '@ValenceUI/readMaskFrames';
import type { DotFieldFilm } from '@ValenceUI/DotField.types';

const STAGE = 4 / 3;

/**
 * Fetches the mask, unpacks it, and hands back a film the dots can play. The mask is a separate
 * file rather than part of any bundle, so it is asked for once somebody has entered the code and
 * never on the way to anything else.
 *
 * The film is four by three and the page is not, so it is laid over the whole field and cropped
 * rather than sat inside it. A border of dots that the film stops at reads as a window onto
 * something else, which is the one thing the dots being the screen cannot survive.
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
      const across = Math.max(columns, rows * STAGE);
      const high = across / STAGE;
      const left = (columns - across) / 2;
      const top = (rows - high) / 2;

      for (let row = 0; row < rows; row += 1) {
        const down = Math.floor(((row + 0.5 - top) / high) * mask.height);
        const line = Math.min(mask.height - 1, Math.max(0, down)) * mask.width;

        for (let column = 0; column < columns; column += 1) {
          const along = Math.floor(((column + 0.5 - left) / across) * mask.width);

          lifts[row * columns + column] =
            bits[line + Math.min(mask.width - 1, Math.max(0, along))] ?? 0;
        }
      }
    },
  };
};

export { loadBadAppleFilm };
