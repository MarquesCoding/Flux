import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRoomBeside } from './useRoomBeside';

type Listener = () => void;

const askedAbout = (matches: boolean) => {
  const listeners = new Set<Listener>();

  const query = {
    matches,
    addEventListener: (_name: string, listen: Listener) => {
      listeners.add(listen);
    },
    removeEventListener: (_name: string, listen: Listener) => {
      listeners.delete(listen);
    },
  };

  const answerDifferently = (now: boolean): void => {
    query.matches = now;

    for (const listen of listeners) {
      listen();
    }
  };

  return { query, answerDifferently, listeners };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRoomBeside', () => {
  it('says there is room where the window is wide enough', () => {
    const { query } = askedAbout(true);

    vi.stubGlobal('matchMedia', () => query);

    const { result } = renderHook(() => useRoomBeside());

    expect(result.current).toBe(true);
  });

  it('says there is none on a phone, so nothing is animated to a width it has no room for', () => {
    const { query } = askedAbout(false);

    vi.stubGlobal('matchMedia', () => query);

    const { result } = renderHook(() => useRoomBeside());

    expect(result.current).toBe(false);
  });

  it('changes its mind when the window does', () => {
    const { query, answerDifferently } = askedAbout(true);

    vi.stubGlobal('matchMedia', () => query);

    const { result } = renderHook(() => useRoomBeside());

    expect(result.current).toBe(true);

    act(() => {
      answerDifferently(false);
    });

    expect(result.current).toBe(false);
  });

  it('stops listening once nobody is drawing with it', () => {
    const { query, listeners } = askedAbout(true);

    vi.stubGlobal('matchMedia', () => query);

    const { unmount } = renderHook(() => useRoomBeside());

    expect(listeners.size).toBe(1);

    unmount();

    expect(listeners.size).toBe(0);
  });

  it('assumes there is room where there is nothing to ask', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useRoomBeside());

    expect(result.current).toBe(true);
  });
});
