import { afterEach, describe, expect, it, vi } from 'vitest';
import { theBrowsersReach } from './theBrowsersReach';

const pretendOnline = (isOnline: boolean): void => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('theBrowsersReach', () => {
  it('reports what the browser says about the network', () => {
    pretendOnline(true);

    expect(theBrowsersReach().isReachable()).toBe(true);
  });

  it('reports a machine with no network as out of reach', () => {
    pretendOnline(false);

    expect(theBrowsersReach().isReachable()).toBe(false);
  });

  it('says so when the network comes back', () => {
    const told: boolean[] = [];

    theBrowsersReach().whenChanged((isReachable) => told.push(isReachable));

    window.dispatchEvent(new Event('online'));

    expect(told).toEqual([true]);
  });

  it('says so when it goes away', () => {
    const told: boolean[] = [];

    theBrowsersReach().whenChanged((isReachable) => told.push(isReachable));

    window.dispatchEvent(new Event('offline'));

    expect(told).toEqual([false]);
  });

  it('stops listening when it is let go, so a remount does not hear twice', () => {
    const told: boolean[] = [];

    theBrowsersReach().whenChanged((isReachable) => told.push(isReachable))();

    window.dispatchEvent(new Event('offline'));

    expect(told).toEqual([]);
  });
});
