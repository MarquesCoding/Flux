import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import type { WatchProgress } from '@ValenceContracts/schemas/WatchProgress';
import {
  forgetWatchedOffline,
  rememberWatchedOffline,
  sendWatchedOffline,
  watchedOffline,
} from './watchedOffline';

const ARRIVAL = '00000000-0000-4000-8000-000000000001';

const SOLARIS = '00000000-0000-4000-8000-000000000002';

const fetchWatchProgress = vi.fn<() => Promise<WatchProgress[]>>();
const reportWatchProgress = vi.fn<(mediaId: string, report: object) => Promise<void>>();

vi.mock('@ValenceClient/playback/watchProgress', () => ({
  fetchWatchProgress: () => fetchWatchProgress(),
  reportWatchProgress: (mediaId: string, report: object) => reportWatchProgress(mediaId, report),
}));

beforeEach(() => {
  installPlatform(aFakePlatform());
  fetchWatchProgress.mockReset().mockResolvedValue([]);
  reportWatchProgress.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  forgetPlatform();
});

describe('rememberWatchedOffline', () => {
  it('writes down where somebody got to', () => {
    rememberWatchedOffline(ARRIVAL, 120, 6000, 1000);

    expect(watchedOffline()).toEqual([
      { mediaId: ARRIVAL, positionSeconds: 120, durationSeconds: 6000, atMs: 1000 },
    ]);
  });

  it('keeps one answer per item rather than the route they took to it', () => {
    rememberWatchedOffline(ARRIVAL, 120, 6000, 1000);
    rememberWatchedOffline(ARRIVAL, 400, 6000, 2000);

    expect(watchedOffline()).toHaveLength(1);
    expect(watchedOffline()[0]?.positionSeconds).toBe(400);
  });

  it('keeps a separate answer for a separate film', () => {
    rememberWatchedOffline(ARRIVAL, 120, 6000, 1000);
    rememberWatchedOffline(SOLARIS, 30, 9000, 1000);

    expect(watchedOffline()).toHaveLength(2);
  });

  it('ignores a shuffle of a second or two, which the player reports constantly', () => {
    rememberWatchedOffline(ARRIVAL, 120, 6000, 1000);
    rememberWatchedOffline(ARRIVAL, 121, 6000, 2000);

    expect(watchedOffline()[0]?.positionSeconds).toBe(120);
  });

  it('refuses to record a position in something with no length', () => {
    rememberWatchedOffline(ARRIVAL, 120, 0, 1000);

    expect(watchedOffline()).toEqual([]);
  });

  it('reads nothing where the device has been cleared', () => {
    rememberWatchedOffline(ARRIVAL, 120, 6000, 1000);
    forgetWatchedOffline();

    expect(watchedOffline()).toEqual([]);
  });
});

describe('sendWatchedOffline', () => {
  it('does not go near the server where nothing was watched', async () => {
    expect(await sendWatchedOffline()).toBe(0);
    expect(fetchWatchProgress).not.toHaveBeenCalled();
  });

  it('tells the server about something it had never heard of', async () => {
    rememberWatchedOffline(ARRIVAL, 400, 6000, 2000);

    expect(await sendWatchedOffline()).toBe(1);
    expect(reportWatchProgress).toHaveBeenCalledWith(ARRIVAL, {
      positionSeconds: 400,
      durationSeconds: 6000,
    });
  });

  it('tells the server where this device watched it more recently', async () => {
    fetchWatchProgress.mockResolvedValue([
      {
        mediaId: ARRIVAL,
        positionSeconds: 60,
        durationSeconds: 6000,
        isFinished: false,
        updatedAt: '2026-08-20T00:00:00.000Z',
      },
    ]);

    rememberWatchedOffline(ARRIVAL, 400, 6000, Date.parse('2026-08-21T00:00:00.000Z'));

    expect(await sendWatchedOffline()).toBe(1);
  });

  it('leaves alone something another device watched more recently', async () => {
    fetchWatchProgress.mockResolvedValue([
      {
        mediaId: ARRIVAL,
        positionSeconds: 60,
        durationSeconds: 6000,
        isFinished: false,
        updatedAt: '2026-08-23T00:00:00.000Z',
      },
    ]);

    rememberWatchedOffline(ARRIVAL, 400, 6000, Date.parse('2026-08-21T00:00:00.000Z'));

    expect(await sendWatchedOffline()).toBe(0);
    expect(reportWatchProgress).not.toHaveBeenCalled();
  });

  it('forgets everything once it has been sent, including what it decided not to send', async () => {
    fetchWatchProgress.mockResolvedValue([
      {
        mediaId: ARRIVAL,
        positionSeconds: 60,
        durationSeconds: 6000,
        isFinished: false,
        updatedAt: '2026-08-23T00:00:00.000Z',
      },
    ]);

    rememberWatchedOffline(ARRIVAL, 400, 6000, Date.parse('2026-08-21T00:00:00.000Z'));

    await sendWatchedOffline();

    expect(watchedOffline()).toEqual([]);
  });

  it('still sends where the server could not be read, rather than losing the aeroplane', async () => {
    fetchWatchProgress.mockRejectedValue(new Error('offline'));

    rememberWatchedOffline(ARRIVAL, 400, 6000, 2000);

    expect(await sendWatchedOffline()).toBe(1);
  });
});
