import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTravelDirection } from './useTravelDirection';

const ORDER = ['one', 'two', 'three'] as const;

describe('useTravelDirection', () => {
  it('reads a first showing as forwards, since there is nowhere it came from', () => {
    const { result } = renderHook(() => useTravelDirection(ORDER, 'two'));

    expect(result.current).toBe(1);
  });

  it('reads a move to a later tab as forwards', () => {
    const { result, rerender } = renderHook(({ at }) => useTravelDirection(ORDER, at), {
      initialProps: { at: 'one' },
    });

    rerender({ at: 'three' });

    expect(result.current).toBe(1);
  });

  it('reads a move to an earlier tab as backwards', () => {
    const { result, rerender } = renderHook(({ at }) => useTravelDirection(ORDER, at), {
      initialProps: { at: 'three' },
    });

    rerender({ at: 'one' });

    expect(result.current).toBe(-1);
  });

  it('keeps its answer while nothing moves, so a redraw does not reverse the slide', () => {
    const { result, rerender } = renderHook(({ at }) => useTravelDirection(ORDER, at), {
      initialProps: { at: 'three' },
    });

    rerender({ at: 'one' });
    rerender({ at: 'one' });

    expect(result.current).toBe(1);
  });

  it('treats a tab it does not know as forwards rather than throwing', () => {
    const { result } = renderHook(() => useTravelDirection(ORDER, 'nowhere'));

    expect(result.current).toBe(1);
  });
});
