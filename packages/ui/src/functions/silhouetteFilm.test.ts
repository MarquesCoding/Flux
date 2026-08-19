import { describe, expect, it } from 'vitest';
import { silhouetteFilm } from './silhouetteFilm';

const COLUMNS = 80;

const ROWS = 45;

/**
 * Reads one frame of the film onto a grid of the given shape.
 *
 * @param seconds - How far into the film to look.
 * @param columns - How many dots across.
 * @param rows - How many dots down.
 * @returns How lit each dot is, in row order.
 */
const frameOf = (seconds: number, columns = COLUMNS, rows = ROWS): Float32Array => {
  const lifts = new Float32Array(columns * rows);

  silhouetteFilm.lift(lifts, columns, rows, seconds);

  return lifts;
};

describe('silhouetteFilm', () => {
  it('knows how long it runs for, so whatever is playing it knows when to stop', () => {
    expect(silhouetteFilm.seconds).toBeGreaterThan(45);
  });

  it('writes a brightness for every dot it was given', () => {
    const lifts = frameOf(10);

    expect(lifts).toHaveLength(COLUMNS * ROWS);
    expect(lifts.some((lift) => lift > 0)).toBe(true);
  });

  it('leaves the dots either side of the picture dark, rather than stretching it across them', () => {
    const lifts = frameOf(10, 200, 45);
    const middle = Math.floor(45 / 2) * 200;

    expect(lifts[middle]).toBe(0);
    expect(lifts[middle + 199]).toBe(0);
  });

  it('fills a grid of the picture-s own shape edge to edge', () => {
    const lifts = frameOf(2, 60, 45);
    const row = Math.floor(45 / 2) * 60;

    expect(lifts.slice(row, row + 60).some((lift) => lift > 0)).toBe(true);
  });

  it('draws the same picture whatever the grid it is drawn on', () => {
    const coarse = frameOf(30, 40, 30);
    const fine = frameOf(30, 80, 60);
    const litOf = (lifts: Float32Array) =>
      lifts.reduce((total, lift) => total + lift, 0) / lifts.length;

    expect(litOf(coarse)).toBeCloseTo(litOf(fine), 1);
  });

  it('survives a grid one dot tall rather than dividing by nothing', () => {
    const lifts = frameOf(10, 8, 1);

    expect(lifts.every((lift) => Number.isFinite(lift))).toBe(true);
  });

  it('writes over the frame before it rather than adding to it', () => {
    const lifts = new Float32Array(COLUMNS * ROWS).fill(1);

    silhouetteFilm.lift(lifts, COLUMNS, ROWS, 10);

    expect(lifts.some((lift) => lift === 0)).toBe(true);
  });
});
