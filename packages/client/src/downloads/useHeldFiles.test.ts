import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { useHeldFiles } from './useHeldFiles';

const aFilm = (over: Partial<HeldFile> = {}): HeldFile => ({
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
  ...over,
});

afterEach(() => {
  forgetPlatform();
});

describe('useHeldFiles', () => {
  it('starts empty rather than waiting on the disk', () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles([aFilm()]).held }));

    expect(renderHook(() => useHeldFiles()).result.current).toEqual([]);
  });

  it('says what is on the disk once it has been read', async () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles([aFilm()]).held }));

    const { result } = renderHook(() => useHeldFiles());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    expect(result.current[0]?.title).toBe('The Third Man');
  });

  it('follows a transfer as it moves, without asking again', async () => {
    const files = aFakeHeldFiles([aFilm({ state: 'fetching', bytes: 10 })]);

    installPlatform(aFakePlatform({ held: files.held }));

    const { result } = renderHook(() => useHeldFiles());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    act(() => {
      files.put([aFilm({ state: 'fetching', bytes: 60 })]);
    });

    expect(result.current[0]?.bytes).toBe(60);
  });

  it('notices something being let go', async () => {
    const files = aFakeHeldFiles([aFilm()]);

    installPlatform(aFakePlatform({ held: files.held }));

    const { result } = renderHook(() => useHeldFiles());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    act(() => {
      files.put([]);
    });

    expect(result.current).toEqual([]);
  });

  it('stops listening when the screen goes, so a later change is not written to nothing', async () => {
    const files = aFakeHeldFiles([aFilm()]);

    installPlatform(aFakePlatform({ held: files.held }));

    const { result, unmount } = renderHook(() => useHeldFiles());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    unmount();

    expect(() => {
      files.put([]);
    }).not.toThrow();
  });

  it('holds nothing at all on a client that keeps nothing', async () => {
    installPlatform(aFakePlatform());

    const { result } = renderHook(() => useHeldFiles());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });
});
