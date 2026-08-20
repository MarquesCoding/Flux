import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { coverPage, forgetPageCovers } from '@FluxUI/pageCover';
import { useIsPageCovered } from './useIsPageCovered';

afterEach(() => {
  forgetPageCovers();
});

describe('useIsPageCovered', () => {
  it('says the page is clear to begin with', () => {
    const { result } = renderHook(() => useIsPageCovered());

    expect(result.current).toBe(false);
  });

  it('notices something standing over the page', () => {
    const { result } = renderHook(() => useIsPageCovered());

    act(() => {
      coverPage();
    });

    expect(result.current).toBe(true);
  });

  it('notices it standing down again', () => {
    const { result } = renderHook(() => useIsPageCovered());

    let uncover = (): void => {};

    act(() => {
      uncover = coverPage();
    });

    act(() => {
      uncover();
    });

    expect(result.current).toBe(false);
  });
});
