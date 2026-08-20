import { describe, expect, it } from 'vitest';
import { groupHolding, spreadsFor } from './spreadsFor';

const none = new Set<number>();

describe('spreadsFor', () => {
  it('shows one page at a time when that is what somebody asked for', () => {
    expect(spreadsFor({ pageCount: 3, isDouble: false, isOffset: false, wide: none })).toEqual([
      [0],
      [1],
      [2],
    ]);
  });

  it('pairs pages when two are shown, which is how a book is held', () => {
    expect(spreadsFor({ pageCount: 4, isDouble: true, isOffset: false, wide: none })).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('leaves the cover alone when pairing is offset, since it was never half of anything', () => {
    expect(spreadsFor({ pageCount: 5, isDouble: true, isOffset: true, wide: none })).toEqual([
      [0],
      [1, 2],
      [3, 4],
    ]);
  });

  it('gives a wide page both halves, which is what these archives store a spread as', () => {
    const groups = spreadsFor({
      pageCount: 5,
      isDouble: true,
      isOffset: false,
      wide: new Set([2]),
    });

    expect(groups).toEqual([[0, 1], [2], [3, 4]]);
  });

  it('does not pair the page before a wide one, which would put everything after it out by one', () => {
    const groups = spreadsFor({
      pageCount: 4,
      isDouble: true,
      isOffset: false,
      wide: new Set([1]),
    });

    expect(groups).toEqual([[0], [1], [2, 3]]);
  });

  it('leaves a last odd page on its own rather than pairing it with nothing', () => {
    expect(spreadsFor({ pageCount: 3, isDouble: true, isOffset: false, wide: none })).toEqual([
      [0, 1],
      [2],
    ]);
  });

  it('shows every page exactly once, however the groups fall', () => {
    const groups = spreadsFor({
      pageCount: 9,
      isDouble: true,
      isOffset: true,
      wide: new Set([3, 7]),
    });

    expect(groups.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('has nothing to show for a chapter with no pages', () => {
    expect(spreadsFor({ pageCount: 0, isDouble: true, isOffset: false, wide: none })).toEqual([]);
  });
});

describe('groupHolding', () => {
  it('finds the group a page is shown in', () => {
    expect(groupHolding([[0, 1], [2], [3, 4]], 3)).toBe(2);
  });

  it('finds a page that is the second of its pair', () => {
    expect(
      groupHolding(
        [
          [0, 1],
          [2, 3],
        ],
        1,
      ),
    ).toBe(0);
  });

  it('lands on the last group where a saved place is past the end', () => {
    expect(groupHolding([[0], [1]], 40)).toBe(1);
  });

  it('lands nowhere in particular when there is nothing to show', () => {
    expect(groupHolding([], 3)).toBe(0);
  });
});
