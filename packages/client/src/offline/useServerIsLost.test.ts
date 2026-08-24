import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import type { Reachability } from '@ValenceClient/platform/Platform.types';
import { useServerIsLost } from './useServerIsLost';

const aFilm = (): HeldFile => ({
  downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 100,
  state: 'here',
  bytes: 100,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: true,
});

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

describe('useServerIsLost', () => {
  it('says nothing is lost while the server is answering', async () => {
    installPlatform(aFakePlatform());

    const { result } = renderHook(() => useServerIsLost());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('says the server is lost once it stops answering with nothing on the disk', async () => {
    const reach = aReach();

    installPlatform(aFakePlatform({ reachability: reach.reachability }));

    const { result } = renderHook(() => useServerIsLost());

    act(() => {
      reach.goes(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('asks the disk when the server goes rather than only as the window opens', async () => {
    const reach = aReach();
    const files = aFakeHeldFiles([aFilm()]);

    installPlatform(aFakePlatform({ held: files.held, reachability: reach.reachability }));

    const { result } = renderHook(() => useServerIsLost());

    act(() => {
      files.put([]);
      reach.goes(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('leaves somebody with downloads where they are', async () => {
    const reach = aReach();

    installPlatform(
      aFakePlatform({ held: aFakeHeldFiles([aFilm()]).held, reachability: reach.reachability }),
    );

    const { result } = renderHook(() => useServerIsLost());

    act(() => {
      reach.goes(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('does not ask again before the disk has answered', () => {
    const reach = aReach();
    const never = aFakeHeldFiles();

    installPlatform(
      aFakePlatform({
        held: { ...never.held, all: () => new Promise<HeldFile[]>(() => {}) },
        reachability: reach.reachability,
      }),
    );

    const { result } = renderHook(() => useServerIsLost());

    act(() => {
      reach.goes(false);
    });

    expect(result.current).toBe(false);
  });

  it('keeps a disk that could not be asked rather than throwing somebody out', async () => {
    const reach = aReach();
    const broken = aFakeHeldFiles();

    installPlatform(
      aFakePlatform({
        held: { ...broken.held, all: () => Promise.reject(new Error('No answer')) },
        reachability: reach.reachability,
      }),
    );

    const { result } = renderHook(() => useServerIsLost());

    act(() => {
      reach.goes(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
