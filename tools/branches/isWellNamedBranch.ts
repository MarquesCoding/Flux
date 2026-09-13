const TYPES = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
  'test',
  'perf',
  'build',
  'ci',
  'style',
  'revert',
] as const;

const SHAPE = new RegExp(`^(${TYPES.join('|')})/[a-z0-9][a-z0-9._-]*$`);

const MINDED_BY_SOMETHING_ELSE = [/^renovate\//, /^dependabot\//, /^gh-pages$/];

const TRUNKS = ['main', 'HEAD'];

/**
 * Whether a branch is named the way this repository names branches.
 *
 * `type/short-description`, with the same types commits carry, because a branch and the commits on
 * it describe the same piece of work and two vocabularies for it is one more than anybody can keep
 * straight. The description is lower case and hyphenated so it reads the same in a shell, a URL and
 * a pull request title.
 *
 * The trunk passes, and so do the branches a bot names for itself: telling Renovate to rename its
 * branches is a fight with a machine that will not learn.
 *
 * @param name - The branch name, as git reports it.
 * @returns Whether it is well named.
 */
const isWellNamedBranch = (name: string): boolean => {
  if (TRUNKS.includes(name)) {
    return true;
  }

  if (MINDED_BY_SOMETHING_ELSE.some((theirs) => theirs.test(name))) {
    return true;
  }

  return SHAPE.test(name);
};

/**
 * What to tell somebody whose branch is not named the way this repository names them.
 *
 * @param name - The branch they are on.
 * @returns The message.
 */
const describeBadBranchName = (name: string): string =>
  [
    `"${name}" is not a branch name this repository accepts.`,
    '',
    'Branches are named for the work on them, with the same types commits carry:',
    '',
    `  ${TYPES.join(', ')}`,
    '',
    'as type/short-description, lower case and hyphenated. For example:',
    '',
    '  feat/hide-a-library-per-profile',
    '  fix/a-stop-that-ends-one-viewing',
    '  docs/say-how-releases-are-cut',
    '',
    'Rename this one and push again:',
    '',
    `  git branch -m ${name} fix/something-that-says-what-this-is`,
  ].join('\n');

export { TYPES, describeBadBranchName, isWellNamedBranch };
