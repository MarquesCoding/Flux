type WentWhere = { type: string; index?: number };

/**
 * Counts how many places are ahead of where we are.
 *
 * There is a way to ask whether anything is behind us and no way to ask whether anything is ahead,
 * so it is counted: going back puts a place ahead, going forward takes one away, and going somewhere
 * new throws away everything that was ahead, which is what browsers have always done.
 *
 * A forward arrow that is always lit is a lie somebody only finds out by pressing it, which is why
 * this is worth counting rather than assuming.
 *
 * @param ahead - How many places were ahead before.
 * @param went - What just happened.
 * @returns How many are ahead now.
 */
const whereWeCanGo = (ahead: number, went: WentWhere): number => {
  if (went.type === 'PUSH') {
    return 0;
  }

  if (went.type === 'BACK') {
    return ahead + 1;
  }

  if (went.type === 'FORWARD') {
    return Math.max(ahead - 1, 0);
  }

  if (went.type === 'GO' && typeof went.index === 'number') {
    return Math.max(ahead - went.index, 0);
  }

  return ahead;
};

export type { WentWhere };

export { whereWeCanGo };
