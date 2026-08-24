import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { Reachability } from '@ValenceClient/platform/Platform.types';
import { useOfflineMode } from './useOfflineMode';

const aReach = () => {
  const listeners = new Set<(isReachable: boolean) => void>();

  let isReachable = true;

  const reachability: Reachability = {
    isReachable: () => isReachable,
    whenChanged: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    reachability,
    goes: (nowReachable: boolean) => {
      isReachable = nowReachable;

      for (const listener of listeners) {
        listener(nowReachable);
      }
    },
  };
};

afterEach(() => {
  forgetPlatform();
});

describe('useOfflineMode', () => {
  it('is online while the server is answering', () => {
    installPlatform(aFakePlatform());

    expect(renderHook(() => useOfflineMode()).result.current.isOffline).toBe(false);
  });

  it('goes offline when the server stops answering', () => {
    const reach = aReach();

    installPlatform(aFakePlatform({ reachability: reach.reachability }));

    const { result } = renderHook(() => useOfflineMode());

    act(() => {
      reach.goes(false);
    });

    expect(result.current.isOffline).toBe(true);
  });

  it('comes back on its own when the server does', () => {
    const reach = aReach();

    installPlatform(aFakePlatform({ reachability: reach.reachability }));

    const { result } = renderHook(() => useOfflineMode());

    act(() => {
      reach.goes(false);
    });

    act(() => {
      reach.goes(true);
    });

    expect(result.current.isOffline).toBe(false);
  });

  it('goes offline because somebody asked, with the server still there', () => {
    installPlatform(aFakePlatform());

    const { result } = renderHook(() => useOfflineMode());

    act(() => {
      result.current.goOffline(true);
    });

    expect([
      result.current.isOffline,
      result.current.isByChoice,
      result.current.isReachable,
    ]).toEqual([true, true, true]);
  });

  it('stays offline while it was asked for, even once the server is back', () => {
    const reach = aReach();

    installPlatform(aFakePlatform({ reachability: reach.reachability }));

    const { result } = renderHook(() => useOfflineMode());

    act(() => {
      result.current.goOffline(true);
      reach.goes(false);
    });

    act(() => {
      reach.goes(true);
    });

    expect(result.current.isOffline).toBe(true);
  });

  it('leaves a client that can keep nothing alone, however bad its network', () => {
    const reach = aReach();

    installPlatform(aFakePlatform({ canKeepFiles: () => false, reachability: reach.reachability }));

    const { result } = renderHook(() => useOfflineMode());

    act(() => {
      reach.goes(false);
    });

    expect([result.current.isOffline, result.current.canGoOffline]).toEqual([false, false]);
  });

  it('picks up an offline that was asked for before this window opened', () => {
    const platform = aFakePlatform();

    platform.store.write('valence.offline.chosen', 'yes');
    installPlatform(platform);

    expect(renderHook(() => useOfflineMode()).result.current.isOffline).toBe(true);
  });

  it('catches up with a change published before it was listening', () => {
    let isReachable = false;

    const reachability: Reachability = {
      isReachable: () => isReachable,
      whenChanged: () => {
        isReachable = true;

        return () => {};
      },
    };

    installPlatform(aFakePlatform({ reachability }));

    const { result } = renderHook(() => useOfflineMode());

    expect(result.current.isReachable).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });
});
