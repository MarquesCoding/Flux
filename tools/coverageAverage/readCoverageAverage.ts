/**
 * What one package's coverage summary says, as counts rather than shares.
 *
 * Counts, because the average that matters is over the whole codebase: a
 * package holding forty statements at 100% should not weigh the same as one
 * holding four thousand at 90%.
 */
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
  /**
   * The mean of the four, which is the figure the repository is held to.
   */
  average: number;
};

const MEASURES = ['statements', 'branches', 'functions', 'lines'] as const;

/**
 * Works out how well covered the whole repository is.
 *
 * Every package is held to thresholds of its own, which stop any one of them
 * slipping from where it stands. This is the other half: what the codebase
 * comes to taken together, so that a package with little in it cannot flatter
 * the whole and a large one cannot hide behind the small ones.
 *
 * A measure nothing declares — a package with no branches at all — counts as
 * covered, since there is nothing in it left out.
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
