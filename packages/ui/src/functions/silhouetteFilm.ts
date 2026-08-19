import { silhouetteAt, SILHOUETTE_SECONDS } from '@FluxUI/silhouetteAt';
import type { DotFieldFilm } from '@FluxUI/DotField.types';

const STAGE = 4 / 3;

/**
 * Reads the film onto the grid, once per frame. The stage is laid out four by three and centred, so
 * a wide screen pillarboxes it rather than stretching it, and the dots either side of it stay dark.
 *
 * @param lifts - How lit each dot is, written into in place, one number per dot in row order.
 * @param columns - How many dots there are across.
 * @param rows - How many dots there are down.
 * @param seconds - How far into the film it is.
 */
const project = (lifts: Float32Array, columns: number, rows: number, seconds: number): void => {
  const width = Math.min(columns, rows * STAGE);
  const left = (columns - width) / 2;

  for (let row = 0; row < rows; row += 1) {
    const y = rows <= 1 ? 0 : row / (rows - 1);

    for (let column = 0; column < columns; column += 1) {
      const x = (column - left) / width;

      lifts[row * columns + column] = x < 0 || x > 1 ? 0 : silhouetteAt(x, y, seconds);
    }
  }
};

const silhouetteFilm: DotFieldFilm = { seconds: SILHOUETTE_SECONDS, lift: project };

export { silhouetteFilm };
