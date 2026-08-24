import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { DownloadQuality } from '@ValenceContracts/schemas/Download';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { useTellTheServerWhatIsHeld } from './useTellTheServerWhatIsHeld';

const setHolding =
  vi.fn<(mediaId: string, quality: DownloadQuality, isHeld: boolean) => Promise<boolean>>();

vi.mock('@ValenceClient/downloads/fetchDownloads', () => ({
  setHolding: (mediaId: string, quality: DownloadQuality, isHeld: boolean) =>
    setHolding(mediaId, quality, isHeld),
}));

const ARRIVAL = '00000000-0000-4000-8000-000000000002';

const aFile = (over: Partial<HeldFile> = {}): HeldFile => ({
  downloadId: '00000000-0000-4000-8000-000000000001',
  mediaId: ARRIVAL,
  seriesId: null,
  seriesTitle: null,
  title: 'Arrival',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 100,
  state: 'here',
  bytes: 100,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: false,
  ...over,
});

beforeEach(() => {
  setHolding.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  forgetPlatform();
});

describe('useTellTheServerWhatIsHeld', () => {
  it('says what this device is holding', async () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles([aFile()]).held }));

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).toHaveBeenCalledWith(ARRIVAL, 'original', true);
    });
  });

  it('says nothing about something still arriving, because it is not held yet', async () => {
    installPlatform(aFakePlatform({ held: aFakeHeldFiles([aFile({ state: 'fetching' })]).held }));

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).not.toHaveBeenCalled();
    });
  });

  it('does not repeat itself while nothing changes', async () => {
    const files = aFakeHeldFiles([aFile()]);

    installPlatform(aFakePlatform({ held: files.held }));

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).toHaveBeenCalledTimes(1);
    });

    act(() => {
      files.put([aFile()]);
    });

    expect(setHolding).toHaveBeenCalledTimes(1);
  });

  it('says when something has been let go of', async () => {
    const files = aFakeHeldFiles([aFile()]);

    installPlatform(aFakePlatform({ held: files.held }));

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).toHaveBeenCalledWith(ARRIVAL, 'original', true);
    });

    act(() => {
      files.put([]);
    });

    await waitFor(() => {
      expect(setHolding).toHaveBeenCalledWith(ARRIVAL, 'original', false);
    });
  });

  it('tells the truth about two renditions of the same film separately', async () => {
    installPlatform(
      aFakePlatform({
        held: aFakeHeldFiles([
          aFile(),
          aFile({ downloadId: '00000000-0000-4000-8000-00000000000b', quality: '1080p' }),
        ]).held,
      }),
    );

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).toHaveBeenCalledTimes(2);
    });

    expect(setHolding).toHaveBeenCalledWith(ARRIVAL, '1080p', true);
  });

  it('says nothing at all on a client that holds nothing', async () => {
    installPlatform(aFakePlatform());

    renderHook(() => useTellTheServerWhatIsHeld());

    await waitFor(() => {
      expect(setHolding).not.toHaveBeenCalled();
    });
  });
});
