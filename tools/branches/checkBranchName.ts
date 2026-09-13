import { execFileSync } from 'node:child_process';
import { describeBadBranchName, isWellNamedBranch } from './isWellNamedBranch';

/**
 * Refuses a push from a branch this repository would not name that way.
 *
 * Run from the pre-push hook, where it costs nothing and answers before a round trip. The same rule
 * is enforced on GitHub by a ruleset, because a hook is advice to whoever installed it and this is
 * the sort of rule somebody reaches for `--no-verify` over.
 */
const checkBranchName = (): void => {
  const name = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

  if (isWellNamedBranch(name)) {
    return;
  }

  process.exitCode = 1;
  process.stderr.write(`${describeBadBranchName(name)}\n`);
};

checkBranchName();
