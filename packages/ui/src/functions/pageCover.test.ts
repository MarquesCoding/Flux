import { afterEach, describe, expect, it, vi } from 'vitest';
import { coverPage, forgetPageCovers, isPageCovered, watchPageCover } from './pageCover';

afterEach(() => {
  forgetPageCovers();
});

describe('coverPage', () => {
  it('leaves the page uncovered until something stands over it', () => {
    expect(isPageCovered()).toBe(false);
  });

  it('covers the page while something is standing over it', () => {
    coverPage();

    expect(isPageCovered()).toBe(true);
  });

  it('uncovers it again on the way out', () => {
    const uncover = coverPage();

    uncover();

    expect(isPageCovered()).toBe(false);
  });

  it('stays covered while a second thing is still standing over it', () => {
    const first = coverPage();

    coverPage();
    first();

    expect(isPageCovered()).toBe(true);
  });

  it('is unbothered by the same thing standing down twice', () => {
    const only = coverPage();

    coverPage();
    only();
    only();

    expect(isPageCovered()).toBe(true);
  });
});

describe('watchPageCover', () => {
  it('says when the page becomes covered', () => {
    const tell = vi.fn();

    watchPageCover(tell);
    coverPage();

    expect(tell).toHaveBeenCalled();
  });

  it('says when it is uncovered again', () => {
    const tell = vi.fn();
    const uncover = coverPage();

    watchPageCover(tell);
    uncover();

    expect(tell).toHaveBeenCalledOnce();
  });

  it('stops saying anything once it has been let go', () => {
    const tell = vi.fn();
    const stop = watchPageCover(tell);

    stop();
    coverPage();

    expect(tell).not.toHaveBeenCalled();
  });
});
