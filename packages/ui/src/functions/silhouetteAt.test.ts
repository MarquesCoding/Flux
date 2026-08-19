import { describe, expect, it } from 'vitest';
import { silhouetteAt, SILHOUETTE_SECONDS } from './silhouetteAt';

const COLUMNS = 61;

const ROWS = 45;

/**
 * Reads a whole frame and says how much of it is lit, which is how every question here is asked:
 * what a single point does is an implementation detail, what the frame looks like is not.
 *
 * @param seconds - How far into the film to look.
 * @returns The share of the frame that is lit, from nothing to one.
 */
const litAt = (seconds: number): number => {
  let total = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      total += silhouetteAt(column / (COLUMNS - 1), row / (ROWS - 1), seconds);
    }
  }

  return total / (COLUMNS * ROWS);
};

/**
 * How much of the frame changed between two moments, point by point rather than by how much of it
 * was lit, since a pattern can slide right across the frame without lighting one more dot.
 *
 * @param seconds - The moment to look at.
 * @param later - The moment to compare it with.
 * @returns The share of the frame that changed, from nothing to one.
 */
const movedBetween = (seconds: number, later: number): number => {
  let total = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const x = column / (COLUMNS - 1);
      const y = row / (ROWS - 1);

      total += Math.abs(silhouetteAt(x, y, seconds) - silhouetteAt(x, y, later));
    }
  }

  return total / (COLUMNS * ROWS);
};

const DURING = [1, 4, 9, 15, 19, 23, 26, 31, 36, 40, 44, 47, 50];

describe('silhouetteAt', () => {
  it('runs for the better part of a minute', () => {
    expect(SILHOUETTE_SECONDS).toBeGreaterThan(45);
    expect(SILHOUETTE_SECONDS).toBeLessThan(60);
  });

  it('answers with a brightness and never with anything outside one', () => {
    for (const seconds of DURING) {
      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLUMNS; column += 1) {
          const lit = silhouetteAt(column / (COLUMNS - 1), row / (ROWS - 1), seconds);

          expect(lit).toBeGreaterThanOrEqual(0);
          expect(lit).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('has something on screen at every point of the film', () => {
    for (const seconds of DURING) {
      expect(litAt(seconds)).toBeGreaterThan(0.01);
    }
  });

  it('never lights half the frame, which is what makes it safe to watch', () => {
    for (const seconds of DURING) {
      expect(litAt(seconds)).toBeLessThan(0.5);
    }
  });

  it('holds the picture still between frames rather than flashing', () => {
    let worst = 0;
    let before = litAt(20);

    for (let step = 1; step <= 30; step += 1) {
      const now = litAt(20 + step / 30);

      worst = Math.max(worst, Math.abs(now - before));
      before = now;
    }

    expect(worst).toBeLessThan(0.1);
  });

  it('moves, which is the whole point of it being a film', () => {
    for (const seconds of DURING) {
      expect(movedBetween(seconds, seconds + 0.2)).toBeGreaterThan(0.01);
    }
  });

  it('cuts between shots rather than dissolving', () => {
    expect(Math.abs(litAt(6.8) - litAt(7.1))).toBeGreaterThan(0.02);
  });

  it('is dark once it has finished, and stays dark', () => {
    expect(litAt(SILHOUETTE_SECONDS)).toBeLessThan(0.01);
    expect(litAt(SILHOUETTE_SECONDS + 30)).toBeLessThan(0.01);
  });

  it('opens and closes on the same held dot', () => {
    expect(silhouetteAt(0.5, 0.5, 0.05)).toBeGreaterThan(0.5);
    expect(silhouetteAt(0.5, 0.5, SILHOUETTE_SECONDS - 1.5)).toBeGreaterThan(0.5);
  });
});
