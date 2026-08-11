import { describe, expect, it, vi } from 'vitest';
import {
  isReachableOrigin,
  absoluteStreamUrl,
  watchCastState,
  promptForDevice,
} from './castPlayback';
import type { CastState } from './castPlayback.types';

/**
 * A video element as Safari presents one: its own route picker, and no sign of
 * the standard interface.
 */
const wireless = (isPlayingRemotely = false) => {
  const element = document.createElement('video');

  element.webkitShowPlaybackTargetPicker = vi.fn();
  Object.defineProperty(element, 'webkitCurrentPlaybackTargetIsWireless', {
    configurable: true,
    value: isPlayingRemotely,
  });
  Object.defineProperty(element, 'remote', { configurable: true, value: undefined });

  return element;
};

/**
 * A video element as Chrome presents one.
 */
const standard = (state: string, isAvailable = true) => {
  const element = document.createElement('video');
  const remote = {
    state,
    prompt: vi.fn(() => Promise.resolve()),
    watchAvailability: vi.fn((tell: (available: boolean) => void) => {
      tell(isAvailable);

      return Promise.resolve(1);
    }),
    cancelWatchAvailability: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(element, 'remote', { configurable: true, value: remote });

  return { element, remote };
};

describe('isReachableOrigin', () => {
  it('agrees where a device could follow the address', () => {
    expect(isReachableOrigin('http://flux.local:5173')).toBe(true);
    expect(isReachableOrigin('http://192.168.1.20:5173')).toBe(true);
  });

  it('declines an address that means the machine asking', () => {
    expect(isReachableOrigin('http://localhost:5173')).toBe(false);
    expect(isReachableOrigin('http://127.0.0.1:5173')).toBe(false);
  });

  it('declines something that is not an address at all', () => {
    expect(isReachableOrigin('not an origin')).toBe(false);
  });
});

describe('absoluteStreamUrl', () => {
  it('says where a stream is in terms a device can use', () => {
    expect(
      absoluteStreamUrl('/api/playback/session/abc/index.m3u8', 'http://flux.local:5173'),
    ).toBe('http://flux.local:5173/api/playback/session/abc/index.m3u8');
  });

  it('leaves an address that is already whole alone', () => {
    expect(absoluteStreamUrl('http://flux.local/a.mkv', 'http://flux.local:5173')).toBe(
      'http://flux.local/a.mkv',
    );
  });

  it('answers with nothing where the page itself cannot be followed', () => {
    expect(
      absoluteStreamUrl('/api/playback/session/abc/index.m3u8', 'http://localhost:5173'),
    ).toBeNull();
  });
});

describe('watchCastState', () => {
  it('says a Safari route is available once one is announced', () => {
    const element = wireless();
    const said: CastState[] = [];

    watchCastState(element, (state) => said.push(state));
    element.dispatchEvent(new Event('webkitplaybacktargetavailabilitychanged'));

    expect(said).toContain('available');
  });

  it('says a Safari route is in use while it is', () => {
    const element = wireless(true);
    const said: CastState[] = [];

    watchCastState(element, (state) => said.push(state));
    element.dispatchEvent(new Event('webkitplaybacktargetavailabilitychanged'));

    expect(said).toContain('connected');
  });

  it('reads the state the standard interface is already in', () => {
    const { element } = standard('connected');
    const said: CastState[] = [];

    watchCastState(element, (state) => said.push(state));

    expect(said).toContain('connected');
  });

  it('keeps offering somewhere to send it even when the browser reports none', () => {
    const { element } = standard('disconnected', false);
    const said: CastState[] = [];

    watchCastState(element, (state) => said.push(state));

    expect(said).toContain('available');
    expect(said).not.toContain('unavailable');
  });

  it('stops watching on request', async () => {
    const { element, remote } = standard('disconnected');

    const stop = watchCastState(element, vi.fn());

    await Promise.resolve();
    stop();

    expect(remote.removeEventListener).toHaveBeenCalled();
  });

  it('offers nothing where the browser can do neither', () => {
    const element = document.createElement('video');

    Object.defineProperty(element, 'remote', { configurable: true, value: undefined });

    const said: CastState[] = [];
    const stop = watchCastState(element, (state) => said.push(state));

    expect(said).toEqual([]);
    stop();
  });
});

describe('promptForDevice', () => {
  it('shows Safari its own picker', async () => {
    const element = wireless();

    await expect(promptForDevice(element)).resolves.toBe('shown');
    expect(element.webkitShowPlaybackTargetPicker).toHaveBeenCalled();
  });

  it('asks the standard interface everywhere else', async () => {
    const { element, remote } = standard('disconnected');

    await expect(promptForDevice(element)).resolves.toBe('shown');
    expect(remote.prompt).toHaveBeenCalled();
  });

  it('tells a closed picker from a refused one', async () => {
    const { element, remote } = standard('disconnected');
    const closed = new Error('closed');

    closed.name = 'AbortError';
    remote.prompt.mockRejectedValue(closed);

    await expect(promptForDevice(element)).resolves.toBe('dismissed');
  });

  it('says when the browser declined to open one at all', async () => {
    const { element, remote } = standard('disconnected');
    const refused = new Error('not supported');

    refused.name = 'NotSupportedError';
    remote.prompt.mockRejectedValue(refused);

    await expect(promptForDevice(element)).resolves.toBe('refused');
  });

  it('says so where there is no picker to show', async () => {
    const element = document.createElement('video');

    Object.defineProperty(element, 'remote', { configurable: true, value: undefined });

    await expect(promptForDevice(element)).resolves.toBe('unsupported');
  });
});
