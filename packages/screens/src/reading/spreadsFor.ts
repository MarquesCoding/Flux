type SpreadOptions = {
  pageCount: number;
  isDouble: boolean;
  isOffset: boolean;
  wide: ReadonlySet<number>;
};

/**
 * Works out what is shown at once, and in what groups.
 *
 * Reading two pages at a time is how a book is actually held, but pages do not pair up as simply as
 * counting in twos. A volume opens on a cover that was never half of anything, so the first page
 * stands alone and the pairing starts after it — which is what offsetting means, and why it is worth
 * a switch: whether it is needed depends on whether whoever made the archive included the cover.
 *
 * A page that is itself a spread stands alone too. These archives store a double-page drawing as one
 * wide picture — `p012-013` in the volumes this was built against — and a reader that paired it with
 * its neighbour would show three pages at once and put every pair after it out by one.
 *
 * Which pages are wide is not knowable in advance. It is learnt as they load, so this is recomputed
 * as that is discovered and the groups settle once a chapter has been read through.
 *
 * @param options - How many pages, whether two are shown, whether pairing is offset, and which pages
 *   are known to be wide.
 * @returns The groups, in reading order, each holding one page or two.
 */
const spreadsFor = ({ pageCount, isDouble, isOffset, wide }: SpreadOptions): number[][] => {
  if (pageCount <= 0) {
    return [];
  }

  if (!isDouble) {
    return Array.from({ length: pageCount }, (_, at) => [at]);
  }

  const groups: number[][] = [];
  let at = 0;

  if (isOffset) {
    groups.push([0]);
    at = 1;
  }

  while (at < pageCount) {
    const next = at + 1;

    if (wide.has(at) || next >= pageCount || wide.has(next)) {
      groups.push([at]);
      at += 1;

      continue;
    }

    groups.push([at, next]);
    at += 2;
  }

  return groups;
};

/**
 * Finds the group a page is shown in.
 *
 * Somebody who was on page ninety and turns two pages on should land where page ninety-two is, not
 * on group ninety-two — and a place saved while reading one page at a time has to be found again
 * when the same chapter is opened two at a time.
 *
 * @param groups - The groups, as `spreadsFor` worked them out.
 * @param page - The page to find.
 * @returns Which group holds it, or the last group where it is past the end.
 */
const groupHolding = (groups: readonly number[][], page: number): number => {
  const at = groups.findIndex((group) => group.includes(page));

  return at === -1 ? Math.max(groups.length - 1, 0) : at;
};

export type { SpreadOptions };

export { groupHolding, spreadsFor };
