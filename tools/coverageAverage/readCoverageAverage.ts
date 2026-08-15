type CoverageCounts = {
  statements: { covered: number; total: number };
  branches: { covered: number; total: number };
  functions: { covered: number; total: number };
  lines: { covered: number; total: number };
};

type CoverageAverage = {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  average: number;
};

const MEASURES = ['statements', 'branches', 'functions', 'lines'] as const;

/**
 * Works out how well covered the whole repository is.
 */
const readCoverageAverage = (summaries: readonly CoverageCounts[]): CoverageAverage => {
  const shares = MEASURES.map((measure) => {
    const covered = summaries.reduce((sum, one) => sum + one[measure].covered, 0);
    const total = summaries.reduce((sum, one) => sum + one[measure].total, 0);

    return total === 0 ? 100 : (covered / total) * 100;
  });

  const [statements = 100, branches = 100, functions = 100, lines = 100] = shares;

  return {
    statements,
    branches,
    functions,
    lines,
    average: shares.reduce((sum, share) => sum + share, 0) / shares.length,
  };
};

export type { CoverageAverage, CoverageCounts };

export { readCoverageAverage, MEASURES };
