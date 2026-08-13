import { describe, expect, it } from 'vitest';
import { readCoverageAverage } from './readCoverageAverage';
import type { CoverageCounts } from './readCoverageAverage';

const counts = (covered: number, total: number): CoverageCounts => ({
  statements: { covered, total },
  branches: { covered, total },
  functions: { covered, total },
  lines: { covered, total },
});

describe('readCoverageAverage', () => {
  it('reports every measure and the mean of them', () => {
    expect(readCoverageAverage([counts(90, 100)])).toEqual({
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
      average: 90,
    });
  });

  it('weighs a package by how much code is in it, not by being a package', () => {
    const small = counts(10, 10);
    const large = counts(80, 100);

    expect(readCoverageAverage([small, large]).average).toBeCloseTo(81.82, 1);
  });

  it('counts a measure nothing declares as covered, since nothing is left out', () => {
    const nothingToBranch: CoverageCounts = {
      statements: { covered: 5, total: 5 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      lines: { covered: 5, total: 5 },
    };

    expect(readCoverageAverage([nothingToBranch]).branches).toBe(100);
  });

  it('reports nothing at all as covered rather than as a division by nought', () => {
    expect(readCoverageAverage([]).average).toBe(100);
  });

  it('averages the four measures rather than the packages', () => {
    const uneven: CoverageCounts = {
      statements: { covered: 100, total: 100 },
      branches: { covered: 60, total: 100 },
      functions: { covered: 100, total: 100 },
      lines: { covered: 100, total: 100 },
    };

    expect(readCoverageAverage([uneven]).average).toBe(90);
  });
});
